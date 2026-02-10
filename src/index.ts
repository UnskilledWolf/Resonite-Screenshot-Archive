import oxibooru from './destrinations/oxibooru/oxibooru';
import resonite from './sources/resonite/resonite';

const screenshots = await resonite();
await oxibooru(screenshots);
