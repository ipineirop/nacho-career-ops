// Run: npx tsx --test lib/matching/matching.test.ts   (from web/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompany } from './normalize';
import { resolveCompany } from './resolve';
import { matchPastEmployer, type UserEmployer } from './past-employer';

test('normalize: lowercase + diacritics + geographic suffix', () => {
  assert.equal(normalizeCompany('Rappi México'), 'rappi');
  assert.equal(normalizeCompany('RAPPI COLOMBIA'), 'rappi');
});

test('normalize: corporate suffix + punctuation', () => {
  assert.equal(normalizeCompany('Rappi, Inc.'), 'rappi');
  assert.equal(normalizeCompany('Grupo Bimbo S.A. de C.V.'), 'grupo bimbo');
});

test('normalize: keeps intra-name hyphens', () => {
  assert.equal(normalizeCompany('Well-Being Co'), 'well-being co');
});

test('normalize: does NOT strip business-line tokens', () => {
  assert.equal(normalizeCompany('Rappi Pay'), 'rappi pay');
  assert.equal(normalizeCompany('Rappi Capital'), 'rappi capital');
});

test('normalize: revert-if-empty edge (Inc. alone)', () => {
  assert.equal(normalizeCompany('Inc.'), 'inc');
});

test('resolve: alias hit is high confidence', () => {
  const r = resolveCompany('Rappi');
  assert.equal(r.resolved_canonical_id, 'rappi');
  assert.equal(r.resolved_confidence, 'high');
});

test('resolve: geographic-suffixed alias still resolves', () => {
  assert.equal(resolveCompany('Rappi México').resolved_canonical_id, 'rappi');
});

test('resolve: business-line entity resolves distinctly from parent', () => {
  assert.equal(resolveCompany('Rappi Pay').resolved_canonical_id, 'rappi_pay');
});

test('resolve: Uber Eats LatAm resolves via alias', () => {
  const r = resolveCompany('Uber Eats LatAm');
  assert.equal(r.resolved_canonical_id, 'uber_eats_latam');
  assert.equal(r.resolved_confidence, 'high');
});

test('resolve: unknown company is unresolved', () => {
  const r = resolveCompany('Rappido');
  assert.equal(r.resolved_canonical_id, null);
  assert.equal(r.resolved_confidence, 'none');
});

test('past-employer: direct high-confidence match surfaces', () => {
  const employers: UserEmployer[] = [
    { canonical_id: 'kavak', display_name: 'Kavak', startedAt: '2021', endedAt: '2024' },
  ];
  const m = matchPastEmployer(resolveCompany('Kavak'), employers);
  assert.equal(m.matches_user_past_employer, true);
  assert.equal(m.surface, true);
  assert.equal(m.matches_via?.relation, 'direct');
  assert.equal(m.matches_via?.date_range, '2021–2024');
});

test('past-employer: no match when company not in history', () => {
  const employers: UserEmployer[] = [
    { canonical_id: 'kavak', display_name: 'Kavak', startedAt: '2021', endedAt: '2024' },
  ];
  const m = matchPastEmployer(resolveCompany('Rappi'), employers);
  assert.equal(m.matches_user_past_employer, false);
  assert.equal(m.surface, false);
});

// §Appendix trace: Marina at Cornershop '18–'21, role at Uber Eats LatAm.
test('past-employer: acquisition lineage matches but stays silent in v1', () => {
  const employers: UserEmployer[] = [
    { canonical_id: 'cornershop', display_name: 'Cornershop', startedAt: '2018', endedAt: '2021' },
    { canonical_id: 'kavak', display_name: 'Kavak', startedAt: '2021', endedAt: '2024' },
  ];
  const m = matchPastEmployer(resolveCompany('Uber Eats LatAm'), employers);
  assert.equal(m.matches_user_past_employer, true);
  assert.equal(m.matches_via?.relation, 'acquisition_lineage');
  assert.equal(m.matches_via?.past_employer_display, 'Cornershop');
  // §3.1.1: lineage matches are logged, not surfaced, in v1.
  assert.equal(m.surface, false);
});

test('past-employer: lineage does NOT match if user joined after acquisition', () => {
  const employers: UserEmployer[] = [
    { canonical_id: 'cornershop', display_name: 'Cornershop', startedAt: '2022', endedAt: '2024' },
  ];
  const m = matchPastEmployer(resolveCompany('Uber Eats LatAm'), employers);
  assert.equal(m.matches_user_past_employer, false);
});
