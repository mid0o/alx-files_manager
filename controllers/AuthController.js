import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    // ** FIX: Add DB connection check **
    if (!dbClient.isAlive()) {
      return response.status(500).json({ error: 'Database connection failed' });
    }
    const authHeader = request.headers.authorization || '';
    if (!authHeader.startsWith('Basic ')) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [email, password] = credentials.split(':');

    if (!email || !password) return response.status(401).json({ error: 'Unauthorized' });

    const hashedPassword = sha1(password);
    const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

    if (!user) return response.status(401).json({ error: 'Unauthorized' });

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 24 * 60 * 60);

    return response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.headers['x-token'];
    if (!token) return response.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) return response.status(401).json({ error: 'Unauthorized' });

    await redisClient.del(key);
    return response.status(204).send();
  }
}

export default AuthController;
