import { RunnerCard } from '@/components/commands/RunnerCard';
import { CliCard } from '@/components/commands/CliCard';

const RUNNABLE = [
  {
    workflow: 'scan-portals',
    label: 'Scan job portals',
    description: 'Hits Greenhouse, Ashby, and Lever APIs for all companies in portals.yml. Zero tokens, zero cost. Appends new jobs to pipeline.md.',
    tip: 'Run this first — no API cost.',
  },
  {
    workflow: 'scan-linkedin',
    label: 'Scan LinkedIn (Apify)',
    description: 'Scrapes LinkedIn jobs via Apify cloud for all configured linkedin_queries. No ban risk, no browser needed.',
    tip: 'Requires APIFY_API_TOKEN secret in the GitHub repo.',
  },
  {
    workflow: 'analyze-patterns',
    label: 'Analyze rejection patterns',
    description: 'Reads all evaluations to detect trends: rejection patterns, archetype fit, score distribution by domain.',
  },
  {
    workflow: 'followup',
    label: 'Follow-up cadence',
    description: 'Checks which applications are overdue for a follow-up based on your cadence rules (7-day intervals, max 2 follow-ups).',
  },
  {
    workflow: 'verify',
    label: 'Verify pipeline health',
    description: 'Validates canonical statuses, deduplication, report links, and score formats in applications.md.',
  },
];

const CLI_COMMANDS = [
  {
    category: 'Evaluation',
    items: [
      { label: 'Evaluate a job offer', command: '/career-ops', description: 'Paste a job URL or description. Runs full 7-block evaluation (A–G) and generates a numbered report.' },
      { label: 'Batch evaluate pipeline', command: '/career-ops batch', description: 'Parallel evaluation of all pending URLs in pipeline.md. Fast for clearing backlogs.', tip: 'Uses more tokens. Run after a portal scan.' },
      { label: 'Deep company research', command: '/career-ops deep', description: 'In-depth research: funding, culture, team, comp benchmarks, red flags.' },
      { label: 'Compare offers', command: '/career-ops compare', description: 'Side-by-side comparison of two or more evaluated offers.' },
    ],
  },
  {
    category: 'CV & Application',
    items: [
      { label: 'Generate tailored PDF', command: '/career-ops pdf', description: 'Creates a personalized CV PDF for a specific role. Reads cv.md + the evaluation report.', tip: 'Run after evaluating a role with score ≥ 4.' },
      { label: 'Fill application form', command: '/career-ops apply', description: 'Guides you through a job application form. Stops before submitting — you review and click.' },
      { label: 'LinkedIn outreach', command: '/career-ops contact', description: 'Drafts a LinkedIn connection message or InMail for a specific role/company.' },
    ],
  },
  {
    category: 'Interview Prep',
    items: [
      { label: 'Interview prep report', command: '/career-ops interview-prep', description: 'Company-specific prep: likely questions, STAR stories, culture intel, red flags.', tip: 'Run 1–2 days before the interview.' },
    ],
  },
  {
    category: 'Data Sync',
    items: [
      { label: 'Sync data to GitHub', command: 'bash sync-data.sh', description: 'Pushes local data (applications.md, pipeline.md, reports/) to GitHub so this dashboard reflects your latest work.' },
      { label: 'Merge tracker additions', command: 'node merge-tracker.mjs', description: 'Merges batch TSV results from batch/tracker-additions/ into applications.md.' },
    ],
  },
];

export default function CommandsPage() {
  return (
    <div className="p-8 max-w-4xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commands</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run scans and analysis directly from the browser, or copy commands for your Claude Code terminal.
        </p>
      </div>

      {/* Runnable from browser */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Run from browser</h2>
          <p className="text-xs text-muted-foreground mt-0.5">These run as GitHub Actions — no terminal needed. Results appear in the dashboard after completion.</p>
        </div>
        <div className="space-y-3">
          {RUNNABLE.map((cmd) => (
            <RunnerCard key={cmd.workflow} {...cmd} />
          ))}
        </div>
      </section>

      {/* CLI commands */}
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Run in Claude Code</h2>
          <p className="text-xs text-muted-foreground mt-0.5">These require an interactive Claude session — open your terminal and paste the command.</p>
        </div>
        {CLI_COMMANDS.map((group) => (
          <div key={group.category} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.category}</h3>
            {group.items.map((item) => (
              <CliCard key={item.command} {...item} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
