import type { getTagCategoriesResponse } from '../types';
import genericCall from './geneticCall';

export default async function getTagCategories(
  headers: Headers
): Promise<getTagCategoriesResponse> {
  const data = await genericCall('tag-categories/', 'GET', headers);

  if (data) return (await data.json()) as getTagCategoriesResponse;
  else return { results: [] };
}
