# Labra API Reference

Base URL: `http://localhost:3000/api`

All endpoints require authentication (user must be logged in via LinkedIn OAuth).

---

## Pipeline Status Management

### Update/Create Pipeline Status
**PATCH** `/pipeline/status`

Update the status and metadata of a role in the pipeline.

**Request:**
```json
{
  "roleId": "uuid",
  "status": "applied|interviewed|offer|accepted|rejected|withdrawn|passed",
  "appliedAt": "2026-05-18T12:00:00Z", // optional
  "notesMarkdown": "Interview scheduled for Friday", // optional
  "followUpDueAt": "2026-05-20T09:00:00Z" // optional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "roleId": "uuid",
    "status": "applied",
    "statusChangedAt": "2026-05-18T12:00:00Z",
    "appliedAt": "2026-05-18T12:00:00Z",
    "notesMarkdown": "Interview scheduled for Friday",
    "followUpDueAt": "2026-05-20T09:00:00Z",
    "lastTouchAt": "2026-05-18T12:00:00Z"
  }
}
```

### Get Pipeline Status
**GET** `/pipeline/status?roleId=<uuid>`

Retrieve the current pipeline status for a specific role.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "applied",
    ...
  }
}
```

---

## Discover: Opportunities

### Search & Filter Opportunities
**GET** `/opportunities?q=&domain=&location=&minScore=&limit=&offset=`

Search the backfilled opportunities with filters and pagination.

**Query Parameters:**
- `q` (string, optional) — Full-text search on role title, company name, team description
- `domain` (string, optional) — Filter by domain (e.g., "fintech", "marketplace")
- `location` (string, optional) — Filter by location (e.g., "Mexico City", "Remote")
- `remotePolicy` (string, optional) — Filter by `remote|hybrid|onsite`
- `seniorityLevel` (string, optional) — Filter by seniority level
- `minScore` (number, optional) — Minimum evaluation score (0-100)
- `maxScore` (number, optional) — Maximum evaluation score (0-100)
- `minCompUsd` (number, optional) — Minimum comp in USD
- `maxCompUsd` (number, optional) — Maximum comp in USD
- `limit` (number, default 20) — Results per page (max 100)
- `offset` (number, default 0) — Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyName": "Stori",
      "roleTitle": "Head of Operations",
      "domain": "fintech",
      "location": "Mexico City",
      "remotePolicy": "hybrid",
      "seniorityLevel": "director",
      "compRangeLow": 1500000,
      "compRangeHigh": 2000000,
      "compCurrency": "MXN",
      ...
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Available Filters
**GET** `/opportunities/facets`

Get all unique values for filter dropdowns (domains, locations, seniority levels, etc).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "domains": ["fintech", "marketplace", "saas", "healthtech"],
    "locations": ["Mexico City", "Remote", "New York", "São Paulo"],
    "seniorityLevels": ["director", "head_of", "vp", "c_level"],
    "remotePolicies": ["remote", "hybrid", "onsite"],
    "companies": ["Stori", "Rappi", "Clip", "Konko AI"]
  }
}
```

### Find Similar Opportunities
**GET** `/opportunities/similar?roleId=<uuid>&limit=10`

Find roles similar to one you're interested in (same domain, level, location).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyName": "Clip",
      "roleTitle": "Chief Operating Officer",
      "domain": "fintech",
      "location": "Mexico City",
      "seniorityLevel": "head_of",
      "remotePolicy": "hybrid"
    }
  ]
}
```

---

## Favorites

### Save a Role
**POST** `/favorites`

Save a role you want to revisit.

**Request:**
```json
{
  "roleId": "uuid",
  "notes": "Interesting founder, will follow up next week" // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "eventType": "favorite_added",
    "eventData": {
      "roleId": "uuid",
      "notes": "..."
    }
  }
}
```

### Get Favorites
**GET** `/favorites?limit=50&offset=0`

Retrieve all saved roles.

### Remove from Favorites
**DELETE** `/favorites?roleId=<uuid>`

---

## Batch Evaluate

### Evaluate Multiple Roles
**POST** `/ai/evaluate-batch`

Submit 5-10 JDs/URLs for evaluation (sequentially to avoid rate limits).

**Request:**
```json
{
  "evaluations": [
    {
      "jd": "We're hiring a Head of Ops at Stori...",
      "url": "https://..." // optional
    },
    {
      "jd": "Join Clip as Director of Operations...",
      "url": "https://..."
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "results": [
    {
      "index": 0,
      "success": true,
      "data": {
        "roleId": "uuid",
        "evaluationId": "uuid",
        "score": 4.2,
        "recommendation": "apply",
        "summary": "Strong fit but ask about equity..."
      }
    }
  ],
  "errors": [] // Only if some failed
}
```

---

## Saved Searches

### Create Saved Search
**POST** `/saved-searches`

Save a search query for quick re-use.

**Request:**
```json
{
  "name": "Mexico fintech ops roles",
  "query": {
    "domain": "fintech",
    "location": "Mexico",
    "seniorityLevel": "director",
    "minCompUsd": 100000
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Mexico fintech ops roles",
    "query": { ... },
    "createdAt": "2026-05-18T12:00:00Z"
  }
}
```

### Get All Saved Searches
**GET** `/saved-searches`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Mexico fintech ops roles",
      "query": { ... },
      "createdAt": "2026-05-18T12:00:00Z"
    }
  ]
}
```

### Delete Saved Search
**DELETE** `/saved-searches?id=<uuid>`

---

## Outreach

### Draft a Response
**POST** `/ai/outreach`

Generate a personalized reply to a recruiter (warm/cool/decline).

**Request:**
```json
{
  "roleId": "uuid",
  "tone": "warm|cool|decline"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "roleId": "uuid",
    "tone": "warm",
    "subject": "Excited about the Head of Ops role at Stori",
    "body": "Hi [Name],\n\nThank you for thinking of me for the Head of Ops role at Stori...",
    "nextSteps": "Request a call with the CEO to discuss equity and team structure"
  }
}
```

---

## Analytics & Insights

### Conversion Rates
**GET** `/analytics/conversion`

Get conversion rates by domain, seniority, location, remote policy.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalEvaluations": 42,
      "totalApplications": 18,
      "totalOffers": 3,
      "conversionRate": "16.7"
    },
    "byDomain": {
      "fintech": {
        "total": 20,
        "applications": 10,
        "offers": 2
      }
    }
  }
}
```

### Patterns Analysis
**GET** `/analytics/patterns`

Identify which archetypes, domains, levels match best (by avg score).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "domain": [
      {
        "dimension": "domain",
        "value": "fintech",
        "count": 20,
        "avgScore": 78.5,
        "topRecommendation": "apply"
      }
    ],
    "seniorityLevel": [
      {
        "value": "director",
        "count": 15,
        "avgScore": 82.3,
        "topRecommendation": "apply"
      }
    ]
  }
}
```

