import express from 'express';
import { createServer } from 'http';
import { ExpressPeerServer } from 'peer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 9000;

// Enhanced CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true
}));

// Create PeerJS server with minimal configuration
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
  proxied: false // Changed from true to false
});

// Mount PeerJS server - FIX: mount it at a specific route instead of root
app.use('/peerjs', peerServer);  // Changed from '/' to '/peerjs'

// Serve static files for production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // FIX: change the catch-all route to avoid conflicts
  app.get('/*', (req, res) => {
    // Skip processing PeerJS requests
    if (req.path.startsWith('/peerjs')) {
      return;
    }
    
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start the server on all network interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`PeerJS server available at http://<your-ip>:${PORT}/peerjs`);
  
  // Display local IP addresses for easy connection
  const nets = networkInterfaces();
  
  console.log('\nAvailable on:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  http://${net.address}:${PORT}`);
      }
    }
  }
});

// Log connections and disconnections
peerServer.on('connection', (client) => {
  console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Client disconnected:', client.getId());
});