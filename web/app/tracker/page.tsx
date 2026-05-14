import { getFile } from '@/lib/github';
import { parseApplications } from '@/lib/parsers';
import { ApplicationsTable } from '@/components/tracker/ApplicationsTable';

export const dynamic = 'force-dynamic';

export default async function TrackerPage() {
  const { content } = await getFile('data/applications.md');
  const applications = parseApplications(content);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Applications Tracker</h1>
      <ApplicationsTable initialApplications={applications} />
    </div>
  );
}
