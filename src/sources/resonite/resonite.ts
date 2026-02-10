import type { screenshotData } from '../../types';
import config from '../../../config.json';
import { BSON } from 'bson';
import { brotliDecompressSync } from 'zlib';
import type { authentificationResult, tokenBody, resoniteInventoryRecord } from './types';

// Authentication data is globally scoped to the module
// This should be fine since it is never re-used
let tokenBody: tokenBody;
let Authorization: string;

async function authenticateWithResonite(totpCode?: string): Promise<authentificationResult> {
  const authHeaders: Record<string, string> = {
    UID: process.env.resoniteMachineId as string,
    'Content-Type': 'application/json',
  };

  if (totpCode && totpCode.trim() !== '') {
    authHeaders.TOTP = totpCode;
  }

  const tokenResp = await fetch('https://api.resonite.com/userSessions', {
    method: 'POST',
    body: JSON.stringify({
      username: process.env.resoniteUsername as string,
      authentication: {
        $type: 'password',
        password: process.env.resonitePassword as string,
      },
      secretMachineId: `${crypto.randomUUID()}`,
      rememberMe: false,
    }),
    headers: authHeaders,
  });

  if (!tokenResp.ok) {
    const errorText = await tokenResp.text();

    if (errorText === 'TOTP') {
      return { tokenBody: null as any, Authorization: '', requiresTOTP: true };
    }

    throw new Error(
      `Authentication failed: ${tokenResp.status} ${tokenResp.statusText} - ${errorText}`
    );
  }

  const tokenBody = (await tokenResp.json()) as tokenBody;
  const Authorization = `res ${tokenBody.entity.userId}:${tokenBody.entity.token}`;

  return { tokenBody, Authorization, requiresTOTP: false };
}

