import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import Bull from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Bull('userQueue');

class UsersController {
  static async postNew(request, response) {
    // ** FIX: Add DB connection check **
    if (!dbClient.isAlive()) {
      return response.status(500).json({ error: 'Database connection failed' });
    }
    const { email, password } = request.body;

    if (!email) return response.status(400).json({ error: 'Missing email' });
    if (!password) return response.status(400).json({ error: 'Missing password' });

    const usersCollection = dbClient.db.collection('users');
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return response.status(400).json({ error: 'Already exist' });

    const hashedPassword = sha1(password);
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
    });

    await userQueue.add({ userId: result.insertedId.toString() });

    return response.status(201).json({ id: result.insertedId, email });
  }

  static async getMe(request, response) {
    // ** FIX: Add DB connection check **
    if (!dbClient.isAlive()) {
      return response.status(500).json({ error: 'Database connection failed' });
    }
    const token = request.headers['x-token'];
    if (!token) return response.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return response.status(401).json({ error: 'Unauthorized' });

    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    return response.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
