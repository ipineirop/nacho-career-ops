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
