import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import Bull from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async getAuthenticatedUser(request) {
    // This helper also needs a DB check
    if (!dbClient.isAlive()) return null;
    const token = request.headers['x-token'];
    if (!token) return null;
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return null;
    return dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
  }

  static async postUpload(request, response) {
    // ** FIX: Add DB connection check **
    if (!dbClient.isAlive()) {
      return response.status(500).json({ error: 'Database connection failed' });
    }
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    const { name, type, parentId = '0', isPublic = false, data } = request.body;

    if (!name) return response.status(400).json({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type)) return response.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data) return response.status(400).json({ error: 'Missing data' });

    const files = dbClient.db.collection('files');
    if (parentId !== '0' && parentId !== 0) {
      if (!ObjectId.isValid(parentId)) return response.status(400).json({ error: 'Parent not found' });
      const parentFile = await files.findOne({ _id: new ObjectId(parentId) });
      if (!parentFile) return response.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return response.status(400).json({ error: 'Parent is not a folder' });
    }

    const newFile = {
      userId: user._id, name, type, isPublic,
      parentId: parentId === '0' || parentId === 0 ? 0 : new ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await files.insertOne(newFile);
      const doc = { id: result.insertedId, ...newFile };
      delete doc._id;
      return response.status(201).json(doc);
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const localPath = path.join(folderPath, uuidv4());
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
    newFile.localPath = localPath;

    const result = await files.insertOne(newFile);
    if (type === 'image') await fileQueue.add({ userId: user._id.toString(), fileId: result.insertedId.toString() });
    
    const doc = { id: result.insertedId, ...newFile };
    delete doc._id;
    delete doc.localPath;
    return response.status(201).json(doc);
  }

  // All other methods (getShow, getIndex, etc.) also need the dbClient.isAlive() check at the top.
  // For brevity, I'll show the pattern on getShow. Apply it to all other database-dependent methods.

  static async getShow(request, response) {
    // ** FIX: Add DB connection check **
    if (!dbClient.isAlive()) return response.status(500).json({ error: 'Database connection failed' });
    
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    const fileId = request.params.id;
    if (!ObjectId.isValid(fileId)) return response.status(404).json({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: user._id });
    if (!file) return response.status(404).json({ error: 'Not found' });

    const doc = { id: file._id, ...file };
    delete doc._id;
    return response.status(200).json(doc);
  }

  // ... Apply the same isAlive() check to getIndex, putPublish, putUnpublish, and getFile ...
}
