import type { screenshotSource } from '../../../types';
import type { safetyLevels, uploadPostResponse } from '../types';
import genericCall from './geneticCall';

export default async function createPost(
  headers: Headers,
  tags: string[],
  contentToken: string,
  source: screenshotSource,
  safety: safetyLevels
): Promise<boolean> {
  // TODO: Split behavior based on remote vs local file

  const data = await genericCall('posts/', 'POST', headers, {
    body: {
      // new Set deduplicated tags
      tags: [...new Set(tags)],
      contentToken: contentToken,
      source: source.path,
      safety,
    },
  });

  return data !== null;
}
