import oxibooru from './destrinations/oxibooru/oxibooru';
import local from './sources/local/local';
import resonite from './sources/resonite/resonite';

// const screenshots = await resonite();
// await oxibooru(screenshots);

const screenshots = await local();
console.log('Sending Screenshots to Oxibooru.');
oxibooru(screenshots);
