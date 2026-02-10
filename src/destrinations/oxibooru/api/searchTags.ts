import type { getTagSearchResponse } from '../types';
import genericCall from './geneticCall';

export default async function searchTags(
  headers: Headers,
  rawQuery: string
): Promise<getTagSearchResponse | null> {
  const data = await genericCall('tags/', 'GET', headers, {
    args: rawQuery,
  });

  if (data) return (await data.json()) as getTagSearchResponse;
  else return null;
}
