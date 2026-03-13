import path from 'node:path';
import fs from 'node:fs';
import config from '../config.json';
import type { photoMetadataSummary } from '../src/sources/local/types';

// !!! This one is extra experimental
// Change the timezone to your current local timezone if you need to

const targetTimezone = 'Etc/GMT-1'; // UTC+1

async function fix() {
  const logFile = Bun.file(config.local.logFile);

  if (!logFile.exists) throw new Error('No log file found at ' + config.local.logFile);

  const screenshots = (await logFile.text())
    .split('\n') // Split the jsonl file to individual lines
    .filter((line) => line.length > 1) // Filter out any lines that don't contain data
    // Convert each line to an object
    .map((line) => {
      return JSON.parse(line) as photoMetadataSummary;
    });

  // Filter files that are missing locally
  // const missing = screenshots.filter(
  //   (record) => !fs.existsSync(path.join(config.local.directory, record.filename))
  // );
  // console.warn(`Failed to find ${missing.length} screenshots.`);

  const lines = [];
  for (const screenshot of screenshots) {
    const filepath = path.join(config.local.directory, screenshot.filename);
    if (!fs.existsSync(filepath)) {
      const date = new Date(screenshot.TimeTaken);

      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: targetTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date);

      // Not sure why this works, I honestly asked an AI for the
      // conversion, because I needed it fast
      const get = (t) => parts.find((p) => p.type === t).value;

      const formatted = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}.${get('minute')}.${get('second')}.jpg`;
      const newFilepath = path.join(config.local.directory, formatted);

      if (fs.existsSync(newFilepath)) {
        console.log(screenshot.filename + ' fixed');
        lines.push({ ...screenshot, filename: formatted });
      } else {
        console.log(screenshot.filename + ' missing fr fr');
        lines.push(screenshot);
      }
    } else {
      lines.push(screenshot);
    }
  }

  const outfile = Bun.file('./Resonite.jsonl');
  const data = lines.map((l) => JSON.stringify(l)).join('\n');
  await outfile.write(data);
}

fix();
