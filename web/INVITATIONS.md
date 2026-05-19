# Test User Invitation System

This system allows you (the admin) to generate invitation codes that test users can use to sign up and access the platform.

## How it Works

### 1. Generate Codes (Admin Only)

Visit `/invitations` (you must be authenticated with the admin email: `ADMIN_EMAIL` env var, defaults to `pineiro.ignacio@gmail.com`)

- Fill in optional "Notes" (e.g., "For Jane Doe")
- Set expiry days (default: 30)
- Click "Generate Code"

Each code is a 24-character alphanumeric format: `ABC-DEF-GHI-JKL`

### 2. Share Invitation Link

After generating a code, click "Copy Link" to copy the signup URL:
```
https://your-app.com/auth/signin?code=ABC-DEF-GHI-JKL
```

Share this link with test users.

### 3. Test User Signs Up

When a test user visits the link:
- They see a message: ✓ Signing up with invitation code ABC-***
- They sign in via LinkedIn or Email OTP (same normal flow)
- After authentication, the code is automatically claimed
- They're redirected to the home page

### 4. Manage Codes

View all codes you've generated on `/invitations`:
- **Status**: active | claimed | expired
- **Expires**: date of expiration
- **Claimed By**: email of the user who claimed it (if claimed)
- **Notes**: optional notes you added

## API Endpoints

### Generate Code (Admin Only)
```bash
POST /api/invitations
Authorization: Required (admin email)

{
  "expiryDays": 30,
  "notes": "optional"
}

Response:
{
  "success": true,
  "data": {
    "code": "ABC-DEF-GHI-JKL",
    "expiresAt": "2026-06-18T...",
    "shareUrl": "https://app/auth/signin?code=ABC-DEF-GHI-JKL"
  }
}
```

### List Codes (User's Own Codes)
```bash
GET /api/invitations
Authorization: Required

Response:
{
  "success": true,
  "data": [
    {
      "code": "ABC-DEF-GHI-JKL",
      "status": "claimed",
      "expiresAt": "2026-06-18T...",
      "claimedBy": "jane@example.com",
      "claimedAt": "2026-05-19T12:00:00Z",
      "createdAt": "2026-05-18T10:00:00Z",
      "notes": "For Jane Doe"
    }
  ]
}
```

### Claim Code (Internal - Called During Signup)
```bash
POST /api/auth/claim-invitation
Authorization: Required

{
  "code": "ABC-DEF-GHI-JKL"
}

Response:
{
  "success": true,
  "data": {
    "invitationId": "uuid",
    "code": "ABC-DEF-GHI-JKL",
    "claimedAt": "2026-05-18T..."
  }
}
```

## Environment Variables

```
ADMIN_EMAIL=pineiro.ignacio@gmail.com
```

If not set, defaults to `pineiro.ignacio@gmail.com`

## Security

- ✅ Only the admin can generate codes (POST /api/invitations is admin-only)
- ✅ Admin can only see their own generated codes (GET /api/invitations filters by createdBy)
- ✅ Codes are unique and validated before claiming
- ✅ Expired codes are automatically marked as `expired`
- ✅ Already-claimed codes cannot be claimed again
- ✅ Revoked codes cannot be claimed

## Testing

1. **As admin:**
   - Go to `/invitations`
   - Generate a code with some notes
   - Copy the link

2. **As test user (new browser / incognito):**
   - Visit the copied link
   - You'll see the invitation context on the signin page
   - Sign in via LinkedIn or Email OTP
   - After auth, code is auto-claimed
   - You're redirected to home page

3. **Back as admin:**
   - Refresh `/invitations`
   - Code status should now be "claimed"
   - "Claimed By" should show the test user's email

## Implementation Details

- **Table**: `invitations` (PostgreSQL/Supabase)
- **Admin Check**: `ADMIN_EMAIL` environment variable (defaults to your email)
- **Flow**: 
  1. User visits `/auth/signin?code=ABC...`
  2. Code stored in localStorage
  3. User signs in (LinkedIn/Email OTP)
  4. useEffect detects session + code
  5. Calls `POST /api/auth/claim-invitation`
  6. Code marked as claimed
  7. Redirects to home page
- **Files Modified**:
  - `app/api/invitations/route.ts` — Added admin check
  - `app/api/auth/claim-invitation/route.ts` — New endpoint
  - `app/auth/signin/page.tsx` — Integration with invitation flow
  - `app/invitations/page.tsx` — Admin dashboard (NEW)