### Salary Benchmarks
**GET** `/analytics/benchmarks?function=operations&level=director&geo=mexico`

Comp benchmarks by function, level, geography, domain.

**Query Parameters:**
- `function` — Filter by function (e.g., "operations", "engineering")
- `level` — Filter by seniority level (e.g., "director", "head_of")
- `geo` — Filter by geography (e.g., "mexico", "latam")
- `domain` — Filter by domain (e.g., "fintech", "marketplace")

**Response (200):**
```json
{
  "success": true,
  "source": "user_data|market_signals",
  "data": [
    {
      "segment": "operations > director > Mexico City",
      "medianCompUsd": 150000,
      "p25CompUsd": 120000,
      "p75CompUsd": 180000,
      "sampleSize": 12,
      "confidenceLevel": "medium"
    }
  ]
}
```

---

## Evaluation

### Evaluate a Role
**POST** `/ai/evaluate`

Submit a recruiter DM, job description, or URL for evaluation by Claude.

**Request:**
```json
{
  "jd": "Hi! We're hiring a Head of Ops at Stori...",
  "url": "https://careers.stori.com/jobs/head-of-ops" // optional
}
```

**Response (200):**
Streams plain text (markdown) evaluation. Use streaming response handling.

---

## Outcomes

### Record an Outcome
**POST** `/outcomes`

Store the result of a role (offer, rejection, ghost, etc).

**Request:**
```json
{
  "roleId": "uuid",
  "outcomeType": "offer|rejection|ghost|withdrawn|accepted|negotiated",
  "offerBaseUsd": 150000, // optional
  "offerTotalUsd": 200000, // optional
  "offerCurrency": "USD", // optional
  "negotiatedDeltaPct": 15, // optional (percentage increase)
  "rejectionReason": "Chose internal candidate", // optional
  "notesMarkdown": "Great interview but ghosted after final round" // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "roleId": "uuid",
    "outcomeType": "offer",
    "occurredAt": "2026-05-18T12:00:00Z",
    "offerBaseUsd": 150000,
    "offerTotalUsd": 200000,
    "offerCurrency": "USD"
  }
}
```

### Get Outcomes
**GET** `/outcomes?roleId=<uuid>`

Retrieve outcomes for user or specific role.

---

## Interactions

### Log an Interaction
**POST** `/interactions`

Record every touchpoint (email, interview scheduled, offer call, etc).

**Request:**
```json
{
  "roleId": "uuid",
  "type": "application|interview|email|recruiter_dm|offer|rejection",
  "direction": "inbound|outbound", // optional
  "description": "Phone screening with hiring manager", // optional
  "sentiment": "positive|neutral|negative", // optional
  "metadata": { // optional
    "interviewer": "Jane Smith",
    "duration_minutes": 45
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "roleId": "uuid",
    "type": "interview",
    "direction": "inbound",
    "occurredAt": "2026-05-18T12:00:00Z",
    "description": "Phone screening with hiring manager",
    "sentiment": "positive"
  }
}
```

### Get Interaction History
**GET** `/interactions?roleId=<uuid>&limit=50&offset=0`

Retrieve all interactions for user or specific role.

---

## Tracker Export

### Export Evaluations
**GET** `/tracker/export?format=csv`

Download all evaluations with scores, status, outcomes as CSV or JSON.

**Query Parameters:**
- `format` — `csv` (default) or `json`

**Response:**
- `format=csv`: Downloads CSV file with columns: Date, Company, Role, Score, Status, Offer, Outcome, etc.
- `format=json`: Returns JSON array of evaluations

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "roleId": "Invalid UUID format"
  }
}
```

### HTTP Status Codes
- `200` — Success
- `400` — Validation error
- `401` — Unauthorized (not logged in)
- `403` — Forbidden (no permission)
- `404` — Not found
- `409` — Conflict (e.g., duplicate pipeline entry)
- `429` — Rate limited
- `500` — Internal server error

---

## Example Workflows

### Evaluate and Track
1. `POST /api/ai/evaluate` — Submit recruiter DM
2. `PATCH /api/pipeline/status` — Mark as "applied"
3. Track follow-ups with `notesMarkdown` and `followUpDueAt`

### Discover and Apply
1. `GET /api/opportunities?domain=fintech&location=Mexico` — Search backfilled roles
2. For each interesting role, `POST /api/ai/evaluate` to get a score
3. `PATCH /api/pipeline/status` to track your application
