import type { screenshotSource } from '../../../types';
import type { uploadPostResponse } from '../types';
import genericCall from './geneticCall';

export default async function uploadPost(
  headers: Headers,
  file: screenshotSource
): Promise<uploadPostResponse | null> {
  // TODO: Split behavior based on remote vs local file

  const data = await genericCall('uploads/', 'POST', headers, {
    body: {
      contentUrl: file.path,
    },
  });

  if (data) return (await data.json()) as uploadPostResponse;
  else return null;
}
