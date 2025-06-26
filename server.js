import express from 'express';
import routes from './routes/index';

// Create the Express application
const app = express();

// Set the port from environment variable or default to 5000
const port = process.env.PORT || 5000;

// Tell the app to use the routes defined in routes/index.js
app.use('/', routes);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
