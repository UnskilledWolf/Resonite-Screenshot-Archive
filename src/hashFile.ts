import { blake3 } from '@noble/hashes/blake3.js';
import type { BunFile } from 'bun';
import path from 'node:path';

// Global file references
var cacheFile: BunFile | null = null;
var cache: { [key: string]: string } = {};

export async function openHashFile() {
  cacheFile = Bun.file('./hash-cache.log');

  // Create the file if it does not exist
  if (!(await cacheFile.exists())) cacheFile.write('');

  const lines = (await cacheFile.text()).split('\n');

  cache = {};

  // TODO make this parsing more robust
  lines.forEach((line) => {
    const parts: string[] = line.split('\t');
    if (parts[0] && parts[1]) cache[parts[0]] = parts[1];
  });
}

export async function closeHashFile() {
  if (!cacheFile) {
    console.error('Tried closing cache file when it is not open.');
    return;
  }

  let data = [];

  for (const key in cache) {
    data.push(key + '\t' + cache[key]);
  }

  cacheFile.write(data.join('\n'));
}

// Hashes a file using Blake3 and uses a cache
export default async function hashFile(filePath: string): Promise<string> {
  // Open the cache file if it does not exist
  if (!cacheFile || !cache) {
    console.error('Tried to hash file without opening cache first!');
    return '';
  }

  // Check if the file already exists in the cache
  const baseName = path.basename(filePath);
  if (baseName in cache) {
    return cache[baseName]!;
  }

  const fileData = await Bun.file(filePath).arrayBuffer();
  const hash = blake3(new Uint8Array(fileData)).toHex();

  cache[baseName] = hash;

  return hash;
}
