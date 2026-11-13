import type { deletionRecord, screenshotData } from '../../types';
import config from '../../../config.json';
import searchTags from './api/searchTags';
import searchPosts from './api/searchPosts';
import updatePost from './api/updatePost';
import deleteTag from './api/deleteTag';
import processScreenshots from './processScreenshots';
import processCategories from './processCategories';
import { updateCategoryTags } from './processCategories';

function createOxibooruHeaders(): Headers {
  const oxibooruToken = Buffer.from(
    `${process.env.oxibooruUser}:${process.env.oxibooruToken}`
  ).toString('base64');

  const oxibooruHost = process.env.oxibooruInstance!.split('//')[1];
  if (!oxibooruHost) throw new Error('Unable to parse oxibooruInstance in env');

  const headers = new Headers();
  headers.append('Authorization', `Token ${oxibooruToken}`);
  headers.append('Accept', 'application/json');
  headers.append('Content-Type', 'application/json');
  headers.append('Host', oxibooruHost);

  return headers;
}

export default async function oxibooru(
  screenshots: screenshotData[]
): Promise<deletionRecord<screenshotData>[]> {
  const headers = createOxibooruHeaders();

  // Process all screenshots and get what needs to be deleted
  const deletionRecords = await processScreenshots(screenshots, headers);

  if (config.oxibooru.useCategories) {
    processCategories(screenshots, headers);
  }

  // #region Legacy migrations
  // TODO: Overhaul the migration in general
  // This is a hack! Only needed to cleanup previous posts and will be deleted after.
  if (!config.oxibooru.useLegacyMigrations) return deletionRecords;

  if (!config.oxibooru.useCategories)
    console.warn('useCategories has to be true for migrating tags to categories.');

  // update legacy timestamps
  const legacyTimestamps = await searchTags(
    headers,
    `?${new URLSearchParams({ query: 'timestamp\\:*', limit: '200', fields: 'names,version' })}`
  );

  if (legacyTimestamps && legacyTimestamps.results) {
    legacyTimestamps.results.forEach(async (timestamp) => {
      const date = timestamp.names[0]?.replace('timestamp:', '').split('T')[0];
      if (!date) return;
      const oldTimestamp = timestamp.names[0]?.replaceAll(':', '\\:').replaceAll('.', '\\.');
      const posts = await searchPosts(
        headers,
        `?${new URLSearchParams({
          query: `${oldTimestamp}`,
          limit: '200',
          fields: 'version,id,tags',
        })}`
      );
      if (posts && posts.results) {
        posts.results.forEach(async (post) => {
          const tags = post.tags?.map((tag) => tag.names[0]).filter((tag) => tag !== undefined);
          if (!tags) return;
          const successfulUpdate = await updatePost(
            headers,
            post.id!.toString(),
            [...tags, date],
            post.version!
          );
          if (!successfulUpdate) return;
          await deleteTag(headers, timestamp.names[0]!, timestamp.version!);
        });
      }
    });
  }

  // remove texture_asset tags
  const textureAssetTags = await searchTags(
    headers,
    `?${new URLSearchParams({ query: 'texture_asset\\*', limit: '200', fields: 'names,version' })}`
  );
  if (textureAssetTags && textureAssetTags.results)
    textureAssetTags.results.forEach((tag) => {
      deleteTag(headers, encodeURIComponent(tag.names[0]!), tag.version!);
    });

  // get usernames
  // TODO: Reimplement
  // FIXME: the limit is a hack, it has to be replaced with a better way of selecting users that have not been updates. maybe separate the api call into users that are not part of the category yet and need immediate updating and another for when the last edit is longer then "refreshUsernamesInMonths"
  // const users = await searchTags(
  //   headers,
  //   `?${new URLSearchParams({ query: 'U-*', limit: '1000', fields: 'names,version,lastEditTime' })}`
  // );
  // if (users && users.results) {
  //   users.results.forEach(async (user) => {
  //     const lastChecked = new Date().getTime() - new Date(user.lastEditTime!).getTime();
  //     const refreshUsernamesInMonths = config.oxibooru.refreshUsernamesInMonths * 2.628e9;
  //     if (user.names.length !== 1 && lastChecked < refreshUsernamesInMonths) return;
  //     const userId = user.names.find((tag) => tag.startsWith('U-'));
  //     if (!userId) return;
  //     // FIXME: If there are to many requests which causes teh Resonite API to lock up.
  //     await setTimeout(100);
  //     const userRecordRaw = await fetch(`https://api.resonite.com/users/${userId}`, {});
  //     if (!userRecordRaw.ok) {
  //       console.warn(userRecordRaw.statusText, await userRecordRaw.text(), { user });
  //       return null;
  //     }
  //     const userRecord = (await userRecordRaw.json()) as resoniteUserRecord;
  //     if (!(userRecord && userRecord.username)) return;
  //     const names = user.names;
  //     names.unshift(userRecord.username.replaceAll(' ', '_'));
  //     const description = userRecord.profile
  //       ? `<img src="${getAssetURL(userRecord.profile.iconUrl)}">`
  //       : null;
  //     oxibooruCall(oxibooruFunctions.updateTag!, userId, {
  //       names: [...new Set(names)],
  //       version: user.version,
  //       description,
  //     });
  //   });
  // }

  // update legacy user categories
  const categories = config.oxibooru.categories;
  const legacyUsers = await searchTags(
    headers,
    `?${new URLSearchParams({ query: 'U-* -category:User', limit: '200', fields: 'names' })}`
  );
  if (legacyUsers && legacyUsers.results)
    updateCategoryTags(
      headers,
      legacyUsers.results.map((tag) => tag.names[0]).filter((e) => e !== undefined),
      categories.users
    );

  // update date and game version categories
  for (let i = 0; i < 3; i++) {
    const dates = await searchTags(
      headers,
      `?${new URLSearchParams({
        query: `${new Date().getFullYear() - i}-*-*`,
        limit: '200',
        fields: 'names',
      })}`
    );
    if (dates && dates.results)
      updateCategoryTags(
        headers,
        dates.results.map((tag) => tag.names[0]).filter((e) => e !== undefined),
        categories.dateTaken
      );
    const gameVersions = await searchTags(
      headers,
      `?${new URLSearchParams({
        query: `${new Date().getFullYear() - i}.*.*.*`,
        limit: '200',
        fields: 'names',
      })}`
    );
    if (gameVersions && gameVersions.results)
      updateCategoryTags(
        headers,
        gameVersions.results.map((tag) => tag.names[0]).filter((e) => e !== undefined),
        categories.gameVersion
      );
  }
  // #endregion

  return deletionRecords;
}
