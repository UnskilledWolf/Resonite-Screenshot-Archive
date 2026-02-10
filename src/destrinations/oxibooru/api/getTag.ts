import type { getTagResponse } from '../types';
import genericCall from './geneticCall';

export default async function getTag(
  headers: Headers,
  tag: string
): Promise<getTagResponse | null> {
  const data = await genericCall('tag/', 'GET', headers, { args: tag });

  if (data) return (await data.json()) as getTagResponse;
  else return null;
}
