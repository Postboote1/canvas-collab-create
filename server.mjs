
import { PeerServer } from 'peerjs';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 9000;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure PeerJS server
const peerServer = PeerServer({
  port: 9001,
  path: '/peerjs',
  proxied: true,
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

console.log('PeerJS server running on port 9001 with path /peerjs');

// Serve static files from the dist directory when in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // For any request that doesn't match a static file, serve the index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start Express server
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
