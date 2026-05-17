import { getFile, updateFile, createFile } from '@/lib/github';
import yaml from 'js-yaml';

export async function readYaml<T>(path: string): Promise<{ data: T; sha: string }> {
  const { content, sha } = await getFile(path);
  return { data: yaml.load(content) as T, sha };
}

export async function writeYaml(path: string, data: unknown, sha: string, message: string): Promise<void> {
  const content = yaml.dump(data, { lineWidth: 120, quotingType: '"' });
  if (sha) {
    await updateFile(path, content, sha, message);
  } else {
    await createFile(path, content, message);
  }
}
