import express from 'express';
import AppController from '../controllers/AppController';

// Create a new router object
const router = express.Router();

// Define the route for GET /status and map it to the AppController.getStatus function
router.get('/status', AppController.getStatus);

// Define the route for GET /stats and map it to the AppController.getStats function
router.get('/stats', AppController.getStats);

// Export the router so it can be used in server.js
export default router;
