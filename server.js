import express from 'express';
import routes from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON request bodies. Increased limit for file uploads.
app.use(express.json({ limit: '10mb' }));

// Load all routes from routes/index.js
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
