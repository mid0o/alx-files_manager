import Bull from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs/promises';
import dbClient from './utils/db';

const fileQueue = new Bull('fileQueue');
const userQueue = new Bull('userQueue');

// Task 9: Process thumbnail generation jobs
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });
  if (!file) throw new Error('File not found');
  if (!file.localPath) throw new Error('File has no local path');

  try {
    const originalPath = file.localPath;
    const sizes = [500, 250, 100];
    await Promise.all(sizes.map(async (size) => {
      const thumbnail = await imageThumbnail(originalPath, { width: size });
      await fs.writeFile(`${originalPath}_${size}`, thumbnail);
    }));
  } catch (err) {
    console.error(`Thumbnail generation failed for file ${fileId}:`, err);
  }
});

// Task 11: Process welcome email jobs
userQueue.process(async (job) => {
  const { userId } = job.data;
  if (!userId) throw new Error('Missing userId');

  const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');

  // This just logs to the console as a simulation of sending an email.
  console.log(`Welcome ${user.email}!`);
});
