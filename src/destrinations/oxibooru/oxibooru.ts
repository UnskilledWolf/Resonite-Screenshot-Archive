import { version as appVersion } from '../../../package.json';
import { setTimeout } from 'timers/promises';
import type { screenshotData } from '../../types';
import type {
  uploadPostResponse,
  validatePostResponse,
  safetyLevels,
  getTagCategoriesResponse,
  getTagResponse,
  getTagSearchResponse,
  getPostSearchResponse,
} from './types';
import config from '../../../config.json';
import getTagCategories from './api/getTagCategories';
import createTagCategory from './api/createTagCategory';
import uploadPost from './api/uploadPost';
import validatePost from './api/validatePost';
import createPost from './api/createPost';
import getTag from './api/getTag';
import updateTag from './api/updateTag';
import searchTags from './api/searchTags';
import searchPosts from './api/searchPosts';
import updatePost from './api/updatePost';
import deleteTag from './api/deleteTag';
import type { resoniteUserRecord } from '../../sources/resonite/types';

// if successful, send delete request for the image to resonite
// async function deleteResoniteRecord(record: resoniteInventoryRecord, i: number) {
//   console.log(i, record.photoMetadata.location.name);
//   if (!config.oxibooru.deleteSourcePictures) return;
//   await fetch(`https://api.resonite.com/users/${tokenBody.entity.userId}/records/${record.id}`, {
//     method: HTTPMethodOxibooru.delete,
//     headers: { Authorization },
//   });
// }
async function deleteResoniteRecord(record: any, i: any) {
  console.error('TODO: Re-implement deletions');
}

// FIXME: want to use typeof categories, but im stoopid
async function updateCategoryTags(headers: Headers, tags: string[], category: string) {
  const uniqueTags = Array.from(new Set(tags));

  return Promise.all(
    uniqueTags.map(async (tag) => {
      const sanitizedTag = tag?.replaceAll(' ', '_');

      const foundTag = await getTag(headers, sanitizedTag);
      if (!foundTag) return console.warn(`Unable to find tag ${sanitizedTag} to update category.`);
      if (foundTag.category === category) return;

      await updateTag(headers, sanitizedTag, category, foundTag.version);
    })
  );
}

export default async function oxibooru(screenshots: screenshotData[]) {
  // #region Oxibooru API Token
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
  // #endregion

  // #region Update categories
  if (config.oxibooru.useCategories) {
    const configTagCategories = Object.entries(config.oxibooru.categories).map((e) => e[1]);
    const currentTagCategories = await getTagCategories(headers);

    await Promise.all(
      configTagCategories.map(async (configCategoryName, i) => {
        // check, if category was created
        const foundEntry = currentTagCategories.results.find(
          (category) => category.name === configCategoryName
        );

        if (!foundEntry) {
          const output = await createTagCategory(headers, configCategoryName, 'default', i);
          if (!output) throw new Error("Couldn't create a category.");
          return;
        }
      })
    );
  }
  // #endregion

  // #region Create Posts
  await Promise.all(
    screenshots.map(async (record, i) => {
      // upload file
      const contentToken = await uploadPost(headers, record.file);
      if (!contentToken) return console.warn('Issue with uploading ', record.file);

      // Check if the post already exists. If it does, delete the original record.
      const validatePostResp = await validatePost(headers, contentToken.token);
      if (validatePostResp && validatePostResp.exactPost !== null)
        return deleteResoniteRecord(record, i);

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
        record.metadata.appVersion.includes('+') ? record.metadata.appVersion.split('+')[0]! : null,
      ]
        .map((tag) => tag?.replaceAll(' ', '_'))
        .filter((tag) => tag !== undefined);

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
      if (post) deleteResoniteRecord(record, i);
    })
  );
  // #endregion

  // #region Update tag category
  if (!config.oxibooru.useCategories) process.exit();
  const sortedTags = {
    // TODO: POC! Has to be made the default and then broken down again on post-creation. not the other way around.
    users: screenshots.flatMap((record) => record.metadata.userIds),
    host: screenshots.flatMap((record) => `host:${record.metadata.location.host}`),
    accessLevel: screenshots.flatMap((record) => [
      `accessLevel:${record.metadata.location.accessLevel}`,
      record.metadata.location.accessLevel,
    ]),
    savedBy: screenshots.flatMap((record) =>
      record.additionalTags.filter((tag) => tag.startsWith('savedBy:'))
    ), // Get saved by from addition tags
    takenBy: screenshots.flatMap((record) => `takenBy:${record.metadata.takenBy}`),
    sessionName: screenshots.flatMap((record) => [
      `sessionName:${record.metadata.location.name}`,
      record.metadata.location.name,
    ]),
    hidden: ['hiddenSession'],
    dateTaken: screenshots.flatMap(
      (record) => record.metadata.timeTaken.toISOString().split('T')[0]
    ),
    importerVersion: [appVersion],
    gameVersion: screenshots.flatMap((record) => [
      record.metadata.appVersion,
      // check if modded app-version is set
      record.metadata.appVersion.includes('+') ? record.metadata.appVersion.split('+')[0]! : null,
    ]),
  };

  const isCategorySet = (categoryName: string) =>
    Object.keys(config.oxibooru.categories).find((configName) => configName === categoryName);

  const categories = config.oxibooru.categories;

  if (isCategorySet('users')) updateCategoryTags(headers, sortedTags.users, categories.users);
  if (isCategorySet('host')) updateCategoryTags(headers, sortedTags.host, categories.host);
  if (isCategorySet('accessLevel'))
    updateCategoryTags(headers, sortedTags.accessLevel, categories.accessLevel);
  if (isCategorySet('savedBy')) updateCategoryTags(headers, sortedTags.savedBy, categories.savedBy);
  if (isCategorySet('sessionName'))
    updateCategoryTags(headers, sortedTags.sessionName, categories.sessionName);
  if (isCategorySet('hidden')) updateCategoryTags(headers, sortedTags.hidden, categories.hidden);
  if (isCategorySet('takenBy')) updateCategoryTags(headers, sortedTags.takenBy, categories.takenBy);
  if (isCategorySet('dateTaken'))
    updateCategoryTags(
      headers,
      sortedTags.dateTaken.filter((e) => e !== undefined),
      categories.dateTaken
    );
  if (isCategorySet('importerVersion'))
    updateCategoryTags(headers, sortedTags.importerVersion, categories.importerVersion);
  if (isCategorySet('gameVersion'))
    updateCategoryTags(
      headers,
      sortedTags.gameVersion.filter((e) => e !== null),
      categories.gameVersion
    );
  // #endregion

  // #region Legacy migrations
  // This is a hack! Only needed to cleanup previous posts and will be deleted after.
  if (!config.oxibooru.useLegacyMigrations) process.exit();
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

  // all migrations below require the category feature to be enabled.
  if (!config.oxibooru.useCategories) process.exit();

  // update legacy user categories
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
}
