import type { screenshotSource } from '../../../types';
import type { uploadPostResponse } from '../types';
import genericCall from './geneticCall';

export default async function uploadPost(
  headers: Headers,
  file: screenshotSource
): Promise<uploadPostResponse | null> {
  if (file.isRemote) return uploadRemotePost(headers, file.path);
  else return uploadLocalPost(headers, file.path);
}

async function uploadRemotePost(
  headers: Headers,
  path: string
): Promise<uploadPostResponse | null> {
  const data = await genericCall('uploads/', 'POST', headers, {
    body: {
      contentUrl: path,
    },
  });

  if (data) return (await data.json()) as uploadPostResponse;
  else return null;
}

async function uploadLocalPost(headers: Headers, path: string): Promise<uploadPostResponse | null> {
  const file = Bun.file(path);
  const formData = new FormData();
  formData.append('content', file);

  const h = new Headers();
  h.append('Authorization', headers.get('Authorization')!);
  h.append('Host', headers.get('Host')!);

  const response = await fetch(`${process.env.oxibooruInstance}/api/uploads`, {
    method: 'POST',
    body: formData,
    headers: h,
  });

  if (!response.ok) {
    console.warn('Failed to upload local file', path, await response.text());
    return null;
  }

  return (await response.json()) as uploadPostResponse;
}
