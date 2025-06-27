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
  // Helper to get user from token
  static async getAuthenticatedUser(request) {
    const token = request.headers['x-token'];
    if (!token) return null;
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return null;
    return dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
  }

  static async postUpload(request, response) {
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    const { name, type, parentId = '0', isPublic = false, data } = request.body;

    if (!name) return response.status(400).json({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type)) return response.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data) return response.status(400).json({ error: 'Missing data' });

    const files = dbClient.db.collection('files');
    if (parentId !== '0' && parentId !== 0) {
      // ** FIX: Validate parentId format **
      if (!ObjectId.isValid(parentId)) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      const parentFile = await files.findOne({ _id: new ObjectId(parentId) });
      if (!parentFile) return response.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return response.status(400).json({ error: 'Parent is not a folder' });
    }

    const newFile = {
      userId: user._id,
      name,
      type,
      isPublic,
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

  static async getShow(request, response) {
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    // ** FIX: Validate fileId format **
    const fileId = request.params.id;
    if (!ObjectId.isValid(fileId)) {
        return response.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: user._id,
    });
    if (!file) return response.status(404).json({ error: 'Not found' });

    const doc = { id: file._id, ...file };
    delete doc._id;
    return response.status(200).json(doc);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    const parentId = request.query.parentId || '0';
    const page = parseInt(request.query.page, 10) || 0;

    // ** FIX: Validate parentId format if it's not the root **
    if (parentId !== '0' && parentId !== 0 && !ObjectId.isValid(parentId)) {
        return response.status(200).json([]); // Return empty list for invalid parentId
    }

    const query = {
        userId: user._id,
        parentId: parentId === '0' ? 0 : new ObjectId(parentId)
    };

    const files = await dbClient.db.collection('files').aggregate([
      { $match: query },
      { $sort: { _id: 1 } },
      { $skip: page * 20 },
      { $limit: 20 },
      { $project: { localPath: 0 } }
    ]).toArray();

    return response.status(200).json(files.map(f => {
      const doc = { id: f._id, ...f };
      delete doc._id;
      return doc;
    }));
  }

  static async updatePublicStatus(request, response, isPublic) {
    const user = await FilesController.getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    // ** FIX: Validate fileId format **
    const fileId = request.params.id;
    if (!ObjectId.isValid(fileId)) {
        return response.status(404).json({ error: 'Not found' });
    }

    const { value: file } = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: new ObjectId(fileId), userId: user._id },
      { $set: { isPublic } },
      { returnDocument: 'after' },
    );

    if (!file) return response.status(404).json({ error: 'Not found' });
    
    const doc = { id: file._id, ...file };
    delete doc._id;
    return response.status(200).json(doc);
  }

  static async putPublish(request, response) {
    return FilesController.updatePublicStatus(request, response, true);
  }

  static async putUnpublish(request, response) {
    return FilesController.updatePublicStatus(request, response, false);
  }

  static async getFile(request, response) {
    const fileId = request.params.id;
    const { size } = request.query;

    // ** FIX: Validate fileId format **
    if (!ObjectId.isValid(fileId)) {
        return response.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
    if (!file) return response.status(404).json({ error: 'Not found' });

    if (!file.isPublic) {
      const user = await FilesController.getAuthenticatedUser(request);
      if (!user || user._id.toString() !== file.userId.toString()) {
        return response.status(404).json({ error: 'Not found' });
      }
    }
    if (file.type === 'folder') return response.status(400).json({ error: "A folder doesn't have content" });
    
    let filePath = file.localPath;
    if (size) {
        const validSizes = ['500', '250', '100'];
        if (!validSizes.includes(size)) {
            return response.status(400).json({ error: 'Invalid size parameter' });
        }
        filePath = `${filePath}_${size}`;
    }
    
    if (!fs.existsSync(filePath)) return response.status(404).json({ error: 'Not found' });

    response.setHeader('Content-Type', mime.lookup(file.name));
    return fs.createReadStream(filePath).pipe(response);
  }
}

export default FilesController;
