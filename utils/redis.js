import redis from 'redis';
import { promisify } from 'util';

// This class will encapsulate all Redis functionalities.
class RedisClient {
  // The constructor runs when we create a new instance of this class.
  constructor() {
    // Create a new Redis client.
    this.client = redis.createClient();

    // Listen for the 'error' event. If the client can't connect, this will fire.
    this.client.on('error', (err) => {
      console.log(`Redis client not connected to the server: ${err.message}`);
    });
  }

  // A function to check if the connection is currently active.
  isAlive() {
    // this.client.connected is a boolean property from the redis library.
    return this.client.connected;
  }

  // An async function to get a value from Redis.
  async get(key) {
    // 'promisify' converts the callback-based 'get' function into a promise-based one.
    const getAsync = promisify(this.client.get).bind(this.client);
    // We can now 'await' the result.
    return getAsync(key);
  }

  // An async function to set a value in Redis with an expiration.
  async set(key, value, duration) {
    // We use 'setex' (SET with EXpiration) for this.
    const setexAsync = promisify(this.client.setex).bind(this.client);
    await setexAsync(key, duration, value);
  }

  // An async function to delete a key from Redis.
  async del(key) {
    const delAsync = promisify(this.client.del).bind(this.client);
    await delAsync(key);
  }
}

// Create one instance of the client that the whole application will share.
const redisClient = new RedisClient();

// Export the instance so other files can import it.
export default redisClient;
