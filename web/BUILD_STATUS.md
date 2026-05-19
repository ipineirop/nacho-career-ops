# Labra Build Status — May 18, 2026

## What's Complete

### 1. Test User Invitation System ✅
**Purpose**: Allow you (admin) to generate invitation codes that test users can use to sign up.

#### Implemented
- **Admin Dashboard** (`/invitations`)
  - Generate codes with custom expiry (1-365 days)
  - Optional notes (e.g., "For Jane Doe")
  - View all generated codes with status (active|claimed|expired)
  - See who claimed each code and when
  - Copy shareable signup links to clipboard

#### Database Schema
- **Table**: `invitations` (Supabase PostgreSQL)
  - `id` (uuid, PK)
  - `code` (text, unique, 24-char alphanumeric: ABC-DEF-GHI-JKL)
  - `createdBy` (uuid FK to users)
  - `claimedBy` (uuid FK to users, nullable)
  - `expiresAt` (timestamp)
  - `claimedAt` (timestamp, nullable)
  - `status` (text: active|claimed|expired|revoked)
  - `notes` (text, optional)
  - `createdAt` (timestamp, default now)
  - **Indexes**: code (unique), createdBy, claimedBy

#### API Endpoints
1. **POST /api/invitations** (Admin-only)
   - Generate new invitation code
   - Requires: `ADMIN_EMAIL` env var to match authenticated user
   - Input: `{ expiryDays?: number, notes?: string }`
   - Output: `{ code, expiresAt, shareUrl }`

2. **GET /api/invitations** (Authenticated)
   - List codes created by authenticated user
   - Filters by `createdBy = authUser.id`
   - Output: array of invitation objects with full details

3. **POST /api/auth/claim-invitation** (Authenticated)
   - Claims an invitation code for authenticated user
   - Input: `{ code: string }`
   - Output: `{ invitationId, code, claimedAt }`
   - Validations:
     - Code exists
     - Code not expired
     - Code status is 'active'
     - Code not already claimed

#### Frontend Pages
1. **`/invitations`** (Admin Dashboard)
   - Protected: redirects unauthenticated users to signin
   - Shows form to generate codes
   - Shows table of all user's codes
   - Copy-to-clipboard for shareable URLs
   - Code status displays (active/claimed/expired)

2. **`/auth/signin`** (Updated with invitation support)
   - Detects `?code=ABC-DEF` in URL
   - Stores code in localStorage before OAuth
   - After signin, attempts to claim code
   - **ISSUE**: Currently in redirect loop (see Known Issues)

#### File Locations
- **API**: `app/api/invitations/route.ts`, `app/api/auth/claim-invitation/route.ts`
- **Frontend**: `app/invitations/page.tsx`, `app/auth/signin/page.tsx`
- **Schema**: `lib/db/schema.ts` (invitations table definition)
- **Database Migration**: `lib/db/migrations/0001_dry_night_thrasher.sql` ✅ Applied
- **Docs**: `INVITATIONS.md`

#### Environment Variables
```
ADMIN_EMAIL=pineiro.ignacio@gmail.com  # Controls who can generate codes
```

---

## Known Issues 🚨

### Invitation Claiming Loop
**Status**: Blocking test user flow
**Symptom**: After signin, user is stuck in redirect loop between `/auth/signin` and home
**Root Cause**: Under investigation
  - Possibly: Session not available when claiming code
  - Possibly: Redirect middleware loop
  - Possibly: User not found in database after signin

**Latest Attempted Fixes**:
1. Auto-create user in database on signin (via `lib/auth.ts` callback)
2. Continue redirect to home even if claim fails
3. Store code in localStorage to persist through OAuth

**Next Steps to Debug Tomorrow**:
1. Add console logging to signin page to check:
   - `session` object availability
   - localStorage code persistence
   - API response from claim-invitation
2. Check if user is being created in database on LinkedIn signin
3. Verify getAuthUserId() is working correctly
4. Check if there's a redirect middleware causing loop
5. Consider skipping auto-claim and just let users access app (claim code later)

---

## Completed Core Features (Weeks 1-8)

### Week 1-4: Foundation ✅
- Schema with 23 tables (Supabase)
- Auth bridge (next-auth → Supabase)
- Error handling & logging
- Evaluation engine (Claude AI)
- Outreach engine (email draft generation)

