import oxibooru from './destrinations/oxibooru/oxibooru';
import { closeHashFile, openHashFile } from './hashFile';
import local from './sources/local/local';
import resonite from './sources/resonite/resonite';
import type { deletionRecord, screenshotData } from './types';
import config from '../config.json'

// const screenshots = await resonite();
// await oxibooru(screenshots);

await openHashFile()

console.log('Gathering screenshots.');
let screenshots: screenshotData[] = []
switch (config.general.from) {
  case "local":
    screenshots = await local();
    break;
  case "resonite":
    screenshots = await resonite();
    break;
}

console.log(`Uploading ${screenshots.length} screenshots.`)
let deletions: deletionRecord<screenshotData>[] = []
switch (config.general.to) {
  case "oxibooru":
    deletions = await oxibooru(screenshots);
    break;
}

//TODO handle deletions

await closeHashFile()
