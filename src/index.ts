import oxibooru from './destrinations/oxibooru/oxibooru';
import { closeHashFile, openHashFile } from './hashFile';
import local from './sources/local/local';
import resonite from './sources/resonite/resonite';

// const screenshots = await resonite();
// await oxibooru(screenshots);

await openHashFile()

const screenshots = await local();
console.log('Sending Screenshots to Oxibooru.');
await oxibooru(screenshots);

await closeHashFile()
