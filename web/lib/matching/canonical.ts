// Canonical company table loader (spec §2.2 / §4.4).
// YAML is the editable source of truth; this module loads + validates it once
// and exposes in-memory indexes keyed by normalized alias and by normalized
// acquisition-lineage `was` name.

import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { normalizeCompany } from './normalize';

export type EntityRelation = 'subsidiary' | 'parent' | 'spinout';

export interface RelatedEntity {
  canonical_id: string;
  relation: EntityRelation;
}

export interface AcquisitionLineageEntry {
  was: string;
  until: number; // year
}

export interface CanonicalCompany {
  canonical_id: string;
  display_name: string;
  country_primary?: string;
  country_present_in?: string[];
  industry_tags?: string[];
  stage?: string;
  aliases: string[];
  related_entities: RelatedEntity[];
  acquisition_lineage: AcquisitionLineageEntry[];
  notes?: string;
  last_updated?: string;
  source?: string;
}

// The YAML may be either a top-level list of companies or an object with a
// `companies:` key. Both are accepted.
type CanonicalFile = CanonicalCompany[] | { companies: CanonicalCompany[] };

interface CanonicalIndex {
  byId: Map<string, CanonicalCompany>;
  // normalized alias -> canonical_id
  aliasIndex: Map<string, string>;
  // normalized lineage `was` name -> [{ canonical_id of the successor, until }]
  lineageIndex: Map<string, Array<{ canonical_id: string; until: number }>>;
}

function buildIndex(companies: CanonicalCompany[]): CanonicalIndex {
  const byId = new Map<string, CanonicalCompany>();
  const aliasIndex = new Map<string, string>();
  const lineageIndex = new Map<string, Array<{ canonical_id: string; until: number }>>();

  for (const c of companies) {
    if (!c.canonical_id) continue;
    if (byId.has(c.canonical_id)) {
      console.warn(`[canonical] duplicate canonical_id "${c.canonical_id}" — keeping first`);
      continue;
    }
    byId.set(c.canonical_id, c);

    for (const alias of c.aliases ?? []) {
      // YAML is untyped: an alias like `99` parses as a number — coerce.
      const norm = normalizeCompany(String(alias));
      if (!norm) continue;
      const existing = aliasIndex.get(norm);
      if (existing && existing !== c.canonical_id) {
        console.warn(
          `[canonical] alias collision: "${alias}" (${norm}) maps to both "${existing}" and "${c.canonical_id}" — keeping first`
        );
        continue;
      }
      aliasIndex.set(norm, c.canonical_id);
    }

    for (const lin of c.acquisition_lineage ?? []) {
      const norm = normalizeCompany(String(lin.was));
      if (!norm) continue;
      const list = lineageIndex.get(norm) ?? [];
      list.push({ canonical_id: c.canonical_id, until: lin.until });
      lineageIndex.set(norm, list);
    }
  }

  return { byId, aliasIndex, lineageIndex };
}

let _index: CanonicalIndex | null = null;

function loadIndex(): CanonicalIndex {
  if (_index) return _index;
  const raw = readFileSync(new URL('./canonical-companies.yaml', import.meta.url), 'utf8');
  const parsed = yaml.load(raw) as CanonicalFile | null;
  const companies = Array.isArray(parsed) ? parsed : (parsed?.companies ?? []);
  _index = buildIndex(companies);
  return _index;
}

/** Resolve a NORMALIZED company string to a canonical_id via the alias table. */
export function lookupByAlias(normalized: string): string | undefined {
  return loadIndex().aliasIndex.get(normalized);
}

/**
 * Resolve a NORMALIZED company string against acquisition lineage — i.e. the
 * input is what a company *used to be called*. Returns the successor canonical
 * record(s) and the `until` year of the acquisition.
 */
export function lookupByLineage(normalized: string): Array<{ canonical_id: string; until: number }> {
  return loadIndex().lineageIndex.get(normalized) ?? [];
}

export function getCanonicalById(canonicalId: string): CanonicalCompany | undefined {
  return loadIndex().byId.get(canonicalId);
}

export function allCanonicalCompanies(): CanonicalCompany[] {
  return [...loadIndex().byId.values()];
}
