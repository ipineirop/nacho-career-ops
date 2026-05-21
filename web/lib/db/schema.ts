import {
  pgTable, uuid, text, real, boolean, date, timestamp,
  integer, numeric, jsonb, index, unique,
} from 'drizzle-orm/pg-core';

// ============================================================
// USER LAYER
// ============================================================

// users — extends auth.users (Supabase Auth)
// PK references auth.users(id), populated by trigger on signup
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(), // FK to auth.users(id), ON DELETE CASCADE
  email: text('email').notNull().unique(),
  nameFull: text('name_full'),
  namePreferred: text('name_preferred'),
  locale: text('locale').default('es-MX'),
  timezone: text('timezone').default('America/Mexico_City'),
  accountStatus: text('account_status').default('active'), // active|paused|deleted
  createdAt: timestamp('created_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at'),
});

// user_profiles — career identity (replaces settings:cv_content and :profile_content)
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  yearsOfExperience: integer('years_of_experience'),
  seniorityLevel: text('seniority_level'), // ic|senior_ic|manager|director|head_of|vp|c_level
  primaryFunction: text('primary_function'),
  secondaryFunctions: text('secondary_functions').array(),
  domains: text('domains').array(),
  industries: text('industries').array(),
  languages: jsonb('languages'), // [{code, fluency}]
  education: jsonb('education'), // [{institution, degree, field, year, country}]
  summaryMarkdown: text('summary_markdown'), // CV summary prose (structured input for rendering)
  skills: text('skills').array(),
  workAuthorization: text('work_authorization').array(),
  relocationWillingness: text('relocation_willingness'),
  remotePreference: text('remote_preference'),
  cvMarkdown: text('cv_markdown'), // replaces settings:cv_content
  cvUploadedAt: timestamp('cv_uploaded_at'),
  profileMarkdown: text('profile_markdown'), // replaces settings:profile_content
  linkedinUrl: text('linkedin_url'),
  linkedinLastSyncedAt: timestamp('linkedin_last_synced_at'),
  portfolioUrls: text('portfolio_urls').array(),
  profileCompletenessScore: integer('profile_completeness_score'),
  lastMeaningfulUpdateAt: timestamp('last_meaningful_update_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  userIdx: index('user_profiles_user_idx').on(t.userId),
}));

// user_locations — current and history
export const userLocations = pgTable('user_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationType: text('location_type').notNull(), // current_residence|work_base|target_relocation
  countryIso: text('country_iso').notNull(),
  stateOrRegion: text('state_or_region'),
  city: text('city'),
  neighborhood: text('neighborhood'),
  postalCode: text('postal_code'),
  sinceDate: date('since_date'),
  untilDate: date('until_date'), // null if current
  verified: boolean('verified').default(false),
  source: text('source'), // user_input|linkedin|cv_parse
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('user_locations_user_idx').on(t.userId),
}));

// user_preferences — current search criteria, snapshotted
// Replaces settings:leadme_preferences JSON blob
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(), // need|leverage|open|paused
  floorCompUsd: numeric('floor_comp_usd'),
  targetCompUsd: numeric('target_comp_usd'),
  idealCompUsd: numeric('ideal_comp_usd'),
  compCurrencyDisplay: text('comp_currency_display').default('usd'), // mxn|usd|both
  targetGeographies: text('target_geographies').array(),
  targetRemoteModes: text('target_remote_modes').array(),
  targetCompanyStages: text('target_company_stages').array(),
  targetIndustries: text('target_industries').array(),
  targetDomains: text('target_domains').array(),
  targetFunctions: text('target_functions').array(),
  targetSeniorityLevels: text('target_seniority_levels').array(),
  nonNegotiables: jsonb('non_negotiables'), // [{label, importance}]
  niceToHaves: text('nice_to_haves').array(),
  dealBreakers: text('deal_breakers').array(),
  briefCadence: text('brief_cadence').default('weekly'),
  briefPickCount: integer('brief_pick_count').default(5),
  preferredBriefTime: text('preferred_brief_time'), // 'HH:MM' in user tz
  humanAnswer: text('human_answer'), // open-ended "what are you looking for"
  createdAt: timestamp('created_at').defaultNow(),
  supersededAt: timestamp('superseded_at'), // null if current
}, (t) => ({
  userIdx: index('user_preferences_user_idx').on(t.userId),
  currentIdx: index('user_preferences_current_idx').on(t.userId, t.supersededAt),
}));

