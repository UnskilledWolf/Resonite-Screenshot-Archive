export type sourceFunction = () => Promise<screenshotData>;
export type destinationFunction = (screenshots: screenshotData[]) => Promise<void>;

export type location = {
  name: string;
  host: string;
  accessLevel: 'Anyone' | 'RegisteredUsers' | 'FriendsOfFriends' | 'Private' | 'Contacts';
  hiddenFromListing: boolean;
};

type camera = {
  FOV: number;
  manufacturer: string;
  model: string;
};

export type userId = `U-${string}`;

export type screenshotData = {
  file: screenshotSource;
  metadata: screenshotMetadata;
  additionalTags: string[]; // Any additional tags provided by the source
};

export type screenshotSource = {
  path: string;
  isRemote: boolean;
};

export type screenshotMetadata = {
  location: location;
  timeTaken: Date;
  takenBy: userId;
  appVersion: `${number}.${number}.${number}.${number}${`+${string}` | ''}`;
  userIds: userId[];
  camera: camera;
};

// Wraps an original data structure in a deletion record
// Just to ensure that data meant to be deleted is properly identifiable with the type system
export type deletionRecord<A> = {
  original: A
}
