import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  /**
   * Handles the GET /status endpoint.
   * Responds with the status of Redis and the database.
   * @param {object} request The Express request object.
   * @param {object} response The Express response object.
   */
  static getStatus(request, response) {
    const redisAlive = redisClient.isAlive();
    const dbAlive = dbClient.isAlive();
    response.status(200).json({ redis: redisAlive, db: dbAlive });
  }

  /**
   * Handles the GET /stats endpoint.
   * Responds with the number of users and files in the database.
   * @param {object} request The Express request object.
   * @param {object} response The Express response object.
   */
  static async getStats(request, response) {
    try {
      const userCount = await dbClient.nbUsers();
      const fileCount = await dbClient.nbFiles();
      response.status(200).json({ users: userCount, files: fileCount });
    } catch (error) {
      response.status(500).json({ error: 'Server error' });
    }
  }
}

export default AppController;