// user_compensation — current and history
export const userCompensation = pgTable('user_compensation', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recordType: text('record_type').notNull(), // current|historical|target
  employerName: text('employer_name'),
  baseAmount: numeric('base_amount'),
  baseCurrency: text('base_currency'),
  bonusStructureMarkdown: text('bonus_structure_markdown'),
  bonusRealizedAmount: numeric('bonus_realized_amount'),
  equityValueUsd: numeric('equity_value_usd'),
  benefits: jsonb('benefits'), // [{type, value, importance}]
  totalCompUsdNormalized: numeric('total_comp_usd_normalized'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'), // null if current
  source: text('source'), // user_input|offer_letter|inferred|estimated
  confidence: text('confidence'), // high|medium|low
  private: boolean('private').default(false), // never used for benchmarks
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('user_compensation_user_idx').on(t.userId),
}));

// user_signals_derived — Labra's model of the user (companion memory)
export const userSignalsDerived = pgTable('user_signals_derived', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  careerArcDescription: text('career_arc_description'),
  trajectoryVelocity: text('trajectory_velocity'), // slow|steady|fast|stalled
  scopeGrowthRate: numeric('scope_growth_rate'),
  domainConsistency: text('domain_consistency'), // specialist|generalist|pivoting
  marketAlignmentScore: numeric('market_alignment_score'),
  inferredStrengths: text('inferred_strengths').array(),
  inferredGaps: text('inferred_gaps').array(),
  lastCalculatedAt: timestamp('last_calculated_at'),
  calculationVersion: text('calculation_version'),
});

// user_events — activity log
export const userEvents = pgTable('user_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data'),
  occurredAt: timestamp('occurred_at').defaultNow(),
  sessionId: text('session_id'),
}, (t) => ({
  userIdx: index('user_events_user_idx').on(t.userId, t.occurredAt),
}));

// ============================================================
// CONTENT LAYER (moved before user_career_history to avoid forward ref)
// ============================================================

// companies — enriched, cached, multi-user
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  website: text('website'),
  country: text('country'),
  stage: text('stage'), // seed|series_a|series_b|growth|public
  latestFunding: jsonb('latest_funding'),
  employeeCount: integer('employee_count'),
  founded: date('founded'),
  sector: text('sector'),
  subSector: text('sub_sector'),
  investors: text('investors').array(),
  notableLeaders: jsonb('notable_leaders'),
  glassdoorScore: numeric('glassdoor_score'),
  contextSummary: text('context_summary'),
  lastEnrichedAt: timestamp('last_enriched_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// user_career_history — structured work history (moved after companies)
export const userCareerHistory = pgTable('user_career_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  companyId: uuid('company_id').references(() => companies.id),
  roleTitle: text('role_title').notNull(),
  roleArchetype: text('role_archetype'),
  function: text('function'),
  seniorityAtRole: text('seniority_at_role'),
  locationDuringRole: text('location_during_role'),
  remoteDuringRole: text('remote_during_role'),
  startedAt: date('started_at'),
  endedAt: date('ended_at'), // null if current
  teamSizeManaged: integer('team_size_managed'),
  pnlScopeUsd: numeric('pnl_scope_usd'),
  keyOutcomesMarkdown: text('key_outcomes_markdown'),
  proofPoints: jsonb('proof_points'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('career_history_user_idx').on(t.userId),
}));

// roles — opportunities, deduped, multi-user
// Replaces existing `jobs` table with richer structure
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(), // url|recruiter_dm|paste|scan
  sourceRef: text('source_ref').unique(), // URL or content hash
  companyName: text('company_name').notNull(),
  companyId: uuid('company_id').references(() => companies.id),
  roleTitle: text('role_title').notNull(),
  roleArchetype: text('role_archetype'),
  function: text('function'),
  domain: text('domain'),
  seniorityLevel: text('seniority_level'),
  location: text('location'),
  remotePolicy: text('remote_policy'),
  teamDescription: text('team_description'),
  compRangeLow: numeric('comp_range_low'),
  compRangeHigh: numeric('comp_range_high'),
  compCurrency: text('comp_currency'),
  compDisclosed: boolean('comp_disclosed').default(false),
  postedAt: timestamp('posted_at'),
  scrapedAt: timestamp('scraped_at'),
  verifiedAt: timestamp('verified_at'),
  livenessStatus: text('liveness_status').default('active'), // active|stale|closed|unknown
  rawJdText: text('raw_jd_text'),
  structuredJd: jsonb('structured_jd'),
  portal: text('portal'), // greenhouse|ashby|lever|linkedin|other
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  sourceRefIdx: index('roles_source_ref_idx').on(t.sourceRef),
  companyIdx: index('roles_company_idx').on(t.companyId),
}));

// ============================================================
// EVALUATION LAYER
// ============================================================

