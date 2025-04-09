
import { PeerServer } from 'peerjs';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 9000;

// Enable CORS for all routes with proper configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests
app.options('*', cors());

// Configure PeerJS server with proper CORS
const peerServer = PeerServer({
  port: 9000,
  path: '/peerjs',
  proxied: true,
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  },
  // Add debug option to see connection issues
  debug: true
});

console.log('PeerJS server running on port 9000 with path /peerjs');

// Serve static files from the dist directory when in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // For any request that doesn't match a static file, serve the index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start Express server on the same port as PeerJS server is already listening
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
