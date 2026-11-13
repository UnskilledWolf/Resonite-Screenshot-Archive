import { version as appVersion } from '../../../package.json';
import type { screenshotData } from '../../types';
import config from '../../../config.json';
import getTagCategories from './api/getTagCategories';
import createTagCategory from './api/createTagCategory';
import getTag from './api/getTag';
import updateTag from './api/updateTag';

export default async function processCategories(screenshots: screenshotData[], headers: Headers) {
  // #region Update categories
  // Flatten the categories object of the config into an array of its values
  const configTagCategories = Object.entries(config.oxibooru.categories).map((e) => e[1]);

  // Get the remote categories and flatten them as well
  const getTagCategoriesResult = await getTagCategories(headers);
  const remoteTagCategories = getTagCategoriesResult.results.map((c) => c.name);

  await Promise.all(
    configTagCategories.map(async (configCategoryName, i) => {
      // Check if the category already exists
      const categoryExists = remoteTagCategories.includes(configCategoryName);

      if (!categoryExists) {
        const output = await createTagCategory(headers, configCategoryName, 'default', i);

        if (!output) throw new Error(`Couldn't create category ${configCategoryName}.`);
        return;
      }
    })
  );
  // #endregion

  // #region Update new tags
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
      record.metadata.appVersion
        ? record.metadata.appVersion.includes('+')
          ? record.metadata.appVersion.split('+')[0]!
          : null
        : null,
    ]),
  };

  const isCategorySet = (categoryName: string) =>
    Object.keys(config.oxibooru.categories).find((configName) => configName === categoryName);

  const configuredCategories = config.oxibooru.categories;

  if (isCategorySet('users'))
    updateCategoryTags(headers, sortedTags.users, configuredCategories.users);
  if (isCategorySet('host'))
    updateCategoryTags(headers, sortedTags.host, configuredCategories.host);
  if (isCategorySet('accessLevel'))
    updateCategoryTags(headers, sortedTags.accessLevel, configuredCategories.accessLevel);
  if (isCategorySet('savedBy'))
    updateCategoryTags(headers, sortedTags.savedBy, configuredCategories.savedBy);
  if (isCategorySet('sessionName'))
    updateCategoryTags(headers, sortedTags.sessionName, configuredCategories.sessionName);
  if (isCategorySet('hidden'))
    updateCategoryTags(headers, sortedTags.hidden, configuredCategories.hidden);
  if (isCategorySet('takenBy'))
    updateCategoryTags(headers, sortedTags.takenBy, configuredCategories.takenBy);
  if (isCategorySet('dateTaken'))
    updateCategoryTags(
      headers,
      sortedTags.dateTaken.filter((e) => e !== undefined),
      configuredCategories.dateTaken
    );
  if (isCategorySet('importerVersion'))
    updateCategoryTags(headers, sortedTags.importerVersion, configuredCategories.importerVersion);
  if (isCategorySet('gameVersion'))
    updateCategoryTags(
      headers,
      sortedTags.gameVersion.filter((e) => e !== null),
      configuredCategories.gameVersion
    );
  // #endregion
}

// FIXME: want to use typeof categories, but im stoopid
// TODO: this function should no longer be exported once the legacy migrations are improved. Potentially move part of them into this file
export async function updateCategoryTags(headers: Headers, tags: string[], category: string) {
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