// evaluations — heart of the system, versioned, supersession-aware
// Replaces existing `applications` table with structured fields
export const evaluations = pgTable('evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  evaluatedAt: timestamp('evaluated_at').defaultNow(),
  evaluationVersion: integer('evaluation_version').default(1),
  overallScore: numeric('overall_score'), // 0-100 scale
  recommendation: text('recommendation'), // apply|hold|pass
  cvMatchScore: numeric('cv_match_score'),
  northStarScore: numeric('north_star_score'),
  compScore: numeric('comp_score'),
  culturalScore: numeric('cultural_score'),
  redFlagAdjustment: numeric('red_flag_adjustment'),
  verdictSummary: text('verdict_summary'),
  fullReportMarkdown: text('full_report_markdown'), // preserves narrative
  modelUsed: text('model_used'),
  promptVersion: text('prompt_version'),
  supersededBy: uuid('superseded_by'), // self-FK to evaluations.id (set after insert)
  displayId: text('display_id'), // "001", "002" — backfilled from legacy report_id
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('evaluations_user_idx').on(t.userId),
  roleIdx: index('evaluations_role_idx').on(t.roleId),
  userRoleIdx: index('evaluations_user_role_idx').on(t.userId, t.roleId),
}));

// evaluation_dimensions — per-dimension breakdown
export const evaluationDimensions = pgTable('evaluation_dimensions', {
  id: uuid('id').defaultRandom().primaryKey(),
  evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  dimensionName: text('dimension_name').notNull(), // scope|domain|level|comp|culture|...
  grade: text('grade'), // A|B+|B|...
  scoreNumeric: numeric('score_numeric'),
  reasoningMarkdown: text('reasoning_markdown'),
}, (t) => ({
  evalIdx: index('eval_dimensions_eval_idx').on(t.evaluationId),
}));

// evaluation_gaps — what's missing and how to mitigate
export const evaluationGaps = pgTable('evaluation_gaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  gapDescription: text('gap_description').notNull(),
  blockerSeverity: text('blocker_severity'), // hard|soft|none
  adjacentExperience: text('adjacent_experience'),
  mitigationStrategy: text('mitigation_strategy'),
}, (t) => ({
  evalIdx: index('eval_gaps_eval_idx').on(t.evaluationId),
}));

// evaluation_proof_points — CV-to-requirement mapping
export const evaluationProofPoints = pgTable('evaluation_proof_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  requirement: text('requirement').notNull(),
  evidence: text('evidence'),
  matchStrength: text('match_strength'), // match|partial|miss
}, (t) => ({
  evalIdx: index('eval_proof_eval_idx').on(t.evaluationId),
}));

// star_stories — reusable STAR+R bank (replaces existing `stories`)
export const starStories = pgTable('star_stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  situation: text('situation'),
  task: text('task'),
  action: text('action'),
  result: text('result'),
  reflection: text('reflection'),
  tags: text('tags').array(),
  usedInEvaluations: uuid('used_in_evaluations').array(),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (t) => ({
  userIdx: index('star_stories_user_idx').on(t.userId),
}));

// ============================================================
// PIPELINE + MOAT LAYER
// ============================================================

// pipeline_status — current state per user per role
// Separates state from evaluation (which is a judgment snapshot)
export const pipelineStatus = pgTable('pipeline_status', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  status: text('status').notNull(), // evaluating|applied|interviewing|offer|accepted|rejected|withdrawn|passed
  statusChangedAt: timestamp('status_changed_at').defaultNow(),
  appliedAt: timestamp('applied_at'),
  lastTouchAt: timestamp('last_touch_at'),
  followUpDueAt: timestamp('follow_up_due_at'),
  notesMarkdown: text('notes_markdown'),
}, (t) => ({
  userIdx: index('pipeline_user_idx').on(t.userId),
  userStatusIdx: index('pipeline_user_status_idx').on(t.userId, t.status),
  userRoleUniq: unique('pipeline_user_role_uniq').on(t.userId, t.roleId),
}));

// interactions — every touchpoint
export const interactions = pgTable('interactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  type: text('type').notNull(), // application|interview|email|recruiter_dm|offer|rejection
  direction: text('direction'), // inbound|outbound
  occurredAt: timestamp('occurred_at').defaultNow(),
  description: text('description'),
  sentiment: text('sentiment'), // positive|neutral|negative
  metadata: jsonb('metadata'),
}, (t) => ({
  userIdx: index('interactions_user_idx').on(t.userId),
  roleIdx: index('interactions_role_idx').on(t.roleId),
}));

// outcomes — THE MOAT
export const outcomes = pgTable('outcomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  outcomeType: text('outcome_type').notNull(), // offer|rejection|ghost|withdrawn|accepted|negotiated
  occurredAt: timestamp('occurred_at').defaultNow(),
  offerBaseUsd: numeric('offer_base_usd'),
  offerTotalUsd: numeric('offer_total_usd'),
  offerCurrency: text('offer_currency'),
  negotiatedDeltaPct: numeric('negotiated_delta_pct'),
  accepted: boolean('accepted'),
  rejectionReason: text('rejection_reason'),
  ghostedAfterStage: text('ghosted_after_stage'),
  notesMarkdown: text('notes_markdown'),
}, (t) => ({
  userIdx: index('outcomes_user_idx').on(t.userId),
  typeIdx: index('outcomes_type_idx').on(t.outcomeType),
}));

