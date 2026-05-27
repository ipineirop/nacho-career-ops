# Changelog

## [1.9.0](https://github.com/ipineirop/nacho-career-ops/compare/v1.8.0...v1.9.0) (2026-05-27)


### Features

* add OpenCode slash commands for career-ops ([#67](https://github.com/ipineirop/nacho-career-ops/issues/67)) ([93caaed](https://github.com/ipineirop/nacho-career-ops/commit/93caaed49cbc9f3214f9beb66fb2281c3f2370e6))
* backfill 22 roles and companies from historical evaluations ([ba5f5dc](https://github.com/ipineirop/nacho-career-ops/commit/ba5f5dc9bfd62bba43c0edf9e74205a023fab47e))
* **brief:** /brief surface end-to-end (schema, engine, API, UI, nav) ([#5](https://github.com/ipineirop/nacho-career-ops/issues/5)) ([813e6aa](https://github.com/ipineirop/nacho-career-ops/commit/813e6aacdd74290ac4ea756b0f786d4475914d94))
* don't-want capture & past-employer matching (Phase A+B) ([37f52f0](https://github.com/ipineirop/nacho-career-ops/commit/37f52f0a23687fc1a74444e35560e0e195bddacd))
* **evaluate+onboarding:** FAB+panel, /evaluate/[id], teaching moment ([7711b44](https://github.com/ipineirop/nacho-career-ops/commit/7711b44e0fd50584ef6df6e5eb4d898f9bc0cd18))
* **evaluate:** modes-driven engine + editorial verdict UI ([3c251f9](https://github.com/ipineirop/nacho-career-ops/commit/3c251f90aa8c5b06d3da394a428b0f4e50921a50))
* evaluations consume stored onboarding profile (was hardcoded) ([dc334a6](https://github.com/ipineirop/nacho-career-ops/commit/dc334a6210e9b0b25c1c7156ae530cfafdc8e81e))
* extract career engine — CV → structured career profile ([db0d707](https://github.com/ipineirop/nacho-career-ops/commit/db0d707fb9ee4122a8cf386a75c6a1db77183616))
* full rewrite of onboarding to match design spec across all 5 screens ([8cb4d10](https://github.com/ipineirop/nacho-career-ops/commit/8cb4d10115025c85f3c9d46530bab266836882c2))
* gate signed-in users into onboarding until completed ([3245570](https://github.com/ipineirop/nacho-career-ops/commit/32455707ce4e5e4614cd7df51d464f7c65116f11))
* implement evaluate engine with Claude scoring and database storage ([3c3bb3a](https://github.com/ipineirop/nacho-career-ops/commit/3c3bb3a30887deed1d53a9ebe282540a88223a04))
* onboarding flow polish — mobile, auth, file upload, role editing ([f25f393](https://github.com/ipineirop/nacho-career-ops/commit/f25f39367e1dde1746e8e76dca7d20d0b2697705))
* persist onboarding to schema + engine-derived archetypes ([5956836](https://github.com/ipineirop/nacho-career-ops/commit/5956836468ac6146c4186be949680278c7e34b30))
* re-translate profile on language toggle, live FX, store archetypes ([f1552c9](https://github.com/ipineirop/nacho-career-ops/commit/f1552c9153a412c0ff23d1daafbf83b12d50657c))
* regenerate CV markdown from structured data ([be826a2](https://github.com/ipineirop/nacho-career-ops/commit/be826a2dd9874e786b0638e4e5a4bbc1f3b0b5db))
* review summary/skills/education in onboarding step 3 ([ac584c9](https://github.com/ipineirop/nacho-career-ops/commit/ac584c9c39d0c8349067e63042d04c42b2253ce7))
* schema rename refactor — dashboard, tracker, pipeline, reports working on Supabase ([c2e83c8](https://github.com/ipineirop/nacho-career-ops/commit/c2e83c80777033c57893b96f09f85188981df9df))


### Bug Fixes

* add data/ fallback to UpdateApplicationStatus ([#55](https://github.com/ipineirop/nacho-career-ops/issues/55)) ([3512b8e](https://github.com/ipineirop/nacho-career-ops/commit/3512b8ef4eb8ca967bc967664f8798af42b58a52))
* add null checks for cvSignals in data section rendering ([2f7ea0e](https://github.com/ipineirop/nacho-career-ops/commit/2f7ea0e80a8c307014581590ddf471f02e93d376))
* add nullish coalescing for cvSignals to satisfy TypeScript ([f32ca5e](https://github.com/ipineirop/nacho-career-ops/commit/f32ca5eb5e7683760a101271ca42915a03ca377e))
* bump CV parsing route maxDuration to 300s ([feda4e1](https://github.com/ipineirop/nacho-career-ops/commit/feda4e12fbf26569eb162a97216d6730a1579788))
* comp number formatting + engine output language ([f6fbe60](https://github.com/ipineirop/nacho-career-ops/commit/f6fbe6073bd0719b95865959117e8bd1c0305521))
* don't accumulate duplicate comp target rows on re-onboarding ([b0a4a1f](https://github.com/ipineirop/nacho-career-ops/commit/b0a4a1f5a90d684549d43287cd8ef49cda05deea))
* **evaluate:** a fetched URL is a posting, not a DM, for the verdict word ([f18c615](https://github.com/ipineirop/nacho-career-ops/commit/f18c6156a651497b3f25d9e0694aebedcadc82d2))
* **evaluate:** fetch URL content before evaluating; surface real errors ([4cb4dca](https://github.com/ipineirop/nacho-career-ops/commit/4cb4dcab02a0a9a2b2151e8011bde34ba662b28c))
* **evaluate:** load modes from filesystem, not GitHub API (was 401) ([f394c39](https://github.com/ipineirop/nacho-career-ops/commit/f394c3920f1d6d9ed30f5d0cb0562c7b94c9f93b))
* filter expired WebSearch links before they reach the pipeline ([#57](https://github.com/ipineirop/nacho-career-ops/issues/57)) ([ce1c5a3](https://github.com/ipineirop/nacho-career-ops/commit/ce1c5a3c7eea6ebce2c90aebba59d6e26b790d3f))
* invitation redirect loop, add rate limiting, fix auth migrations ([b84c0ce](https://github.com/ipineirop/nacho-career-ops/commit/b84c0ce5d33d12eb202ebaab53e05fe3d1455327))
* onboarding gate checks user_profiles.cv_markdown (authoritative) ([efe7331](https://github.com/ipineirop/nacho-career-ops/commit/efe7331b526fcad8a734ec7cdc758e3950b4b428))
* onboarding step 4 — scroll jump, hardcoded data, comp basis, JD jargon ([2a6c5c2](https://github.com/ipineirop/nacho-career-ops/commit/2a6c5c221fa9f14dbe09ee15f7ff7630ae52c62f))
* reduce evaluate-batch maxDuration to 300s for Vercel hobby plan ([b024542](https://github.com/ipineirop/nacho-career-ops/commit/b0245428ee04f079c20a0fa0e2e21c6f0013284e))
* remove dead Step 2 review block ([f9aba8f](https://github.com/ipineirop/nacho-career-ops/commit/f9aba8f1da96c6ff3366e63e11cc73116d0b4d47))
* show Step 2 immediately on resume upload, animate rows sequentially while API parses ([8a436c8](https://github.com/ipineirop/nacho-career-ops/commit/8a436c84ad829bdc8bbc87dc683e768602378815))
* smooth, atomic language transition on the step-5 read ([38717e0](https://github.com/ipineirop/nacho-career-ops/commit/38717e06ec2b1e89c4667d93c4b82ec2368982d9))
* split CV parse from synthesis to stop 504s; derive country globally ([3f0af55](https://github.com/ipineirop/nacho-career-ops/commit/3f0af55e086b9217a24197152c84803c2c218bcc))
* Step 2 shows loading spinner while parsing, then animation with REAL extracted data ([7bcf78f](https://github.com/ipineirop/nacho-career-ops/commit/7bcf78f94aa8d066c5f8e5ee7b2c3f3444e19619))
* Step 2 uses REAL extracted data, no loop, CTA appears after animation completes ([b21cae7](https://github.com/ipineirop/nacho-career-ops/commit/b21cae7f215f3f651f1899b0205e5c8f866327dd))
* surface all captured profile data to the evaluator ([d9e7d21](https://github.com/ipineirop/nacho-career-ops/commit/d9e7d213d3ed5083d856c23bb79d82495414d017))
* use fileURLToPath for cross platform compatible paths in tracker scripts ([#32](https://github.com/ipineirop/nacho-career-ops/issues/32)) ([#58](https://github.com/ipineirop/nacho-career-ops/issues/58)) ([ab77510](https://github.com/ipineirop/nacho-career-ops/commit/ab775102f4586ae4663a593b519927531be27122))
* **verdict:** center the reading column + clean gap rendering ([9842761](https://github.com/ipineirop/nacho-career-ops/commit/9842761f323b17fa70d7bdca0617b782d8ed9f96))