function getAssetURL(resdbUri: string): string {
  return resdbUri
    .replace(/\.[^.]+$/, '')
    .replace(/^@?resdb:\/\/\//, 'https://assets.resonite.com/');
}

export default async function resonite(): Promise<screenshotData[]> {
  const cfg = config['resonite'];

  // #region get userToken
  const authResult = await authenticateWithResonite();

  if (authResult.requiresTOTP) {
    console.log('2FA is required for this account.');
    console.log('Please enter your 6-digit TOTP code:');

    const totpCode = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data: Buffer) => {
        resolve(data.toString().trim());
      });
    });

    process.stdin.destroy();

    const retryResult = await authenticateWithResonite(totpCode);
    tokenBody = retryResult.tokenBody;
    Authorization = retryResult.Authorization;
  } else {
    tokenBody = authResult.tokenBody;
    Authorization = authResult.Authorization;
  }
  // #endregion

  // #region get scr records
  const recordsRaw = await fetch(
    `https://api.resonite.com/users/${tokenBody.entity.userId}/records?path=${cfg.photoLocation}`,
    { headers: { Authorization } }
  );

  if (!recordsRaw.ok)
    throw new Error(
      `Unable to get inventory records: ${recordsRaw.status} - ${recordsRaw.statusText}`
    );

  const baseRecords = (await recordsRaw.json()) as resoniteInventoryRecord[];

  // convert resDB int record url
  const downloadRecords = baseRecords
    .filter((record) => record.assetUri) // Has an asset Uri
    .filter((record) => record.assetUri!.includes('.brson')) // Asses Uri ends in brson
    .filter((record) => record.recordType === 'object') // Is an object
    .filter((record) => record.name.startsWith('Photo in ')) // Has the correct type of name
    .map((record) => {
      const outRecord = record;
      outRecord.assetURL = getAssetURL(record.assetUri!);
      return outRecord;
    });
  // #endregion

  // #region prepare asset
  // upcycle data and cleanup broken pictures.
  const assetRecords = await Promise.all(
    downloadRecords.map(async (record) => {
      // FIXME: If there are to many requests which causes the Resonite API to lock up.
      // await setTimeout(100);

      // get resonite asset, that holds the component layout and image data
      const rawFileOut = await fetch(record.assetURL);
      const downloadedFile = await rawFileOut.bytes();
      // brotli only uses buffers and remove a file prefix that causes issues on decompression: https://git.unix.dog/yosh/misc-scripts/src/commit/960d187fe42afb4ea2761c54e0e33ddfc54da2ab/resonite-photoexif#L108
      const buffer = Buffer.from(downloadedFile).subarray(9);
      const decompressedFile = await brotliDecompressSync(buffer);
      if (decompressedFile.length === 0) {
        throw new Error(`Unable to decompress Resonite asset: ${record.assetURL}`);
      }
      const doc = await BSON.deserialize(decompressedFile);
      const outRecord = record;

      let components = null;
      if (doc.Object.Children.length !== 0) components = doc.Object.Children[0].Components.Data;
      else if (doc.Object.Components.Data.length !== 0) components = doc.Object.Components.Data;
      if (!components) return null;

      let staticTexture2D: any = null;
      let photoMetadata: any = null;
      // determine if screenshot is legacy or not
      if (doc.Types) {
        staticTexture2D = components.find(
          (comp: any) => comp.Type === doc.Types.indexOf('[FrooxEngine]FrooxEngine.StaticTexture2D')
        );
        photoMetadata = components.find(
          (comp: any) => comp.Type === doc.Types.indexOf('[FrooxEngine]FrooxEngine.PhotoMetadata')
        );
      } else {
        // legacy screenshots lack the Types definition. This is a hack to find the components with the correct data.
        cfg.photoSystemsLegacy.forEach((photoSystem) => {
          if (record.tags.includes(photoSystem.triggerTag)) {
            staticTexture2D = components.find((comp: any) =>
              photoSystem.staticTexture2D.includes(comp.Type)
            );
            photoMetadata = components.find((comp: any) =>
              photoSystem.photoMetadata.includes(comp.Type)
            );
          }
        });
      }

      if (!photoMetadata || !staticTexture2D) {
        throw new Error(`Not a known image system or not a screenshot. ${outRecord}`);
      }
      outRecord.assetURL = getAssetURL(staticTexture2D.Data.URL.Data);

      // FIXME: Hotfix: Skipping records that don't have the metadata filled out.
      if (photoMetadata.Data.LocationName.Data === null) return null;

      // cleanup dataset
      outRecord.photoMetadata = {
        location: {
          name: photoMetadata.Data.LocationName.Data.replace(/<[^>]+>/g, ''),
          host: photoMetadata.Data.LocationHost._userId.Data,
          accessLevel: photoMetadata.Data.LocationAccessLevel.Data,
          hiddenFromListing: photoMetadata.Data.LocationHiddenFromListing.Data,
        },
        timeTaken: photoMetadata.Data.TimeTaken.Data,
        takenBy: photoMetadata.Data.TakenBy._userId.Data,
        appVersion: photoMetadata.Data.AppVersion.Data || '',
        userIds: photoMetadata.Data.UserInfos.Data.map((u: any) => u.User._userId.Data),
        camera: {
          FOV: photoMetadata.Data.CameraFOV.Data,
          model: photoMetadata.Data.CameraModel.Data,
          manufacturer: photoMetadata.Data.CameraManufacturer.Data,
        },
      };
      // TEMP: Direct file export test
      // const result = await fetch(outRecord.assetURL);
      // const path = `./dist/${outRecord.id}`;
      // await Bun.write(path, result);
      return outRecord;
    })
  );
  // #endregion

  // Filter out null records and convert them to the generic format
  return assetRecords
    .filter((record) => record !== null)
    .map((record) => {
      // sanitize default tags
      const defaultTags = record.tags.map((tag) => tag.replace(/<[^>]+>/g, ''));
      [
        record.photoMetadata.location.name.toLowerCase(),
        defaultTags.find((tag) => tag.startsWith('texture_asset')) || '',
        defaultTags.find((tag) => tag.startsWith('timestamp')) || '',
        defaultTags.find((tag) => tag.startsWith('location_accesslevel')) || '',
        defaultTags.find((tag) => tag.startsWith('location_hiddenfromlisting')) || '',
        defaultTags.find((tag) => tag.startsWith('location_host')) || '',
        defaultTags.find((tag) => tag.startsWith('location_name')) || '',
        'in',
      ].forEach((removeTag) => {
        const removeIndex = defaultTags.indexOf(removeTag);
        if (removeIndex !== -1) defaultTags.splice(removeIndex, 1);
      });
      defaultTags.push(`savedBy:${record.ownerId}`);

      return {
        file: {
          path: record.assetURL,
          isRemote: true,
        },
        metadata: record.photoMetadata,
        additionalTags: defaultTags,
      };
    });
}
