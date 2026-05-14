import { getFile } from '@/lib/github';
import { parsePipeline } from '@/lib/parsers';
import { PipelineList } from '@/components/pipeline/PipelineList';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const { content } = await getFile('data/pipeline.md');
  const jobs = parsePipeline(content);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pipeline</h1>
      <PipelineList initialJobs={jobs} />
    </div>
  );
}
