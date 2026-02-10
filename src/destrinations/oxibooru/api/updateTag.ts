import genericCall from './geneticCall';

export default async function updateTag(
  headers: Headers,
  tag: string,
  category: string,
  version: Date
): Promise<boolean> {
  const data = await genericCall('tag/', 'PUT', headers, {
    args: tag,
    body: { category, version },
  });

  return data !== null;
}
