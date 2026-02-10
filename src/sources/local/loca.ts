import type { screenshotData } from '../../types';
import config from '../../../config.json';
import type { photoMetadataSummary } from './types';
import path from 'node:path';
import fs from 'node:fs';

function photoMetadataSummaryToScreenshotData(record: photoMetadataSummary): screenshotData {
  return {
    file: {
      path: path.join(config.local.directory, record.filename),
      isRemote: false,
    },
    metadata: {
      location: {
        name: record.LocationName.replaceAll(/<[^>]+>/, ''),
        host: record.LocationHost.UserId,
        accessLevel: record.LocationAccessLevel,
        hiddenFromListing: record.LocationHiddenFromListing,
      },
      timeTaken: new Date(record.TimeTaken),
      takenBy: record.TakenBy.UserId as any,
      appVersion: record.AppVersion as any,
      userIds: record.UserInfos.map((user) => user.User.UserId) as any,
      camera: {
        FOV: record.CameraFOV,
        manufacturer: record.CameraManufacturer,
        model: record.CameraModel,
      },
    },
    additionalTags: [],
  };
}

export default async function local(): Promise<screenshotData[]> {
  const logFile = Bun.file(config.local.logFile);

  if (!logFile.exists) throw new Error('No log file found at ' + config.local.logFile);

  const rawRecords = (await logFile.text())
    .split('\n') // Split the jsonl file to individual lines
    .filter((line) => line.length > 1) // Filter out any lines that don't contain data
    // Convert each line to an object
    .map((line) => {
      return JSON.parse(line) as photoMetadataSummary;
    });

  let screenshots = rawRecords.map((record) => photoMetadataSummaryToScreenshotData(record));

  // Filter files that are missing locally
  let prevSize = screenshots.length;
  screenshots = screenshots.filter((record) => fs.existsSync(record.file.path));
  let sizeDifference = prevSize - screenshots.length;
  if (sizeDifference > 0) console.warn(`Failed to find ${sizeDifference} screenshots.`);

  return screenshots;
}
