import type { screenshotMetadata, userId } from '../../types';

export type authentificationResult = {
  tokenBody: tokenBody;
  Authorization: string;
  requiresTOTP: boolean;
};

export type tokenBody = {
  entity: {
    userId: string;
    token: string;
  };
};

export type resoniteInventoryRecord = {
  id: string;
  name: `Photo in ${string}`;
  tags: string[];
  assetUri?: string;
  recordId: string;
  imageURL: string;
  assetURL: string;
  recordType: 'object';
  ownerId: string;
  photoMetadata: screenshotMetadata;
};

export type resoniteUserRecord = {
  id: userId;
  username: string;
  profile: {
    iconUrl: `resdb:///${string}`;
  };
} | null;
