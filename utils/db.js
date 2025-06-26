// utils/db.js
import { MongoClient } from 'mongodb';

/**
 * Represents a client for interacting with MongoDB.
 */
class DBClient {
  /**
   * Creates a new DBClient instance and connects to the database.
   */
  constructor() {
    // Read connection info from environment variables with defaults
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;

    // Create a new client
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    // Connect and store the database object
    this.client.connect((err) => {
      if (!err) {
        this.db = this.client.db(database);
      } else {
        // If connection fails, set db to null to handle errors gracefully
        this.db = null;
      }
    });
  }

  /**
   * Checks if the client's connection to MongoDB is active.
   * @returns {boolean} True if connected, false otherwise.
   */
  isAlive() {
    return this.client.isConnected();
  }

  /**
   * Retrieves the number of documents in the 'users' collection.
   * @returns {Promise<number>} The number of users.
   */
  async nbUsers() {
    if (!this.isAlive()) return 0;
    return this.db.collection('users').countDocuments();
  }

  /**
   * Retrieves the number of documents in the 'files' collection.
   * @returns {Promise<number>} The number of files.
   */
  async nbFiles() {
    if (!this.isAlive()) return 0;
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
