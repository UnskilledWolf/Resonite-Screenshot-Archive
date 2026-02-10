import { setTimeout } from 'timers/promises';
import searchTags from '../src/destrinations/oxibooru/api/searchTags';
import genericCall from '../src/destrinations/oxibooru/api/geneticCall';

type resoniteProgfile = {
  id: string;
  username: string;
  normalizedUsername: string;
  registrationDate: string;
  isVerified: boolean;
  isLocked: boolean;
  supressBanEvasion: boolean;
  '2fa_login': boolean;
  tags: string[];
  profile: {
    iconUrl: string;
    displayBadges: string[];
  };
  isActiveSupporter: boolean;
};

async function getResoniteProfile(uid: string): Promise<resoniteProgfile | null> {
  const result = await fetch('http://api.resonite.com/users/' + uid);

  await setTimeout(1000);

  if (!result.ok) {
    {
      console.error("Can't find", uid);
      return null;
    }
  } else return (await result.json()) as resoniteProgfile;
}

async function getKnownUsername(uid: string): Promise<string | null> {
  const result = await searchTags(
    headers,
    `?${new URLSearchParams({ query: 'category:User ' + uid, limit: '1000', fields: 'names,version' })}`
  );

  if (!result) {
    console.error("Can't find " + uid);
    return null;
  } else return result.results[0]?.names[0]!;
}

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

const userTags = await searchTags(
  headers,
  `?${new URLSearchParams({ query: 'category:User', limit: '1000', fields: 'names,version' })}`
);

if (userTags) {
  for (const tag of userTags.results) {
    // See if it is a single tag with no assigned user
    if (tag.names.length === 1 && tag.names[0]?.startsWith('U-')) {
      const profile = await getResoniteProfile(tag.names[0]);

      if (!profile) continue;

      const username = profile.username.replaceAll(' ', '_');

      // See if the username is already a tag
      // Maybe it would be better to error if there is a conflict, but for now, it auto merges
      const usernameSearch = await searchTags(
        headers,
        `?${new URLSearchParams({ query: username, limit: '10', fields: 'names,version' })}`
      );

      if (usernameSearch && usernameSearch.results.length > 0) {
        // Merge the tag
        const data = await genericCall('tag-merge/', 'POST', headers, {
          body: {
            removeVersion: tag.version,
            remove: tag.names[0],
            mergeToVersion: usernameSearch.results[0]?.version,
            mergeTo: usernameSearch.results[0]?.names[0],
          },
        });

        if (!data?.ok)
          console.error('Failed to merge ', tag.names[0], usernameSearch.results[0]?.names[0]);
        else console.log('Merged ' + tag.names[0]);
      }
      // Set a new preferred name is the username is not already assigned
      else {
        const data = await genericCall('tag/', 'PUT', headers, {
          args: tag.names[0],
          body: {
            names: [username, ...tag.names],
            version: tag.version,
          },
        });

        if (!data?.ok) console.error('Failed to update ', [username, ...tag.names]);
        else console.log('Found ' + tag.names[0]);
      }
    }
  }
}

///
// Fix Taken by
// based on data already in db
//

const sessionHostTags = await searchTags(
  headers,
  `?${new URLSearchParams({ query: 'category:SessionHost', limit: '1000', fields: 'names,version' })}`
);

if (sessionHostTags) {
  for (const tag of sessionHostTags.results) {
    // See if it is a single tag with no assigned user
    if (tag.names.length === 1 && tag.names[0]?.startsWith('host:U-')) {
      const username = await getKnownUsername(tag.names[0].substring(5));

      if (!username) continue;

      // See if the username is already a tag
      // Maybe it would be better to error if there is a conflict, but for now, it auto merges
      const usernameSearch = await searchTags(
        headers,
        `?${new URLSearchParams({ query: 'host\\:' + username, limit: '10', fields: 'names,version' })}`
      );

      if (usernameSearch && usernameSearch.results.length > 0) {
        // Merge the tag
        const data = await genericCall('tag-merge/', 'POST', headers, {
          body: {
            removeVersion: tag.version,
            remove: tag.names[0],
            mergeToVersion: usernameSearch.results[0]?.version,
            mergeTo: usernameSearch.results[0]?.names[0],
          },
        });

        if (!data?.ok)
          console.error('Failed to merge ', tag.names[0], usernameSearch.results[0]?.names[0]);
        else console.log('Merged ' + tag.names[0]);
      }
      // Set a new preferred name is the username is not already assigned
      else {
        const data = await genericCall('tag/', 'PUT', headers, {
          args: tag.names[0],
          body: {
            names: ['host:' + username, ...tag.names],
            version: tag.version,
          },
        });

        if (!data?.ok) console.error('Failed to update ', ['host:' + username, ...tag.names]);
        else console.log('Found ' + tag.names[0]);
      }
    }
  }
}

///
// Fix Session Hosts
// based on data already in db
//

const takenByTags = await searchTags(
  headers,
  `?${new URLSearchParams({ query: 'category:TakenBy', limit: '1000', fields: 'names,version' })}`
);

if (takenByTags) {
  for (const tag of takenByTags.results) {
    // See if it is a single tag with no assigned user
    if (tag.names.length === 1 && tag.names[0]?.startsWith('takenBy:U-')) {
      const username = await getKnownUsername(tag.names[0].substring(8));

      if (!username) continue;

      // See if the username is already a tag
      // Maybe it would be better to error if there is a conflict, but for now, it auto merges
      const usernameSearch = await searchTags(
        headers,
        `?${new URLSearchParams({ query: 'takenBy\\:' + username, limit: '10', fields: 'names,version' })}`
      );

      if (usernameSearch && usernameSearch.results.length > 0) {
        // Merge the tag
        const data = await genericCall('tag-merge/', 'POST', headers, {
          body: {
            removeVersion: tag.version,
            remove: tag.names[0],
            mergeToVersion: usernameSearch.results[0]?.version,
            mergeTo: usernameSearch.results[0]?.names[0],
          },
        });

        if (!data?.ok)
          console.error('Failed to merge ', tag.names[0], usernameSearch.results[0]?.names[0]);
        else console.log('Merged ' + tag.names[0]);
      }
      // Set a new preferred name is the username is not already assigned
      else {
        const data = await genericCall('tag/', 'PUT', headers, {
          args: tag.names[0],
          body: {
            names: ['takenBy:' + username, ...tag.names],
            version: tag.version,
          },
        });

        if (!data?.ok) console.error('Failed to update ', ['takenBy:' + username, ...tag.names]);
        else console.log('Found ' + tag.names[0]);
      }
    }
  }
}
