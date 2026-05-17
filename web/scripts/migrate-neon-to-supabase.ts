import { config } from 'dotenv';
import path from 'path';
import postgres from 'postgres';
import { randomUUID } from 'crypto';

config({ path: path.resolve(__dirname, '../.env.local') });

// ============================================================
// SETUP
// ============================================================

const neonUrl = process.env.DATABASE_URL_UNPOOLED;
const supabaseUrl = process.env.SUPABASE_POSTGRES_URL_NON_POOLING;

if (!neonUrl || !supabaseUrl) {
  console.error('❌ Missing DATABASE_URL_UNPOOLED or SUPABASE_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const neon = postgres(neonUrl, { ssl: 'require', max: 1 });
const supabase = postgres(supabaseUrl, { ssl: 'require', max: 1 });

// ============================================================
// TYPES
// ============================================================

interface NeonApplication {
  id: number;
  user_email: string;
  date: string;
  company: string;
  role: string;
  score_num: number | null;
  status: string;
  report_id: string | null;
  report_content: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface NeonJob {
  id: number;
  user_email: string;
  url: string;
  company: string;
  role: string;
  portal: string | null;
  location: string | null;
  first_seen: string | null;
  status: string;
  eval_id: number | null;
  created_at: string;
}

interface NeonCompany {
  id: number;
  name: string;
  domain: string | null;
  funding_stage: string | null;
  headcount: string | null;
  notes: string | null;
  last_researched: string | null;
  created_at: string;
}

interface NeonDocument {
  id: number;
  application_id: number;
  type: string;
  title: string | null;
  content: string | null;
  created_at: string;
}

type MigrationError = {
  table: string;
  row: Record<string, unknown>;
  error: string;
};

const errors: MigrationError[] = [];
const stats = {
  users: { source: 0, dest: 0 },
  companies: { source: 0, dest: 0 },
  roles: { source: 0, dest: 0 },
  evaluations: { source: 0, dest: 0 },
  pipelineStatus: { source: 0, dest: 0 },
  documents: { source: 0, dest: 0 },
  starStories: { source: 0, dest: 0 },
};

function logError(table: string, row: Record<string, unknown>, error: unknown) {
  errors.push({
    table,
    row,
    error: error instanceof Error ? error.message : String(error),
  });
}

// ============================================================
// MIGRATION STEPS
// ============================================================

async function migrateUsers() {
  console.log('\n📥 Migrating users...');

  try {
    // Get unique users from applications
    const appUsers = await neon`SELECT DISTINCT user_email FROM applications`;
    const uniqueEmails = appUsers.map((u: any) => u.user_email).filter((e: string) => e);

    stats.users.source = uniqueEmails.length;

    const userMap = new Map<string, string>(); // email -> UUID

    for (const email of uniqueEmails) {
      try {
        const userId = randomUUID();
        userMap.set(email, userId);

        await supabase`
          INSERT INTO users (id, email, locale, timezone, account_status)
          VALUES (${userId}, ${email}, 'es-MX', 'America/Mexico_City', 'active')
        `;
        stats.users.dest++;
      } catch (error) {
        logError('users', { email }, error);
      }
    }

    console.log(`✓ Users: ${stats.users.dest}/${stats.users.source}`);
    return userMap;
  } catch (error) {
    console.error('❌ Failed to migrate users:', error);
    throw error;
  }
}

async function migrateUserProfiles(userMap: Map<string, string>) {
  console.log('\n📥 Migrating user profiles...');

  try {
    for (const [email, userId] of userMap) {
      try {
        // Read cv_content and profile_content from settings
        const cvRow = await neon`SELECT value FROM settings WHERE key = ${email}:cv_content LIMIT 1`;
        const profileRow = await neon`SELECT value FROM settings WHERE key = ${email}:profile_content LIMIT 1`;

        const cvMarkdown = cvRow.length > 0 ? (cvRow[0] as any).value : null;
        const profileMarkdown = profileRow.length > 0 ? (profileRow[0] as any).value : null;

        if (cvMarkdown || profileMarkdown) {
          await supabase`
            INSERT INTO user_profiles (id, user_id, cv_markdown, profile_markdown)
            VALUES (${randomUUID()}, ${userId}, ${cvMarkdown}, ${profileMarkdown})
          `;
        }
      } catch (error) {
        logError('user_profiles', { email }, error);
      }
    }

    console.log(`✓ User profiles migrated`);
  } catch (error) {
    console.error('❌ Failed to migrate user profiles:', error);
  }
}

async function migrateUserPreferences(userMap: Map<string, string>) {
  console.log('\n📥 Migrating user preferences...');

  try {
    for (const [email, userId] of userMap) {
      try {
        const prefRow = await neon`
          SELECT value FROM settings WHERE key = ${email}:leadme_preferences LIMIT 1
        `;

        if (prefRow.length === 0) continue;

        const prefs = JSON.parse((prefRow[0] as any).value);

        const floorComp = prefs.floorSalaryMXN
          ? Math.round(parseFloat(prefs.floorSalaryMXN) / 20)
          : null;

        await supabase`
          INSERT INTO user_preferences (
            id, user_id, mode, floor_comp_usd,
            target_geographies, target_functions, target_seniority_levels, human_answer
          )
          VALUES (
            ${randomUUID()}, ${userId}, ${prefs.mode || 'open'},
            ${floorComp}, ${prefs.geographies || []}::text[],
            ${prefs.functions || []}::text[], ${prefs.levels || []}::text[],
            ${prefs.humanAnswer || null}
          )
        `;
      } catch (error) {
        logError('user_preferences', { email }, error);
      }
    }

    console.log(`✓ User preferences migrated`);
  } catch (error) {
    console.error('❌ Failed to migrate user preferences:', error);
  }
}

async function migrateCompanies() {
  console.log('\n📥 Migrating companies...');

  try {
    const companies = (await neon`SELECT * FROM companies`) as NeonCompany[];
    stats.companies.source = companies.length;

    const companyIdMap = new Map<number, string>(); // old_id -> new_uuid
    const companyNameMap = new Map<string, string>(); // name -> new_uuid

    for (const company of companies) {
      try {
        const newId = randomUUID();
        companyIdMap.set(company.id, newId);
        companyNameMap.set(company.name, newId);

        await supabase`
          INSERT INTO companies (
            id, name, website, stage, context_summary, last_enriched_at
          )
          VALUES (
            ${newId}, ${company.name}, ${company.domain}, ${company.funding_stage},
            ${company.notes}, ${company.last_researched}
          )
        `;
        stats.companies.dest++;
      } catch (error) {
        logError('companies', company, error);
      }
    }

    console.log(`✓ Companies: ${stats.companies.dest}/${stats.companies.source}`);
    return { idMap: companyIdMap, nameMap: companyNameMap };
  } catch (error) {
    console.error('❌ Failed to migrate companies:', error);
    throw error;
  }
}

async function migrateRolesAndEvaluations(
  userMap: Map<string, string>,
  companyMaps: { idMap: Map<number, string>; nameMap: Map<string, string> }
) {
  console.log('\n📥 Migrating roles and evaluations...');

  try {
    const jobs = (await neon`SELECT * FROM jobs`) as NeonJob[];
    const applications = (await neon`SELECT * FROM applications`) as NeonApplication[];

    stats.roles.source = jobs.length;

    const jobIdToRoleId = new Map<number, string>(); // old job.id -> new role UUID
    const appIdToEvalId = new Map<number, string>(); // old app.id -> new evaluation UUID
    const processedAppIds = new Set<number>();

    // Step 1: Migrate jobs → roles (source='scan')
    for (const job of jobs) {
      try {
        const roleId = randomUUID();
        jobIdToRoleId.set(job.id, roleId);

        // Look up company by name in the nameMap
        const companyId = companyMaps.nameMap.get(job.company) || null;
        const livenessStatus = job.status === 'discarded' ? 'closed' : 'active';

        await supabase`
          INSERT INTO roles (
            id, source, source_ref, company_name, company_id, role_title,
            location, portal, raw_jd_text, liveness_status, created_at
          )
          VALUES (
            ${roleId}, 'scan', ${job.url}, ${job.company}, ${companyId},
            ${job.role}, ${job.location}, ${job.portal}, null,
            ${livenessStatus}, ${job.created_at}
          )
        `;
        stats.roles.dest++;

        // If this job has an eval_id, process that application now
        if (job.eval_id) {
          const app = applications.find((a) => a.id === job.eval_id);
          if (app && !processedAppIds.has(app.id)) {
            const evaluationId = await insertEvaluation(
              app,
              userMap,
              roleId,
              appIdToEvalId
            );
            if (evaluationId) {
              processedAppIds.add(app.id);
            }
          }
        }
      } catch (error) {
        logError('roles (from jobs)', job, error);
      }
    }

    // Step 2: Migrate remaining applications (those without corresponding jobs)
    for (const app of applications) {
      if (processedAppIds.has(app.id)) continue;

      try {
        const roleId = randomUUID();
        const companyId = companyMaps.nameMap.get(app.company) || null;

        // Create a new role for orphaned applications
        await supabase`
          INSERT INTO roles (
            id, source, source_ref, company_name, company_id, role_title,
            liveness_status, created_at
          )
          VALUES (
            ${roleId}, 'paste', ${'legacy-app-' + app.id}, ${app.company},
            ${companyId}, ${app.role}, 'active', ${app.created_at}
          )
        `;
        stats.roles.dest++;

        const evaluationId = await insertEvaluation(
          app,
          userMap,
          roleId,
          appIdToEvalId
        );
        if (!evaluationId) {
          logError('evaluations', app, 'Failed to insert evaluation');
        }
      } catch (error) {
        logError('roles (from orphaned apps)', app, error);
      }
    }

    console.log(`✓ Roles: ${stats.roles.dest}/${stats.roles.source + applications.length}`);
    console.log(`✓ Evaluations: ${stats.evaluations.dest}`);
    console.log(`✓ Pipeline Status: ${stats.pipelineStatus.dest}`);
    return appIdToEvalId;
  } catch (error) {
    console.error('❌ Failed to migrate roles/evaluations:', error);
    throw error;
  }
}

async function insertEvaluation(
  app: NeonApplication,
  userMap: Map<string, string>,
  roleId: string,
  appIdToEvalId: Map<number, string>
): Promise<string | null> {
  try {
    const userId = userMap.get(app.user_email);
    if (!userId) {
      logError('evaluations', app, 'User not found for email: ' + app.user_email);
      return null;
    }

    const overallScore = app.score_num ? app.score_num * 20 : null;
    let recommendation = 'pass';
    if (overallScore && overallScore >= 4 * 20) recommendation = 'apply';
    else if (overallScore && overallScore >= 3 * 20) recommendation = 'hold';

    const evaluationId = randomUUID();

    await supabase`
      INSERT INTO evaluations (
        id, user_id, role_id, evaluated_at, overall_score,
        recommendation, full_report_markdown, display_id,
        model_used, prompt_version, created_at
      )
      VALUES (
        ${evaluationId}, ${userId}, ${roleId}, ${app.created_at},
        ${overallScore}, ${recommendation}, ${app.report_content},
        ${app.report_id}, 'claude-sonnet-4-6', 'oferta-legacy',
        ${app.created_at}
      )
    `;
    stats.evaluations.dest++;

    appIdToEvalId.set(app.id, evaluationId);

    // Insert pipeline_status
    const statusMap: Record<string, string> = {
      Applied: 'applied',
      Interview: 'interviewing',
      Offer: 'offer',
      Rejected: 'rejected',
      Discarded: 'rejected',
      Passed: 'passed',
    };

    const pipelineStatus = statusMap[app.status] || 'evaluating';
    const appliedAt = app.status === 'Applied' ? app.date : null;

    await supabase`
      INSERT INTO pipeline_status (
        id, user_id, role_id, status, status_changed_at,
        applied_at, notes_markdown
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${roleId}, ${pipelineStatus},
        ${app.updated_at}, ${appliedAt}, ${app.notes}
      )
    `;
    stats.pipelineStatus.dest++;

    return evaluationId;
  } catch (error) {
    logError('insertEvaluation', app, error);
    return null;
  }
}

async function migrateDocuments(
  userMap: Map<string, string>,
  appIdToEvalId: Map<number, string>
) {
  console.log('\n📥 Migrating documents...');

  try {
    const documents = (await neon`SELECT * FROM documents`) as NeonDocument[];
    stats.documents.source = documents.length;

    for (const doc of documents) {
      try {
        // Look up the application to get user_email
        const appResult = (await neon`
          SELECT user_email FROM applications WHERE id = ${doc.application_id} LIMIT 1
        `) as Array<{ user_email: string }>;

        if (appResult.length === 0) {
          logError('documents', doc, `Application ${doc.application_id} not found`);
          continue;
        }

        const userEmail = appResult[0].user_email;
        const userId = userMap.get(userEmail);

        if (!userId) {
          logError('documents', doc, `User not found for email: ${userEmail}`);
          continue;
        }

        // Get the evaluation ID for this application
        const evaluationId = appIdToEvalId.get(doc.application_id) || null;

        await supabase`
          INSERT INTO documents (
            id, user_id, evaluation_id, type, title, content
          )
          VALUES (
            ${randomUUID()}, ${userId}, ${evaluationId}, ${doc.type},
            ${doc.title}, ${doc.content}
          )
        `;
        stats.documents.dest++;
      } catch (error) {
        logError('documents', doc, error);
      }
    }

    console.log(`✓ Documents: ${stats.documents.dest}/${stats.documents.source}`);
  } catch (error) {
    console.error('❌ Failed to migrate documents:', error);
  }
}

async function migrateStarStories(userMap: Map<string, string>) {
  console.log('\n📥 Migrating star stories...');

  try {
    // Check if stories table exists
    const storiesCheck = await neon`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stories')
    `;

    if (!storiesCheck[0]) {
      console.log('⊘ Stories table not found in Neon, skipping');
      return;
    }

    const stories = await neon`SELECT * FROM stories`;
    stats.starStories.source = stories.length;

    // For now, skip star_stories migration since old table has no user_id
    console.log(`⊘ Stories table found (${stories.length} rows) but has no user_id; manual assignment required`);
  } catch (error) {
    console.log(`⊘ Stories table not available or error reading: ${error instanceof Error ? error.message : error}`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🚀 Starting migration from Neon to Supabase...\n');

  try {
    // Step 1: Migrate users
    const userMap = await migrateUsers();

    // Step 2: Migrate user profiles and preferences
    await migrateUserProfiles(userMap);
    await migrateUserPreferences(userMap);

    // Step 3: Migrate companies
    const companyMaps = await migrateCompanies();

    // Step 4: Migrate roles, evaluations, and pipeline_status
    const appIdToEvalId = await migrateRolesAndEvaluations(userMap, companyMaps);

    // Step 5: Migrate documents
    await migrateDocuments(userMap, appIdToEvalId);

    // Step 6: Migrate star stories
    await migrateStarStories(userMap);

    // ============================================================
    // REPORT
    // ============================================================

    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📊 MIGRATION STATS:');
    console.log('Users:', `${stats.users.dest}/${stats.users.source}`);
    console.log('Companies:', `${stats.companies.dest}/${stats.companies.source}`);
    console.log('Roles:', `${stats.roles.dest}/${stats.roles.source}`);
    console.log('Evaluations:', `${stats.evaluations.dest}`);
    console.log('Pipeline Status:', `${stats.pipelineStatus.dest}`);
    console.log('Documents:', `${stats.documents.dest}/${stats.documents.source}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} ERRORS DURING MIGRATION:`);
      errors.forEach((err, i) => {
        console.log(`\n[${i + 1}] ${err.table}`);
        console.log(`   Row:`, JSON.stringify(err.row, null, 2).split('\n').slice(0, 3).join('\n'));
        console.log(`   Error: ${err.error}`);
      });
    } else {
      console.log('\n✅ No errors!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Next: Run Step 5 (Supabase Auth setup)\n');
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await neon.end();
    await supabase.end();
  }
}

main();