// journal_entries — career capital tracking
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  occurredAt: timestamp('occurred_at').defaultNow(),
  entryType: text('entry_type').notNull(), // scope_change|win|feedback|skill|reflection
  title: text('title'),
  bodyMarkdown: text('body_markdown'),
  relatedCompanyId: uuid('related_company_id').references(() => companies.id),
  metrics: jsonb('metrics'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('journal_user_idx').on(t.userId, t.occurredAt),
}));

// ============================================================
// INTELLIGENCE LAYER
// ============================================================

// market_signals — derived aggregates, recalculated nightly
export const marketSignals = pgTable('market_signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  segment: text('segment').notNull().unique(), // composite key: function + level + geo + industry
  medianCompUsd: numeric('median_comp_usd'),
  p25CompUsd: numeric('p25_comp_usd'),
  p75CompUsd: numeric('p75_comp_usd'),
  sampleSize: integer('sample_size'),
  lastCalculatedAt: timestamp('last_calculated_at').defaultNow(),
  confidenceLevel: text('confidence_level'), // high|medium|low
  sourceBreakdown: jsonb('source_breakdown'), // {reports: 40, scraped: 35, user: 25}
});

// ============================================================
// DOCUMENTS — preserved, refactored with user_id
// ============================================================

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  evaluationId: uuid('evaluation_id').references(() => evaluations.id, { onDelete: 'set null' }),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // cv|cover_letter|report|outreach
  title: text('title'),
  content: text('content'),
  storageUrl: text('storage_url'), // Supabase Storage URL
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('documents_user_idx').on(t.userId),
}));

// ============================================================
// INVITATIONS — test user access codes
// ============================================================

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // e.g., "TEST-ABC123-XYZ789"
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimedBy: uuid('claimed_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at').notNull(),
  claimedAt: timestamp('claimed_at'),
  status: text('status').notNull().default('active'), // active|claimed|expired|revoked
  notes: text('notes'), // optional: who this code is for
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  codeIdx: index('invitations_code_idx').on(t.code),
  createdByIdx: index('invitations_created_by_idx').on(t.createdBy),
  claimedByIdx: index('invitations_claimed_by_idx').on(t.claimedBy),
}));

// ============================================================
// OAUTH TOKENS — for Gmail / Calendar / etc. refresh tokens
// ============================================================

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // google|linkedin|github
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  scope: text('scope'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  userProviderUniq: unique('oauth_user_provider_uniq').on(t.userId, t.provider),
}));

// signin_codes — temporary OTP codes for email authentication
export const signinCodes = pgTable('signin_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  emailUniq: unique('signin_codes_email_uniq').on(t.email),
  emailIdx: index('signin_codes_email_idx').on(t.email),
}));

// ============================================================
// TYPE EXPORTS
// ============================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type UserCareerHistory = typeof userCareerHistory.$inferSelect;
export type NewUserCareerHistory = typeof userCareerHistory.$inferInsert;

export type UserLocation = typeof userLocations.$inferSelect;
export type NewUserLocation = typeof userLocations.$inferInsert;

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

export type UserCompensation = typeof userCompensation.$inferSelect;
export type NewUserCompensation = typeof userCompensation.$inferInsert;

export type UserSignalsDerived = typeof userSignalsDerived.$inferSelect;
export type NewUserSignalsDerived = typeof userSignalsDerived.$inferInsert;

export type UserEvent = typeof userEvents.$inferSelect;
export type NewUserEvent = typeof userEvents.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;

export type EvaluationDimension = typeof evaluationDimensions.$inferSelect;
export type NewEvaluationDimension = typeof evaluationDimensions.$inferInsert;

export type EvaluationGap = typeof evaluationGaps.$inferSelect;
export type NewEvaluationGap = typeof evaluationGaps.$inferInsert;

export type EvaluationProofPoint = typeof evaluationProofPoints.$inferSelect;
export type NewEvaluationProofPoint = typeof evaluationProofPoints.$inferInsert;

export type StarStory = typeof starStories.$inferSelect;
export type NewStarStory = typeof starStories.$inferInsert;

export type PipelineStatus = typeof pipelineStatus.$inferSelect;
export type NewPipelineStatus = typeof pipelineStatus.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;

export type MarketSignal = typeof marketSignals.$inferSelect;
export type NewMarketSignal = typeof marketSignals.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type OauthToken = typeof oauthTokens.$inferSelect;
export type NewOauthToken = typeof oauthTokens.$inferInsert;

export type SigninCode = typeof signinCodes.$inferSelect;
export type NewSigninCode = typeof signinCodes.$inferInsert;
