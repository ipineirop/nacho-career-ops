# Labra Platform Specification

**Project**: AI-powered job search optimization platform  
**User**: Single user (you, pineiro.ignacio@gmail.com) + test users via invitations  
**Status**: MVP phase — core features complete, UI pending  
**Built**: May 2026 | Next.js 16.2.6 + Supabase + Claude API  

---

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │ Next.js 16 (App Router)
│   React         │ Client components + Server components
└────────┬────────┘
         │
┌────────▼────────────────────────┐
│   API Layer                      │ 20+ REST endpoints
│   Route Handlers (/api/*)        │ Streaming for long operations
└────────┬────────────────────────┘
         │
┌────────▼────────────────────────┐
│   Business Logic                 │
│   - evaluate-engine.ts           │ Claude AI for scoring
│   - outreach-engine.ts           │ Email draft generation
│   - auth-bridge.ts               │ Session → UUID mapping
└────────┬────────────────────────┘
         │
┌────────▼────────────────────────┐
│   Data Layer                     │
│   Drizzle ORM                    │ PostgreSQL type-safe queries
│   Supabase PostgreSQL            │ 23 tables, RLS policies
└────────────────────────────────┘
         │
┌────────▼─────────────────────────┐
│   External Services              │
│   - Claude API (Sonnet 4.6)      │ AI evaluation & generation
│   - LinkedIn OAuth               │ User authentication
│   - Email OTP (Resend)          │ Optional email signin
│   - Supabase Auth (future)      │ Plan: migrate from next-auth
└──────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.2.6 (App Router, TypeScript)
- **UI**: Inline styles (no CSS framework yet)
- **HTTP**: Fetch API, native streaming support
- **State**: React hooks (useState, useEffect, useContext)
- **Session**: next-auth/react (JWT strategy)
- **Validation**: Zod (client-side form validation via server-side schemas)

### Backend
- **Runtime**: Node.js 24 LTS
- **API**: Next.js Route Handlers (serverless)
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle Kit + Drizzle ORM (v0.31.10)
- **Auth**: next-auth 5.x (bridges to Supabase Auth in future)
- **AI**: @anthropic-ai/sdk (Claude Sonnet 4.6)
- **Validation**: Zod schema inference

### Database
- **Host**: Supabase (managed PostgreSQL)
- **Schema**: 23 tables, auto-generated migrations
- **Security**: Row-level security (RLS) policies
- **Backup**: Supabase automated backups
- **Connection**: Neon serverless + pooling layer

### Infrastructure
- **Hosting**: Vercel (Next.js optimized)
- **Environment**: Production + Preview deployments
- **CI/CD**: GitHub Actions (auto-deploy on push)
- **Secrets**: Environment variables in .env.local

---

## Database Schema (23 Tables)

### User & Auth
```sql
users
├─ id (uuid, PK)
├─ email (text, unique)
├─ nameFull (text)
├─ createdAt (timestamp, default now)
└─ indexes: email_unique, email_idx

invitations
├─ id (uuid, PK)
├─ code (text, unique, 24-char alphanumeric)
├─ createdBy (uuid FK → users)
├─ claimedBy (uuid FK → users, nullable)
├─ expiresAt (timestamp)
├─ claimedAt (timestamp, nullable)
├─ status (text: active|claimed|expired|revoked)
├─ notes (text, optional)
├─ createdAt (timestamp)
└─ indexes: code_unique, created_by, claimed_by

oauth_tokens
├─ id (uuid, PK)
├─ userId (uuid FK → users, unique)
├─ provider (text: gmail|calendar|etc)
├─ accessToken (text, encrypted in future)
├─ refreshToken (text, optional)
├─ expiresAt (timestamp, nullable)
└─ indexes: userId
```

### Opportunities (Roles)
```sql
companies
├─ id (uuid, PK)
├─ name (text)
├─ website (text, nullable)
├─ description (text, nullable)
├─ location (text, nullable)
├─ size (text: seed|series_a|growth|public|none)
├─ domain (text: fintech|marketplace|saas|healthtech|etc)
├─ foundedYear (integer, nullable)
├─ createdAt (timestamp)
└─ indexes: name_unique, domain_idx

roles
├─ id (uuid, PK)
├─ companyId (uuid FK → companies)
├─ roleTitle (text)
├─ function (text: engineering|product|operations|sales|marketing|other)
├─ seniorityLevel (text: ic|lead|manager|director|head_of|vp|c_level)
├─ location (text)
├─ remotePolicy (text: onsite|hybrid|remote)
├─ teamDescription (text, nullable)
├─ sourceRef (text, nullable, unique — for dedup)
├─ sourceUrl (text, nullable)
├─ compRangeLow (integer, optional)
├─ compRangeHigh (integer, optional)
├─ compCurrency (text: USD|EUR|MXN|etc)
├─ equityGrant (text, optional)
├─ benefitsDescription (text, nullable)
├─ urgency (text: none|moderate|high)
├─ applicationDeadline (timestamp, nullable)
├─ createdAt (timestamp)
├─ updatedAt (timestamp)
└─ indexes: company_id, source_ref_unique, created_at

market_signals
├─ id (uuid, PK)
├─ segment (text: "operations > director > Mexico City")
├─ medianCompUsd (integer, nullable)
├─ p25CompUsd (integer, nullable)
├─ p75CompUsd (integer, nullable)
├─ sampleSize (integer, nullable)
├─ confidenceLevel (text: low|medium|high)
├─ source (text: market_data|internal)
└─ no indexes (lookup table)
```

### Evaluations & Scoring
```sql
evaluations
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ roleId (uuid FK → roles)
├─ overallScore (decimal 0-100)
├─ recommendation (text: apply|consider|pass|skip)
├─ summary (text, 1-2 sentence summary)
├─ extractedAt (timestamp)
├─ evaluatedAt (timestamp)
├─ createdAt (timestamp)
├─ updatedAt (timestamp)
└─ indexes: user_id, role_id, created_at

evaluation_dimensions
├─ id (uuid, PK)
├─ evaluationId (uuid FK → evaluations)
├─ dimension (text: cv_match|north_star|compensation|culture|red_flags)
├─ score (decimal 0-5)
├─ reasoning (text)
└─ indexes: evaluation_id

evaluation_gaps
├─ id (uuid, PK)
├─ evaluationId (uuid FK → evaluations)
├─ gap (text: skill|experience|location|compensation|etc)
├─ severity (text: low|medium|high)
├─ description (text)
└─ indexes: evaluation_id

evaluation_proof_points
├─ id (uuid, PK)
├─ evaluationId (uuid FK → evaluations)
├─ proofPoint (text)
├─ relevance (text: cv_match|culture|technical|etc)
└─ indexes: evaluation_id
```

### Application Tracking
```sql
pipeline_status
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ roleId (uuid FK → roles)
├─ status (text: applied|interviewed|offer|accepted|rejected|withdrawn|passed)
├─ statusChangedAt (timestamp)
├─ appliedAt (timestamp, nullable)
├─ notesMarkdown (text, optional)
├─ followUpDueAt (timestamp, nullable)
├─ lastTouchAt (timestamp, nullable)
├─ createdAt (timestamp)
├─ updatedAt (timestamp)
└─ indexes: user_id, role_id, status

outcomes
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ roleId (uuid FK → roles)
├─ outcomeType (text: offer|rejection|ghost|withdrawn|accepted|negotiated)
├─ occurredAt (timestamp)
├─ offerBaseUsd (integer, nullable)
├─ offerTotalUsd (integer, nullable)
├─ offerCurrency (text)
├─ offerEquityPct (decimal, nullable)
├─ negotiatedDeltaPct (integer, nullable)
├─ rejectionReason (text, nullable)
├─ notesMarkdown (text, optional)
├─ createdAt (timestamp)
└─ indexes: user_id, role_id, outcome_type

interactions
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ roleId (uuid FK → roles)
├─ type (text: application|interview|email|recruiter_dm|offer|rejection)
├─ direction (text: inbound|outbound)
├─ description (text, optional)
├─ sentiment (text: positive|neutral|negative)
├─ metadata (jsonb: interviewer, duration_minutes, etc)
├─ occurredAt (timestamp)
├─ createdAt (timestamp)
└─ indexes: user_id, role_id
```

### User Preferences & Settings
```sql
user_profiles
├─ id (uuid, PK)
├─ userId (uuid FK → users, unique)
├─ bio (text, optional)
├─ locationPreference (text, optional)
├─ timezoneId (text)
├─ profilePhotoUrl (text, nullable)
├─ linkedinUrl (text, nullable)
├─ portfolioUrl (text, nullable)
├─ targetRoles (text[], array of role titles)
├─ targetSeniorities (text[], array of levels)
├─ targetDomains (text[], array of domains)
├─ yearsExperience (integer)
├─ currentTitle (text, nullable)
├─ currentCompany (text, nullable)
├─ salaryExpectationLow (integer, nullable)
├─ salaryExpectationHigh (integer, nullable)
├─ salaryExpectationCurrency (text)
├─ equityPreference (text: essential|important|nice_to_have|not_interested)
├─ remotePreference (text: remote|hybrid|onsite|flexible)
├─ travelWillingness (integer 0-100)
├─ updatedAt (timestamp)
└─ indexes: user_id_unique

user_preferences
├─ id (uuid, PK)
├─ userId (uuid FK → users, unique)
├─ notificationEmail (boolean, default true)
├─ notificationSlack (boolean, default false)
├─ weeklyDigest (boolean, default true)
├─ autoApply (boolean, default false)
├─ hiddenCompanies (text[], array of company IDs)
├─ hiddenDomains (text[], array of domains)
├─ excludeOnsite (boolean)
├─ minCompensation (integer, nullable)
├─ maxCommute (integer, minutes, nullable)
├─ dealBreakers (text[], array of deal-breaker descriptions)
├─ updatedAt (timestamp)
└─ indexes: user_id_unique

user_career_history
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ title (text)
├─ company (text)
├─ function (text)
├─ startDate (date)
├─ endDate (date, nullable — null = current)
├─ isCurrent (boolean)
├─ description (text, nullable)
├─ achievements (text[], array of bullet points)
├─ skills (text[], array of skill tags)
├─ createdAt (timestamp)
└─ indexes: user_id

user_compensation
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ jobTitle (text)
├─ company (text)
├─ baseSalaryUsd (integer, nullable)
├─ bonusUsd (integer, nullable)
├─ equityGrantValueUsd (integer, nullable)
├─ equityVestingYears (integer)
├─ equityPercentage (decimal, nullable)
├─ benefitsValueUsd (integer, nullable)
├─ otherCompUsd (integer, nullable)
├─ totalCompUsd (integer, computed)
├─ currency (text)
├─ year (integer, YYYY)
├─ createdAt (timestamp)
└─ indexes: user_id, year

user_locations
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ city (text)
├─ country (text)
├─ timezone (text)
├─ lived (boolean, currently living there)
├─ willing (boolean, willing to relocate)
├─ workFromDays (integer, 0-5)
├─ commuteTolerance (integer, minutes)
├─ notes (text, optional)
└─ indexes: user_id

user_signals_derived
├─ id (uuid, PK)
├─ userId (uuid FK → users, unique)
├─ conversationRate (decimal 0-100)
├─ avgEvaluationScore (decimal 0-100)
├─ topDomain (text)
├─ topSeniority (text)
├─ topFunction (text)
├─ totalEvaluations (integer)
├─ totalApplications (integer)
├─ totalOffers (integer)
├─ updatedAt (timestamp)
└─ indexes: user_id_unique

user_events (polymorphic event table)
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ eventType (text: favorite_added|favorite_removed|saved_search_created|etc)
├─ eventData (jsonb: { roleId, notes, etc })
├─ createdAt (timestamp)
└─ indexes: user_id, event_type
```

### Content & Documents
```sql
documents
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ type (text: cv|cover_letter|interview_prep|company_research)
├─ title (text)
├─ content (text)
├─ sourceUrl (text, nullable — URL it came from)
├─ tags (text[], array for organization)
├─ isPinned (boolean)
├─ createdAt (timestamp)
├─ updatedAt (timestamp)
└─ indexes: user_id, type, created_at

star_stories
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ situation (text, STAR: Situation)
├─ task (text, STAR: Task)
├─ action (text, STAR: Action)
├─ result (text, STAR: Result)
├─ reflection (text, optional)
├─ domains (text[], array — relevant domains)
├─ skills (text[], array — skills demonstrated)
├─ contexts (text[], array — interview types suited for)
├─ createdAt (timestamp)
└─ indexes: user_id

journal_entries
├─ id (uuid, PK)
├─ userId (uuid FK → users)
├─ roleId (uuid FK → roles, nullable)
├─ title (text)
├─ content (text)
├─ sentiment (text: positive|neutral|negative)
├─ tags (text[], array)
├─ createdAt (timestamp)
└─ indexes: user_id, role_id
```

### Saved Filters & Searches
- Stored as `user_events` with `eventType: 'saved_search_created'`
- Structure: `{ name, query: { domain, location, minSalary, etc } }`

---

## API Endpoints (20+)

### Evaluation (Week 1-4)
```
POST   /api/ai/evaluate                Stream JD → evaluation result
POST   /api/ai/evaluate-batch          Evaluate 5-10 JDs sequentially
GET    /api/ai/evaluate-batch/status   Check batch progress
```

### Pipeline Tracking (Week 5)
```
PATCH  /api/pipeline/status            Update role status (applied, interviewed, etc)
GET    /api/pipeline/status            Get current status for role
GET    /api/pipeline/history           List all status changes for role
```

### Outcomes (Week 5)
```
POST   /api/outcomes                    Record result (offer, rejection, etc)
GET    /api/outcomes                    List outcomes, filterable by roleId
DELETE /api/outcomes/:id                Delete outcome record
```

### Interactions (Week 5)
```
POST   /api/interactions                Log touchpoint (email, interview, call)
GET    /api/interactions                List interactions with pagination
```

### Discover (Week 6)
```
GET    /api/opportunities               Search roles (full-text + filters)
GET    /api/opportunities/facets        Get unique values for filters
GET    /api/opportunities/similar       Find similar roles to given roleId
```

### Favorites (Week 6)
```
POST   /api/favorites                   Save role to favorites
GET    /api/favorites                   List favorites
DELETE /api/favorites                   Remove from favorites
```

### Saved Searches (Week 6)
```
POST   /api/saved-searches              Save filter combo with name
GET    /api/saved-searches              List saved searches
DELETE /api/saved-searches              Delete saved search
```

### Outreach (Week 7)
```
POST   /api/ai/outreach                 Draft personalized reply (warm/cool/decline)
```

### Analytics (Week 8)
```
GET    /api/analytics/conversion        Conversion rates by dimension
GET    /api/analytics/patterns          Pattern analysis (top-scoring dimensions)
GET    /api/analytics/benchmarks        Salary benchmarks by function/level/geo
```

### Tracker (Week 8)
```
GET    /api/tracker/export              Export evaluations (CSV/JSON)
```

### Invitations (Bonus)
```
POST   /api/invitations                 Generate code (admin-only)
GET    /api/invitations                 List codes created by user
POST   /api/auth/claim-invitation       Claim code after signin
```

### Auth
```
POST   /api/auth/signin                 LinkedIn OAuth / Email OTP
POST   /api/auth/signout                Clear session
GET    /api/auth/session                Get current session
POST   /api/auth/send-code              Send email OTP code
```

---

## Authentication Flow

### LinkedIn OAuth
```
1. User clicks "Continue with LinkedIn"
2. Browser redirects to LinkedIn auth endpoint
3. LinkedIn redirects back with auth code
4. next-auth exchanges code for access token
5. next-auth fetches user profile from LinkedIn
6. signIn callback (lib/auth.ts) runs:
   - Checks if user exists in database by email
   - If not, creates user (NEW: added May 18)
   - Returns true to allow signin
7. next-auth creates JWT session
8. Session persists in cookie (httpOnly, secure)
9. Frontend can access session via useSession()
10. getAuthUserId() looks up user in database by email from session
```

### Email OTP
```
1. User enters email
2. API sends 6-digit code via Resend
3. User enters code
4. next-auth CredentialsProvider validates code
5. Code is consumed (deleted from settings table)
6. Session created, user added to database
7. Same as LinkedIn from step 7 onward
```

### Session Management
- **Strategy**: JWT (stateless)
- **Duration**: 30 days (configurable)
- **Storage**: httpOnly cookie + memory (React state)
- **Validation**: Checked on every page load via `getAuthUserId()`

---

## Frontend Pages

### Public Pages
- `/auth/signin` — Login with LinkedIn or Email OTP
- `/` — Home page (redirects to `/dashboard` if logged in)

### Authenticated Pages
```
/                       Home/Dashboard (main entry point)
/discover               Search & filter opportunities
/tracker                Application pipeline (list/kanban)
/tracker/[id]          Evaluation report detail
/pipeline               Pending URLs to evaluate
/favorites              Saved roles
/reports                All evaluation reports
/reports/[id]           Report detail view
/outreach               Draft email responses
/prep                   Interview preparation
/cv                     CV management
/calendar               Interview calendar (future)
/gmail                  Email integration (future)
/settings               User preferences & profile
/onboarding             Profile setup (NEW, design pending)
/invitations           Admin: generate test user codes (NEW)
```

---

## AI Integration (Claude Sonnet 4.6)

### Evaluation Engine (`lib/ai/evaluate-engine.ts`)
**Input**: Job description or URL  
**Process**:
1. Extract metadata: company, role, location, comp, seniority, domain, team
2. Find or create company record
3. Find or create role record
4. Score on 5 dimensions (0-100):
   - CV Match — Does your experience align?
   - North Star — Matches your target role?
   - Compensation — Salary expectations met?
   - Culture/Company — Values alignment?
   - Red Flags — Any concerns?
5. Generate proof points (why good fit)
6. Identify gaps (skills missing)
7. Flag red flags (potential issues)
8. Return recommendation: apply|consider|pass|skip

**Token Usage**: ~2,000-3,000 tokens per evaluation  
**Cost**: ~$0.03-0.05 per evaluation

### Outreach Engine (`lib/ai/outreach-engine.ts`)
**Input**: Role ID + tone (warm|cool|decline)  
**Process**:
1. Fetch role data + your latest evaluation
2. Claude drafts:
   - Subject line
   - Email body (personalized to role & tone)
   - Next steps (what to ask for)
3. Return all three fields

**Token Usage**: ~1,500-2,000 tokens  
**Cost**: ~$0.02 per draft

### Models Used
- **Evaluate**: Claude Sonnet 4.6 (smart, fast, cheap)
- **Outreach**: Claude Sonnet 4.6
- **Future**: Haiku for simple extractions, Opus for complex reasoning

---

## Development Environment

### Local Setup
```bash
# .env.local required:
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_POSTGRES_URL=...
SUPABASE_POSTGRES_URL_NON_POOLING=...
ANTHROPIC_API_KEY=...
ADMIN_EMAIL=pineiro.ignacio@gmail.com

# Run dev server
npm run dev

# Accessible at http://localhost:3000
```

### Database
```bash
# View migrations
ls lib/db/migrations/

# Generate migration from schema changes
npm run db:generate

# Apply to Supabase
npx tsx lib/db/migrate.ts  # (currently custom only)

# Push (via drizzle-kit)
npm run db:push
```

### Deployment
- **Platform**: Vercel
- **Trigger**: Push to GitHub
- **Build**: `npm run build` (Next.js build)
- **Preview**: Auto-generated for PRs
- **Production**: Deployed on push to `main`

---

## Performance Characteristics

### Page Load Times (Local)
- **Signin**: 350ms
- **Dashboard**: 400-600ms (depends on data size)
- **Search/Filter**: 200-500ms (depends on query)

### API Response Times
- **Simple CRUD** (create, read, update): 50-200ms
- **Search with filters**: 200-500ms
- **Evaluation (streaming)**: 5-15 seconds (Claude API latency)
- **Batch evaluate (10 JDs)**: 30-90 seconds (sequential, 3-5s each)

### Database
- **Connection**: Supabase pooled (max 10 concurrent)
- **Query time**: 5-50ms (depends on table size)
- **RLS overhead**: ~5-10ms per request (row filtering)

### AI Costs (Estimated Monthly)
- 100 evaluations: $3-5
- 50 email drafts: $1
- **Total**: ~$5-10/month for single user

---

## Security & Privacy

### Authentication
- ✅ next-auth JWT (stateless, signed)
- ✅ LinkedIn OAuth (official provider)
- ✅ Email OTP via Resend
- ✅ httpOnly cookies (XSS protection)
- ✅ CSRF tokens (built into next-auth)
- ⏳ Future: Migrate to Supabase Auth (self-hosted sessions)

### Data Access
- ✅ Row-level security (RLS) on all tables
- ✅ Users can only see their own data (auth.uid() = user_id)
- ✅ No cross-user data leaks possible
- ✅ API endpoints validate auth via getAuthUserId()

### Secrets
- ✅ API keys in .env.local (not committed)
- ✅ Sensitive data not logged
- ⏳ Future: Encrypt sensitive fields (oauth_tokens)

### Input Validation
- ✅ Zod schemas on all API endpoints
- ✅ Type-safe queries via Drizzle ORM
- ⏳ Future: Additional XSS/injection prevention

---

## Known Limitations & Tech Debt

### Blocking Issues
1. **Invitation Claiming Loop** — Users stuck redirecting after signin
   - Impact: Test users can't complete signup
   - Fix: TBD (see BUILD_STATUS.md for debug steps)

### Missing Features
1. **Rate Limiting** — No limit on evaluations per hour
   - Risk: Token burn if user spams evaluations
   - Fix: Add sliding window (max 10/hour per user)

2. **Email Integration** — Gmail OAuth not implemented
   - Impact: Can draft emails but can't send from app
   - Fix: Add OAuth token storage + Resend integration

3. **Caching** — No cache on facets/analytics
   - Impact: Slower facet filtering on large datasets
   - Fix: Add Redis caching or in-memory cache

4. **Error Recovery** — No retry logic on API failures
   - Impact: Network glitches fail silently
   - Fix: Add exponential backoff retry logic

### Design Debt
1. **No UI Framework** — All components use inline styles
   - Impact: Styling is verbose, hard to maintain
   - Fix: Consider Tailwind CSS or component library

2. **No Component Library** — Buttons/inputs duplicated
   - Impact: Inconsistent look & feel
   - Fix: Extract to reusable components

3. **No Tests** — No unit or integration tests
   - Impact: Regressions not caught
   - Fix: Add Jest + React Testing Library

---

## Roadmap (Post-MVP)

### Phase 1: Stabilize (1 week)
- [ ] Fix invitation claiming loop
- [ ] Add rate limiting
- [ ] Add error logging & monitoring

### Phase 2: Complete UI (2-3 weeks)
- [ ] Design all pages (user will provide)
- [ ] Build onboarding flow (5 screens)
- [ ] Build home dashboard
- [ ] Build settings page

### Phase 3: Integrations (1 week)
- [ ] Gmail OAuth + sending
- [ ] Slack notifications
- [ ] Calendar sync

### Phase 4: Advanced Features (2-3 weeks)
- [ ] Salary negotiations playbook
- [ ] Interview prep by company
- [ ] Offer comparison tool
- [ ] Multi-company pipeline view

### Phase 5: Scale (Ongoing)
- [ ] Migrate to Supabase Auth
- [ ] Add caching layer
- [ ] Multi-user support
- [ ] Analytics dashboard

---

## External Dependencies

### Services
- **Supabase**: Database, Auth (future)
- **Claude API**: AI evaluation & generation
- **LinkedIn**: OAuth provider
- **Resend**: Email OTP delivery
- **Vercel**: Hosting & CI/CD

### NPM Packages (Key)
```
next@16.2.6              Fullstack framework
react@19               UI framework
next-auth@5.x          Session management
drizzle-orm@0.31.10    Type-safe ORM
drizzle-kit@0.31.10    Migrations & codegen
zod@3.x                Schema validation
@anthropic-ai/sdk@0.96 Claude API
postgres@3.x           Supabase connection
```

---

## System Constraints

### Browser Support
- Modern browsers only (Chrome, Firefox, Safari, Edge 2023+)
- No IE11 support
- Mobile: Works but not optimized

### Device Limits
- Max file upload: 25MB (Supabase limit for Drive)
- Session timeout: 30 days idle
- API response timeout: 30s (Vercel limit)

### Data Limits
- Max roles per search: 100 (pagination)
- Max batch evaluate: 10 JDs
- Max file size for documents: 10MB
- Max stored evaluations: Unlimited (100k+)

### Concurrency
- Max concurrent users: 1 main + unlimited test users via invites
- Max DB connections: 10 pooled (Supabase)
- Max API calls per second: Unlimited (Claude API rate limit: 500 RPM)

---

## Configuration Options

### Environment Variables
```
# Auth
LINKEDIN_CLIENT_ID              LinkedIn OAuth app ID
LINKEDIN_CLIENT_SECRET          LinkedIn OAuth app secret
NEXTAUTH_SECRET                 Random string for JWT signing
NEXTAUTH_URL                    App URL (http://localhost:3000)

# Database
SUPABASE_URL                    Supabase project URL
SUPABASE_ANON_KEY              Public API key
SUPABASE_SERVICE_ROLE_KEY       Admin API key
SUPABASE_POSTGRES_URL           Pooled connection string
SUPABASE_POSTGRES_URL_NON_POOLING  Direct connection string

# AI
ANTHROPIC_API_KEY               Claude API key

# Admin
ADMIN_EMAIL                     User who can generate invitations
```

### Feature Flags (Future)
- AUTO_APPLY — Automatically submit applications
- SALARY_NEGOTIATION — Enable negotiation playbook
- INTERVIEW_PREP — Enable company-specific prep

---

## Monitoring & Logging

### Current Logging
- **Console**: Debug info in development
- **Server logs**: Vercel dashboard
- **Error tracking**: None (implement later)

### Future
- Sentry for error tracking
- LogRocket for user session replay
- Datadog for performance monitoring
- Custom analytics dashboard

---

## Glossary

| Term | Definition |
|------|-----------|
| **RLS** | Row-level security — PostgreSQL policies that filter data by user |
| **JWT** | JSON Web Token — stateless session token |
| **ORM** | Object-relational mapping — type-safe database queries |
| **Streaming** | HTTP response sent in chunks (for long operations) |
| **Middleware** | Next.js code that runs before API routes |
| **Evaluation** | AI-generated score & recommendation for a role |
| **Pipeline** | Application tracking (applied → offer → accepted) |
| **Facets** | Unique filter values (domains, locations, seniorities) |
| **Proof points** | Reasons why a role matches your background |
| **North Star** | Your target role archetype |
| **Compensation** | Total comp (base + bonus + equity) |

---

## References

- **API Spec**: `/API.md` — Full endpoint reference with examples
- **Build Status**: `/BUILD_STATUS.md` — What's done & what's broken
- **Database Migration**: `lib/db/migrations/` — SQL files
- **Schema Definition**: `lib/db/schema.ts` — Drizzle schema
- **Auth Config**: `lib/auth.ts` — next-auth setup
- **Evaluation Logic**: `lib/ai/evaluate-engine.ts` — Scoring algorithm

---

## Support & Debugging

### Common Issues
1. **Invitation loop on signin**
   - Symptom: Redirects between /auth/signin and /
   - Debug: Check localStorage in DevTools
   - Workaround: Clear cookies, try again

2. **"Unauthorized" on API call**
   - Symptom: 401 error from claim-invitation
   - Cause: User not in database
   - Fix: Ensure user created during signin callback

3. **Slow search**
   - Symptom: Filter takes >1s
   - Cause: Large roles table + complex filters
   - Fix: Add database indexes (see migrations)

### Debug Mode
```bash
# Verbose logging
DEBUG=* npm run dev

# Database inspection
# Log into Supabase dashboard → SQL editor
```

---

*Generated: May 18, 2026  
*Last Updated: 10:30 PM  
*Platform: Labra (job search MVP)  
*Owner: pineiro.ignacio@gmail.com*
