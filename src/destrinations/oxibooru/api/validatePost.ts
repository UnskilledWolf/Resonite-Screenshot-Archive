import type { validatePostResponse } from '../types';
import genericCall from './geneticCall';

export default async function validatePost(
  headers: Headers,
  token: string
): Promise<validatePostResponse | null> {
  // TODO: Split behavior based on remote vs local file

  const data = await genericCall('posts/reverse-search/', 'POST', headers, {
    body: {
      contentToken: token,
    },
  });

  if (data) return (await data.json()) as validatePostResponse;
  else return null;
}
