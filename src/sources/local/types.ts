export type accessLevel =
  | 'Anyone'
  | 'RegisteredUsers'
  | 'FriendsOfFriends'
  | 'Private'
  | 'Contacts';

export type userSummary = {
  Username: string;
  UserId: string;
};

export type userInfoSummary = {
  User: userSummary;
  IsInVR: boolean;
  IsPresent: boolean;
  HeadPosition: [number, number, number];
  HeadOrientation: [number, number, number, number];
  SessionJoinTimestamp: string;
};

export type photoMetadataSummary = {
  CameraManufacturer: string;
  CameraModel: string;
  CameraFOV: number;
  Is360: number;
  IsStereo: number;
  LocationName: string;
  LocationURL: string;
  LocationHost: userSummary;
  LocationAccessLevel: accessLevel;
  LocationHiddenFromListing: boolean;
  TimeTaken: string;
  TakenBy: userSummary;
  TakenGlobalPosition: [number, number, number];
  TakenGlobalRotation: [number, number, number, number];
  TakenGlobalScale: number;
  AppVersion: string;
  UserInfos: userInfoSummary[];
  filename: string;
};
