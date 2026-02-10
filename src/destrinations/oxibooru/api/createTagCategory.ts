import genericCall from './geneticCall';

export default async function createTagCategory(
  headers: Headers,
  name: string,
  color: string,
  order: number
): Promise<boolean> {
  const data = await genericCall('tag-categories/', 'POST', headers, {
    body: { name, color, order },
  });

  return data !== null;
}
