import { Octokit } from '@octokit/rest';

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

const owner = () => process.env.GITHUB_OWNER!;
const repo = () => process.env.GITHUB_REPO!;

export async function getFile(path: string): Promise<{ content: string; sha: string }> {
  const octokit = getOctokit();
  const response = await octokit.repos.getContent({
    owner: owner(),
    repo: repo(),
    path,
  });

  const data = response.data;
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`${path} is not a file`);
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

export async function createFile(
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const octokit = getOctokit();
  await octokit.repos.createOrUpdateFileContents({
    owner: owner(),
    repo: repo(),
    path,
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  });
}

export async function updateFile(
  path: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const octokit = getOctokit();
  await octokit.repos.createOrUpdateFileContents({
    owner: owner(),
    repo: repo(),
    path,
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
  });
}

export interface WorkflowStatus {
  status: 'idle' | 'queued' | 'in_progress' | 'completed' | 'failed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  runId: number | null;
  url: string | null;
  createdAt: string | null;
}

export async function triggerWorkflow(workflowFile: string): Promise<void> {
  const octokit = getOctokit();
  await octokit.actions.createWorkflowDispatch({
    owner: owner(),
    repo: repo(),
    workflow_id: workflowFile,
    ref: 'main',
  });
}

export async function getWorkflowStatus(workflowFile: string): Promise<WorkflowStatus> {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.actions.listWorkflowRuns({
      owner: owner(),
      repo: repo(),
      workflow_id: workflowFile,
      per_page: 1,
    });

    const run = data.workflow_runs[0];
    if (!run) return { status: 'idle', conclusion: null, runId: null, url: null, createdAt: null };

    const status =
      run.status === 'completed'
        ? run.conclusion === 'success'
          ? 'completed'
          : 'failed'
        : (run.status as 'queued' | 'in_progress');

    return {
      status,
      conclusion: (run.conclusion as WorkflowStatus['conclusion']) ?? null,
      runId: run.id,
      url: run.html_url,
      createdAt: run.created_at,
    };
  } catch {
    return { status: 'idle', conclusion: null, runId: null, url: null, createdAt: null };
  }
}

export async function listDirectory(path: string): Promise<{ name: string; path: string }[]> {
  const octokit = getOctokit();
  const response = await octokit.repos.getContent({
    owner: owner(),
    repo: repo(),
    path,
  });

  const data = response.data;
  if (!Array.isArray(data)) {
    throw new Error(`${path} is not a directory`);
  }

  return data
    .filter((item) => item.type === 'file')
    .map((item) => ({ name: item.name, path: item.path }));
}
