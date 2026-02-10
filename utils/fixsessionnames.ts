import deleteTag from '../src/destrinations/oxibooru/api/deleteTag';
import searchTags from '../src/destrinations/oxibooru/api/searchTags';

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

const tags = await searchTags(
  headers,
  `?${new URLSearchParams({ query: 'category:SessionName', limit: '200', fields: 'names,version' })}`
);

if (tags) {
  for (const tag of tags.results) {
    if (tag.names.length === 1 && !tag.names[0]?.startsWith('sessionName:')) {
      console.log('Removing tag', tag.names);
      await deleteTag(headers, tag.names[0]!, tag.version!);
    }
  }
}
