/**
 * Backfill script: imports 22 existing evaluations from reports/ into Supabase
 *
 * Run with: MIGRATION_TARGET=supabase npx tsx lib/db/backfill-reports.ts
 *
 * Strategy: Import the roles and companies as reference data.
 * Evaluations require a user_id, so those are created only after a real user signs up.
 * This way the historical opportunities are searchable and ready to be re-evaluated.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { getDb } from './index';
import { companies, roles } from './schema';
import { eq } from 'drizzle-orm';

// Resolve from web/ directory: web/lib/db/backfill-reports.ts -> ../../reports
const REPORTS_DIR = path.join(__dirname, '../../../reports');

interface ParsedReport {
  displayId: string;
  company: string;
  role: string;
  date: string;
  score: number;
  url?: string;
}

function parseReportFile(filePath: string, filename: string): ParsedReport | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract filename parts: {###}-{company-slug}-{YYYY-MM-DD}.md
    const nameMatch = filename.match(/^(\d{3})-(.+)-(\d{4}-\d{2}-\d{2})\.md$/);
    if (!nameMatch) {
      console.warn(`⚠️  Skipping ${filename}: invalid filename format`);
      return null;
    }

    const [, displayId, , date] = nameMatch;

    // Extract company and role from markdown header
    const headerMatch = content.match(/# Evaluación:\s*(.+?)\s*—\s*(.+?)\n/);
    if (!headerMatch) {
      console.warn(`⚠️  Skipping ${filename}: no header found`);
      return null;
    }

    const [, company, role] = headerMatch;

    // Extract score: **Score:** X.X/5 or **Score:** XXX/100
    const scoreMatch = content.match(/\*\*Score:\*\*\s*([\d.]+)\/[15]0?/);
    const scoreText = scoreMatch?.[1] || '0';
    const score = parseFloat(scoreText);

    // Extract URL if present
    const urlMatch = content.match(/\*\*(?:URL|Url):\*\*\s*(https?:\/\/\S+)/);
    const url = urlMatch?.[1];

    return {
      displayId,
      company: company.trim(),
      role: role.trim(),
      date,
      score,
      url,
    };
  } catch (error) {
    console.error(`❌ Error parsing ${filename}:`, error);
    return null;
  }
}

async function backfillReports() {
  console.log('🚀 Starting backfill of roles and companies from 22 evaluations...\n');

  const db = getDb();

  // Read all report files
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'));
  console.log(`📂 Found ${files.length} report files\n`);

  const roleMap = new Map<string, ParsedReport>();
  let successCount = 0;
  let skipCount = 0;

  // Parse all reports first
  for (const filename of files.sort()) {
    const filePath = path.join(REPORTS_DIR, filename);
    const report = parseReportFile(filePath, filename);

    if (!report) {
      skipCount++;
      continue;
    }

    // Use company-role as key to deduplicate
    const key = `${report.company}||${report.role}`;
    if (!roleMap.has(key)) {
      roleMap.set(key, report);
    }
  }

  console.log(`📊 Parsed ${roleMap.size} unique roles\n`);

  // Now backfill companies and roles
  for (const [, report] of roleMap) {
    try {
      // Step 1: Find or create company
      const existingCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.name, report.company))
        .limit(1);

      let companyId: string;
      if (existingCompanies.length > 0) {
        companyId = existingCompanies[0].id;
        console.log(`  📦 ${report.company} (exists)`);
      } else {
        const newCompany = await db
          .insert(companies)
          .values({ name: report.company })
          .returning({ id: companies.id });
        companyId = newCompany[0].id;
        console.log(`  ✅ Created company: ${report.company}`);
      }

      // Step 2: Create or find role record
      const sourceRef = report.url || `backfill-${report.displayId}`;
      const existingRoles = await db
        .select()
        .from(roles)
        .where(eq(roles.sourceRef, sourceRef))
        .limit(1);

      if (existingRoles.length > 0) {
        console.log(`  📌 ${report.role} (exists at ${report.company})`);
      } else {
        const roleValues: any = {
          source: report.url ? 'url' : 'backfill',
          sourceRef: sourceRef,
          companyName: report.company,
          companyId,
          roleTitle: report.role,
          rawJdText: `Backfilled from report #${report.displayId} (${report.date})`,
        };

        await db.insert(roles).values(roleValues as any);
        console.log(`  ✅ Created role: ${report.role} @ ${report.company}`);
      }

      successCount++;
    } catch (error: any) {
      // Silently skip duplicates
      if (error.code === '23505') {
        console.log(`  ⏭️  ${report.role} @ ${report.company} (duplicate key)`);
      } else {
        console.error(`  ❌ ${report.role} @ ${report.company}:`, error.message);
      }
      skipCount++;
    }
  }

  console.log(`\n✨ Backfill complete:`);
  console.log(`   ✅ Imported: ${successCount} roles/companies`);
  console.log(`   ⏭️  Skipped: ${skipCount} (duplicates or errors)`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Sign up via LinkedIn at /auth/signin`);
  console.log(`   2. Paste a recruiter DM to /evaluate to create your first evaluation`);
  console.log(`   3. Historical opportunities are now in the database and searchable`);
}

backfillReports().catch(console.error);
