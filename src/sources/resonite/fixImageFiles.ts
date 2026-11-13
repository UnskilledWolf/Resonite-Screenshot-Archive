import { newQueue } from '@henrygd/queue';
import { mkdir } from 'node:fs/promises';
import { convert, identify } from 'imagemagick';
import type { screenshotData } from '../../types';

export default async function fixImageFiles(records: screenshotData[]) {
  // picture has to be downloaded because of issues with the pictures having an alpha layer
  // TODO make the path somehow configurable and also ensure that it is created in the directory that is should be
  await mkdir('./dist', { recursive: true });

  const processQueue = newQueue(10);

  // Wait for all image processes to be done
  await processQueue.all(
    records.map((record) => async () => {
      await fixImageFile(record);
    })
  );
}

// Fixes an image. Potentially downloading it and modifying the original screenshotData
// TODO maybe have the image be duplicated if it is already somehow remote instead of overwriting the original data
async function fixImageFile(record: screenshotData) {
  const assetURL = record.file.path;

  // TODO remember to also make the base path configurable here
  const filename = `./dist/${assetURL.split('/').pop()}`;

  if (record.file.isRemote) {
    // download pic
    const fileDownload = await fetch(assetURL);
    await Bun.write(filename, fileDownload);

    //! The object containing the record is modified here.
    record.file = {
      path: filename,
      isRemote: false,
    };
  } else {
    console.warn('fixImageFile is not intended to be used with a local file: ', record.file.path);
  }

  const isPNG = await new Promise((resolve, reject) => {
    identify(filename, async (err, stdout) => {
      if (err || !stdout.format) return reject(err);
      if (stdout.format === 'PNG') return resolve(true);
      resolve(false);
    });
  });

  if (isPNG === true) {
    // fix the image
    const filenameEdit = `${filename}_edit.png`;
    await new Promise((resolve, reject) => {
      convert(`${filename} -alpha off ${filenameEdit}`.split(' '), async (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      });
    });
    // form data fuckery to upload the picture
    // const fileEditRaw = Bun.file(filenameEdit);
    // const formData = new FormData();
    // await formData.append('content', fileEditRaw);
  }
}
