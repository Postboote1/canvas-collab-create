
# Deployment Guide

This app consists of a React frontend and a PeerJS server for real-time collaboration.

## Local Development

1. Install dependencies:
```
npm install
```

2. Start both the Vite dev server and PeerJS server:
```
node scripts/start-dev.js
```

This starts:
- Vite dev server on port 8080
- PeerJS server on port 9001

## Production Deployment

### Option 1: Deploy to a VPS or dedicated server

1. Clone the repository
2. Install dependencies:
```
npm install
```

3. Build the frontend:
```
npm run build
```

4. Start the production server:
```
NODE_ENV=production node server.js
```

This will serve both:
- The static frontend from the 'dist' directory
- The PeerJS server at the /peerjs endpoint

### Option 2: Deploy to platforms like Heroku, Render, or Railway

1. Push your code to a Git repository
2. Connect your repository to your deployment platform
3. Set up the build command: `npm run build`
4. Set up the start command: `NODE_ENV=production node server.js`
5. (Optional) Set environment variables:
   - PORT: The port your app will run on (usually set automatically by the platform)

### Option 3: Separate deployments for frontend and backend

#### Frontend (Static hosting like Netlify, Vercel, GitHub Pages)
1. Build the frontend: `npm run build`
2. Deploy the 'dist' directory to your static hosting provider
3. Make sure to update the peer configuration to point to your PeerJS server URL

#### Backend (PeerJS server only)
1. Deploy only the server.js file to a Node.js hosting platform
2. Start command: `node server.js`

## Environment Variables

- `PORT`: Port for the Express server (default: 9000)
- `NODE_ENV`: Set to 'production' for production mode

## Important Notes

- Make sure your server's firewall allows incoming connections on the specified ports
- For production, consider setting up HTTPS for secure connections
- Update the peer connection configuration in the frontend code if your PeerJS server URL changes
