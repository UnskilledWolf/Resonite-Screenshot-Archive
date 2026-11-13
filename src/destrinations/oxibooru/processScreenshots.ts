import { version as appVersion } from '../../../package.json';
import type { deletionRecord, screenshotData } from '../../types';
import type { safetyLevels } from './types';
import uploadPost from './api/uploadPost';
import validatePost from './api/validatePost';
import createPost from './api/createPost';
import { newQueue } from '@henrygd/queue';
import { blake3 } from '@noble/hashes/blake3.js';
import searchPosts from './api/searchPosts';
import config from '../../../config.json';
export default async function processScreenshots(
  screenshots: screenshotData[],
  headers: Headers
): Promise<deletionRecord<screenshotData>[]> {
  const deletionRecords: deletionRecord<screenshotData>[] = [];
  const uploadQueue = newQueue(10);

  // Create upload promises and wrap them so that their deletion results can be saved
  const uploadTasks = screenshots.map((screenshot) => async () => {
    const result = await processScreenshot(screenshot, headers);
    if (result) deletionRecords.push(result);
  });

  // Wait for all uploads to be done
  await uploadQueue.all(uploadTasks);

  return deletionRecords;
}

// Uploads a single screenshot record to Oxibooru
// Returns a deletion record, if it is to be deleted
async function processScreenshot(
  record: screenshotData,
  headers: Headers
): Promise<deletionRecord<screenshotData> | null> {
  // Check if the file already exists on remote
  // Only works if the file is already on the local machine
  if (config.oxibooru.checkForExistingHashes && !record.file.isRemote) {
    const alreadyExists = await existsOnRemote(record.file.path, headers);

    // Return if the file does not already exists
    // TODO: Should this return a deletion record if the file is already on the server or just ignore it?
    if (alreadyExists) {
     console.log("Skipping " , record.file.path)
      return null
    };
  }

  // upload file
  const contentToken = await uploadPost(headers, record.file);
  if (!contentToken) {
    console.warn('Issue with uploading ', record.file.path);
    return null;
  }

  // Check if the post already exists. If it does, delete the original record.
  const validatePostResp = await validatePost(headers, contentToken.token);
  if (validatePostResp && validatePostResp.exactPost !== null) return { original: record };

  // get all data and put into array for tags
  const tags = [
    ...record.additionalTags,
    ...record.metadata.userIds,
    record.metadata.location.name,
    `sessionName:${record.metadata.location.name}`,
    `host:${record.metadata.location.host}`,
    record.metadata.location.accessLevel,
    `accessLevel:${record.metadata.location.accessLevel}`,
    record.metadata.location.hiddenFromListing ? 'hiddenSession' : null,
    `takenBy:${record.metadata.takenBy}`,
    record.metadata.timeTaken.toISOString().split('T')[0],
    appVersion,
    record.metadata.appVersion,
    // check if modded app-version is set
    // TODO: See if there is a non-nested ternary way of doing this
    record.metadata.appVersion
      ? record.metadata.appVersion.includes('+')
        ? record.metadata.appVersion.split('+')[0]!
        : null
      : null,
  ]
    .map((tag) => tag?.replaceAll(' ', '_'))
    .filter((tag) => !(tag === undefined || tag === null));

  // get safety level
  let safety: safetyLevels = 'safe';
  // order is important
  if (record.metadata.location.accessLevel === 'FriendsOfFriends') safety = 'sketchy';
  if (record.metadata.location.accessLevel === 'Contacts') safety = 'unsafe';
  if (record.metadata.location.accessLevel === 'Private') safety = 'unsafe';
  if (record.metadata.location.hiddenFromListing === true) safety = 'unsafe';

  // create post from tags
  const post = await createPost(headers, tags, contentToken.token, record.file, safety);

  // delete resonite image if picture was added successfully
  if (post) {
    console.log('Succesfully uploaded ', record.file.path);
    return {
      original: record,
    };
  } else {
    console.warn('Issue with posting ', record.file.path);
    return null;
  }
}

async function existsOnRemote(filePath: string, headers: Headers): Promise<boolean> {
  const fileData = await Bun.file(filePath).arrayBuffer();
  const hash = blake3(new Uint8Array(fileData)).toHex();

  const response = await searchPosts(headers, `?content-checksum:${hash}`);

  if (!response) return false;

  return response.results.length > 0;
}
