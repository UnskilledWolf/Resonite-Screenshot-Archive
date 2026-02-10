import genericCall from './geneticCall';

export default async function updatePost(
  headers: Headers,
  id: string,
  tags: string[],
  version: Date
): Promise<boolean> {
  const data = await genericCall('post/', 'PUT', headers, {
    args: id,
    body: { tags, version },
  });

  return data !== null;
}
