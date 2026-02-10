import genericCall from './geneticCall';

export default async function deleteTag(
  headers: Headers,
  tag: string,
  version: Date
): Promise<boolean> {
  const data = await genericCall('tag/', 'DELETE', headers, {
    args: tag,
    body: { version },
  });

  return data !== null;
}
