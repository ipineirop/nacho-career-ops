import type { Application, PipelineJob, Report } from './types';

// ---------------------------------------------------------------------------
// applications.md
// ---------------------------------------------------------------------------

export function parseApplications(raw: string): Application[] {
  const apps: Application[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed.split('|').map((c) => c.trim());
    // cells[0] is empty (before first |), cells[1] is #
    const idCell = cells[1];
    if (!idCell || idCell === '#' || idCell.startsWith('-')) continue;

    const id = parseInt(idCell, 10);
    if (isNaN(id)) continue;

    const score = cells[5] ?? '';
    const scoreNum = parseFloat(score.split('/')[0]) || 0;
    const pdfCell = cells[7] ?? '';
    const reportCell = cells[8] ?? '';

    // Extract report ID from markdown link like [17](reports/017-...)
    const reportMatch = reportCell.match(/\[(\d+)\]/);

    apps.push({
      id,
      date: cells[2] ?? '',
      company: cells[3] ?? '',
      role: cells[4] ?? '',
      score,
      scoreNum,
      status: cells[6] ?? '',
      hasPdf: pdfCell.includes('✅'),
      reportId: reportMatch ? reportMatch[1] : null,
      notes: cells[9] ?? '',
    });
  }

  return apps.sort((a, b) => a.id - b.id);
}

export function updateApplicationField(
  raw: string,
  id: number,
  field: 'status' | 'notes',
  value: string,
): string {
  const colIndex = field === 'status' ? 6 : 9;
  return raw
    .split('\n')
    .map((line) => {
      if (!line.trim().startsWith('|')) return line;
      const cells = line.split('|').map((c) => c.trim());
      if (parseInt(cells[1], 10) !== id) return line;
      const parts = line.split('|');
      parts[colIndex] = ` ${value} `;
      return parts.join('|');
    })
    .join('\n');
}

// Keep backward compat
export function updateApplicationStatus(raw: string, id: number, newStatus: string): string {
  return updateApplicationField(raw, id, 'status', newStatus);
}

// ---------------------------------------------------------------------------
// pipeline.md
// ---------------------------------------------------------------------------

// Evaluated line:  - [x] #NNN | URL | Company | Role | Score | PDF ✅/❌
// Pending line:    - [ ] URL | Company | Role
// Pending (URL only): - [ ] URL

const EVALUATED_RE = /^- \[x\] #(\d+) \| (https?:\/\/\S+) \| (.+?) \| (.+?) \| ([\d.]+\/5) \| PDF (✅|❌)/;
const PENDING_RE = /^- \[ \] (https?:\/\/\S+)(?: \| (.+?) \| (.+?))?$/;
const ANY_CHECKED_RE = /^- \[x\] /;

export function parsePipeline(raw: string): PipelineJob[] {
  const jobs: PipelineJob[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    const evalMatch = trimmed.match(EVALUATED_RE);
    if (evalMatch) {
      jobs.push({
        url: evalMatch[2],
        company: evalMatch[3],
        role: evalMatch[4],
        checked: true,
        evalId: evalMatch[1],
        score: evalMatch[5],
        hasPdf: evalMatch[6] === '✅',
        rawLine: line,
      });
      continue;
    }

    const pendingMatch = trimmed.match(PENDING_RE);
    if (pendingMatch) {
      jobs.push({
        url: pendingMatch[1],
        company: pendingMatch[2] ?? '',
        role: pendingMatch[3] ?? '',
        checked: false,
        evalId: null,
        score: null,
        hasPdf: null,
        rawLine: line,
      });
      continue;
    }

    // Already-checked lines that don't match the evaluated pattern (older formats)
    if (ANY_CHECKED_RE.test(trimmed)) {
      const urlMatch = trimmed.match(/https?:\/\/\S+/);
      if (urlMatch) {
        jobs.push({
          url: urlMatch[0],
          company: '',
          role: '',
          checked: true,
          evalId: null,
          score: null,
          hasPdf: null,
          rawLine: line,
        });
      }
    }
  }

  return jobs;
}

// Mutate a single line in-place: flip [ ] → [x] for the matching URL
export function discardPipelineItem(raw: string, url: string): string {
  return raw
    .split('\n')
    .map((line) => {
      if (!line.includes(url)) return line;
      return line.replace('- [ ]', '- [x]');
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// reports/ directory listing
// ---------------------------------------------------------------------------

const REPORT_FILENAME_RE = /^(\d{3})-(.+?)-(\d{4}-\d{2}-\d{2})\.md$/;

export function parseReportFilenames(
  files: { name: string; path: string }[],
): Report[] {
  return files
    .filter((f) => REPORT_FILENAME_RE.test(f.name))
    .map((f) => {
      const m = f.name.match(REPORT_FILENAME_RE)!;
      return {
        id: m[1],
        slug: m[2],
        date: m[3],
        filename: f.name,
        path: f.path,
      };
    })
    .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // newest first
}
