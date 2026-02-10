import type { getPostSearchResponse } from '../types';
import genericCall from './geneticCall';

export default async function searchPosts(
  headers: Headers,
  rawQuery: string
): Promise<getPostSearchResponse | null> {
  const data = await genericCall('posts/', 'GET', headers, {
    args: rawQuery,
  });

  if (data) return (await data.json()) as getPostSearchResponse;
  else return null;
}
