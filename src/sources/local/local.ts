import type { screenshotData } from '../../types';
import config from '../../../config.json';
import type { MetadataSummary } from './types';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export default async function local(): Promise<screenshotData[]> {
  let result: screenshotData[] = [];

  result = result.concat(
    await processLog(config.local.picturesLogFile, config.local.picturesDirectory)
  );
  result = result.concat(
    await processLog(config.local.videosLogFile, config.local.videosDirectory)
  );

  return result;
}

function convertMetadataSummaryToScreenshotData(
  record: MetadataSummary,
  directory: string
): screenshotData {
  return {
    file: {
      path: path.join(directory, record.filename),
      isRemote: false,
    },
    metadata: {
      location: {
        name: record.LocationName.replaceAll(/<[^>]+>/g, ''),
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

async function processLog(logPath: string, dirPath: string): Promise<screenshotData[]> {
  const resolvedLogPath = resolveHome(logPath);
  const resolvedDirPath = resolveHome(dirPath);

  const logFile = Bun.file(resolvedLogPath);

  if (!logFile.exists) throw new Error('No log file found at ' + resolvedLogPath);

  const rawRecords = (await logFile.text())
    .split('\n') // Split the jsonl file to individual lines
    .filter((line) => line.length > 1) // Filter out any lines that don't contain data
    // Convert each line to an object
    .map((line) => {
      return JSON.parse(line) as MetadataSummary;
    });

  let screenshots = rawRecords.map((record) =>
    convertMetadataSummaryToScreenshotData(record, resolvedDirPath)
  );

  // Fix videos with missing file names
  // Caused by Resonite Issue #7513
  screenshots.forEach(resolveBrokenVideoExtension);

  // Filter files that are missing locally
  let prevSize = screenshots.length;
  screenshots = screenshots.filter((record) => fs.existsSync(record.file.path));
  let sizeDifference = prevSize - screenshots.length;
  if (sizeDifference > 0)
    console.warn(`Failed to find ${sizeDifference} screenshots from ${resolvedLogPath}.`);

  return screenshots;
}

function resolveHome(relativePath: string): string {
  const homeDir = os.homedir();

  let resolvedPath = relativePath.replace(/\$HOME/g, homeDir);

  return path.resolve(resolvedPath);
}

// Searches for missing extensions
// Modifies the original screenshot object
function resolveBrokenVideoExtension(record: screenshotData) {
  // Test if this is applicable for this screenshot
  const extension = path.extname(record.file.path);

  // For .mp4 files where the original file does not have an extension
  if (extension === '.mp4' && !fs.existsSync(record.file.path)) {
    // Try to find the path without the extension instead
    const extensionlessPath = record.file.path.substring(0, record.file.path.length - 4);
    if (fs.existsSync(extensionlessPath)) {
      // If that does exist, modify the original data
      record.file.path = extensionlessPath;
    }
  }
  // For no-extension files where the original file has an .mp4 extension
  // (Since the name is a date, the extension will be just numbers for these)
  else if (extension.match(/\d*/)) {
    const extensionfullPath = record.file.path + '.mp4';
    if (fs.existsSync(extensionfullPath)) {
      // If that does exist, modify the original data
      record.file.path = extensionfullPath;
    }
  }
  // Any other extensions are ignored
}
