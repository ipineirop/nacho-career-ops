-- Legacy tracker/reports table `applications` and scanner `jobs` are retired.
-- Reports now read evaluations+roles; the scanner writes roles (source='scan').
-- `applications` data was fully mirrored in `evaluations` (verified, 0 missing);
-- `jobs` was empty.
DROP TABLE IF EXISTS "applications";--> statement-breakpoint
DROP TABLE IF EXISTS "jobs";