### Week 5-6: Tracker & Discover ✅
- Pipeline status CRUD
- Outcomes tracking
- Interactions history
- Favorites management
- Faceted search
- Similar opportunities
- Bulk evaluate
- Saved searches
- Tracker export (CSV/JSON)

### Week 7-8: Outreach & Insights ✅
- Draft personalized replies (warm/cool/decline)
- Conversion rate analytics
- Pattern analysis (by domain, seniority, etc.)
- Salary benchmarks
- Batch evaluation (up to 10 JDs at once)

### Bonus: Invitations ✅
- Admin code generation
- Shareable signup links
- Automatic code claiming

---

## What's NOT Done (Next Phase)

### 1. Onboarding UI (Blocked - Waiting for Design)
- 5-screen onboarding flow
- User profile completion
- CV upload
- Preferences/archetypes selection
- **Status**: Design file expected from user

### 2. Infrastructure Gaps
- Rate limiting (max 10 evals/hour per user)
- Gmail integration (OAuth + sending)
- Input sanitization (beyond Zod)
- Request logging/audit trail
- Caching for facets/analytics endpoints
- Error recovery with retry logic

### 3. Dashboard/Navigation
- Home page showing user's evaluations
- Navigation between all features
- User profile page
- Settings page

---

## Database & Migrations

### Current State
- **23 tables** defined in `lib/db/schema.ts`
- **2 migrations** applied:
  1. `0000_puzzling_frightful_four.sql` — Initial schema
  2. `0001_dry_night_thrasher.sql` — Added invitations table

### To Run Migrations
```bash
# Generate new migrations from schema changes
npm run db:generate

# Apply to Supabase (needs env vars configured correctly)
SUPABASE_POSTGRES_URL_NON_POOLING="postgres://..." npx tsx run_migration.mts
```

---

## Testing

### What Works ✅
- Generate invitation codes from `/invitations`
- View/copy shareable links
- Create users via LinkedIn OAuth
- User creation in database (via auth callback)
- All API endpoints (evaluated with Postman)

### What's Broken 🔴
- Invitation claiming after signin (redirect loop)

### How to Test (Once Fixed)
1. Go to `/invitations`
2. Generate code → copy link
3. Open in incognito browser
4. Visit link → should see invitation context
5. Sign in via LinkedIn
6. Should redirect to home
7. Back to `/invitations` → code shows as "claimed"

---

## Code Quality

### Build Status
✅ **Compilation**: Next.js builds successfully
✅ **TypeScript**: No type errors
✅ **Syntax**: All endpoints functional

### Fixed During Session
- Drizzle query chaining errors (interactions, outcomes, opportunities routes)
- React useEffect async handling (evaluate page)
- SQL template literal types
- Import paths

---

## For Tomorrow's Design Work

### Pages You'll Design For
1. **Home/Dashboard** — Shows user's evaluations, recent activity, quick stats
2. **Onboarding Flow** (5 screens) — User profile, CV, preferences
3. **Evaluation Report** — Results of AI analysis
4. **Tracker/Pipeline** — Kanban or table view of applications
5. **Settings** — Profile, preferences, notifications

### Design Handoff Format
- **Preferred**: PDF (easy to view)
- **Alternative**: Canva link, PPTX, HTML zip
- **What I need**: Component specs, color palette, typography, interaction patterns

### API Integration Notes
- All endpoints return JSON with `{ success, data, error }` structure
- Streaming responses for long AI operations (evaluate, batch)
- Authentication: Next-auth JWT in session

---

## Next Session Checklist

### Fix Invitation Loop (Priority 1)
- [ ] Debug session availability in signin page
- [ ] Check user creation on LinkedIn signin
- [ ] Add logging to claim-invitation endpoint
- [ ] Test with fresh incognito session

### Once Working (Priority 2)
- [ ] Onboarding flow (when design ready)
- [ ] Dashboard home page
- [ ] Rate limiting

### Nice to Have
- [ ] Manual code entry on signin
- [ ] Better error messages
- [ ] Caching for analytics

---

## Contact & Access

- **Local dev**: `http://localhost:3000`
- **Admin dashboard**: `/invitations` (requires login as ADMIN_EMAIL)
- **Signin**: `/auth/signin`
- **Database**: Supabase PostgreSQL (env vars in .env.local)
- **Git branch**: `schema-rename-refactor`

**Current user email**: pineiro.ignacio@gmail.com (admin)

---

*Last updated: May 18, 2026, 10:30 PM*
