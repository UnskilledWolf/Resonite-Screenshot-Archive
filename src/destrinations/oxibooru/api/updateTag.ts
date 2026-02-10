import genericCall from './geneticCall';

export default async function updateTag(
  headers: Headers,
  tag: string,
  category: string,
  version: Date
): Promise<boolean> {
  const data = await genericCall('tag/', 'GET', headers, {
    args: tag,
    body: { category, version },
  });

  return data !== null;
}
