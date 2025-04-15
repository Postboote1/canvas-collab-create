import os from 'os';
import PocketBase from 'pocketbase';

// Configuration
const INTERVAL_MINUTES = 15;
const SERVER_URL = 'http://localhost:8090';

// Initialize PocketBase client directly
const pb = new PocketBase(SERVER_URL);

// Add admin authentication
async function authenticate() {
    try {
      // You'll need to set these values - they should match your admin account
      await pb.admins.authWithPassword(
        "stoessel.matthias@web.de",  // Replace with your admin email
        "Minecraft#cc#Matz0212!"        // Replace with your admin password
      );
      console.log("Authenticated with PocketBase admin");
      return true;
    } catch (error) {
      console.error("Authentication failed:", error);
      return false;
    }
  }

async function collectAndStoreMetrics() {
  try {
    console.log('Collecting server metrics...');
    
    // Get CPU metrics
    const cpuLoad = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsage = (cpuLoad / cpuCount) * 100;

    // Get memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    // Get storage usage from canvases
    let storageUsage = 0;
    try {
      const canvasRecords = await pb.collection('canvases').getFullList({
        sort: '-created',
      });
      storageUsage = canvasRecords.reduce((acc, canvas) => acc + (canvas.size || 0), 0);
    } catch (err) {
      console.warn('Error getting canvas storage:', err);
    }

    // Get active users from logs
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    let activeUsers = 0;
    try {
      const result = await pb.collection('logs').getList(1, 1, {
        filter: `created >= "${oneHourAgo.toISOString()}" && collection = "users"`,
      });
      activeUsers = result.totalItems;
    } catch (err) {
      console.warn('Unable to get active users count - logs collection may not exist yet');
    }

    console.log('Saving metrics data:', {
        timestamp: new Date().toISOString(),
        cpu: cpuUsage,
        memory: memoryUsage,
        storage: storageUsage,
        activeUsers: activeUsers,
        apiRequests: 0
      });
    // Store metrics
    try {
        const data = {
          timestamp: new Date().toISOString(),
          cpu: cpuUsage,
          memory: memoryUsage,
          storage: storageUsage,
          activeUsers: activeUsers,
          apiRequests: 0
        };
        
        console.log('Saving metrics data:', data);
        await pb.collection('serverMetrics').create(data);
        console.log('Server metrics recorded successfully');
      } catch (error) {
        console.error('Failed to store metrics:', error);
        
        if (error.status === 401) {
          console.log('Authentication expired, reconnecting...');
          await authenticate();
        }
        try {
            const savedRecord = await pb.collection('serverMetrics').getList(1, 1, {
              sort: '-created',
            });
            if (savedRecord.items.length > 0) {
              console.log('Successfully saved and retrieved metrics:', savedRecord.items[0]);
            }
          } catch (err) {
            console.error('Failed to verify metrics were saved:', err);
        }
      }
    } catch (error) {
      console.error("Failed to collect metrics:", error);
    }
  }

  export async function startMetricsCollector() {
    console.log(`Starting metrics collector. Interval: ${INTERVAL_MINUTES} minutes`);
    
    // Authenticate first
    await authenticate();
    
    // Initial collection after 30 seconds to allow PocketBase to initialize fully
    setTimeout(() => {
      collectAndStoreMetrics();
      
      // Set up regular interval
      setInterval(collectAndStoreMetrics, INTERVAL_MINUTES * 60 * 1000);
    }, 30000);
  }

// If this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMetricsCollector();
}