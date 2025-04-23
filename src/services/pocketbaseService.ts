import PocketBase from 'pocketbase';

class PocketBaseService {
  private static instance: PocketBaseService;
  public client: PocketBase;
  private activeRequests: Map<string, AbortController> = new Map();
  
  private constructor() {
    this.client = new PocketBase('https://pb.canvascollab.de');
    
    // IMPORTANT: Enable auto-cancellation (it was disabled before)
    this.client.autoCancellation(true);
    
    // Listen for browser navigation to clean up requests
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cancelAllRequests());
    }
  }
  
  public static getInstance(): PocketBaseService {
    if (!PocketBaseService.instance) {
      PocketBaseService.instance = new PocketBaseService();
    }
    return PocketBaseService.instance;
  }
  
  // Add proper request management
  public cancelRequest(key: string): void {
    if (this.activeRequests.has(key)) {
      const controller = this.activeRequests.get(key);
      try {
        controller.abort();
      } catch (err) {
        console.warn('Error aborting request:', err);
      }
      this.activeRequests.delete(key);
    }
  }
  
  public cancelAllRequests(): void {
    this.activeRequests.forEach(controller => {
      try {
        controller.abort();
      } catch (e) {
        // Ignore abort errors
      }
    });
    this.activeRequests.clear();
    
    // Force cancel any lingering PocketBase requests
    try {
      this.client.cancelAllRequests();
    } catch (e) {
      console.error("Error cancelling PB requests:", e);
    }
  }
  
  // Optimize setting fetching to use fewer resources
  public async getSettings() {
    try {
      const cancelKey = 'getSettings';
      // Create controller and register it
      const controller = new AbortController();
      this.activeRequests.set(cancelKey, controller);
      
      // Only get essential fields
      const settings = await this.client.collection('appSettings').getFirstListItem('', {
        fields: 'id,allowRegistration,maxCanvasesPerUser,maxStoragePerUser',
        $cancelKey: cancelKey
      });
      
      // Clean up on success
      this.activeRequests.delete(cancelKey);
      return settings;
    } catch (error) {
      // Only log non-abort errors
      if (error?.name !== 'AbortError') {
        console.error('Error fetching settings:', error);
      }
      
      // Return default settings on error
      return {
        allowRegistration: true,
        maxCanvasesPerUser: 5,
        maxStoragePerUser: 26214400 // 25MB
      };
    }
  }

    // Add safe request methods with better error handling
    public async getCanvas(id: string) {
      try {
        const cancelKey = `canvas_${id}`;
        // Create controller and register it
        const controller = new AbortController();
        this.activeRequests.set(cancelKey, controller);
        
        // Check if it's a mobile device to optimize response
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          typeof navigator !== 'undefined' ? navigator.userAgent : ''
        );
        
        // Use it for the request with mobile-specific optimizations
        const record = await this.client.collection('canvases').getOne(id, {
          $cancelKey: cancelKey,
          expand: 'user',
          // On mobile, use batch loading to reduce memory pressure
          batch: isMobileDevice ? 100 : 0,
          // If on mobile, only request essential fields initially
          fields: isMobileDevice ? 'id,name,data.isInfinite,joinCode,user' : undefined
        });
        
        // Clean up on success
        this.activeRequests.delete(cancelKey);
        
        // For mobile devices, perform a delayed load of canvas elements
        if (isMobileDevice && record) {
          // If this is a mobile device and we have limited fields, 
          // fetch elements in the background asynchronously
          setTimeout(async () => {
            try {
              await this.client.collection('canvases').getOne(id, {
                fields: 'data.elements',
                $autoCancel: false
              });
            } catch (e) {
              // Silently fail on background fetch
            }
          }, 500);
        }
        
        return record;
      } catch (error) {
        // Check if it's an abort error - don't report those
        if (error?.name !== 'AbortError') {
          console.error('Error fetching canvas:', error);
        }
        throw error;
      }
    }
  
    // Add method for canvas listings with proper error handling
    public async getCanvasList() {
      try {
        const cancelKey = 'canvas_list';
        const controller = new AbortController();
        this.activeRequests.set(cancelKey, controller);
        
        const records = await this.client.collection('canvases').getList(1, 50, {
          filter: 'user = current.id',
          sort: '-updated',
          $cancelKey: cancelKey
        });
        
        this.activeRequests.delete(cancelKey);
        return records;
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Error fetching canvas list:', error);
        }
        throw error;
      }
    }
  

    public async getUserStorageUsage(userId: string) {
      try {
        const cancelKey = `user_storage_${userId}`;
        const controller = new AbortController();
        this.activeRequests.set(cancelKey, controller);
  
        // Get user directly with only needed fields
        const user = await this.client.collection('users').getOne(userId, {
          fields: 'currentStorage,storageLimit,canvasLimit',
          $cancelKey: cancelKey
        });
        
        // Get canvas count with efficient query
        const canvasCount = await this.getCanvasCount(userId);
        
        this.activeRequests.delete(cancelKey);
        return {
          currentStorage: user.currentStorage || 0,
          storageLimit: user.storageLimit || 26214400,
          canvasCount: canvasCount,
          canvasLimit: user.canvasLimit || 5
        };
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Failed to get user storage:', error);
        }
        return {
          currentStorage: 0,
          storageLimit: 26214400,
          canvasCount: 0,
          canvasLimit: 5
        };
      }
    }
  
    public async getCanvasCount(userId: string) {
      try {
        const cancelKey = `canvas_count_${userId}`;
        const controller = new AbortController();
        this.activeRequests.set(cancelKey, controller);
        
        // Use an optimized query that just counts records
        const result = await this.client.collection('canvases').getList(1, 1, {
          filter: `user = "${userId}"`,
          fields: 'COUNT(*) as count',
          $cancelKey: cancelKey
        });
        
        this.activeRequests.delete(cancelKey);
        return result.totalItems || 0;
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Failed to get canvas count:', error);
        }
        return 0;
      }
    }
  
  public async isAdmin() {
    if (!this.client.authStore.isValid) return false;
    
    try {
      const user = await this.client.collection('users').getOne(this.client.authStore.model.id);
      return user.role === 'admin';
    } catch (error) {
      return false;
    }
  }

  // Add initialization method for admin setup
  public async initializeAppSettings() {
    try {
      // Check if settings already exist
      let existingSettings;
      try {
        existingSettings = await this.client.collection('appSettings').getList(1, 1);
      } catch (err) {
        console.log('AppSettings collection might not be ready yet, retrying...');
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        existingSettings = { totalItems: 0 }; // Force creation
      }
      
      if (existingSettings.totalItems === 0) {
        // Create default settings
        try {
          await this.client.collection('appSettings').create({
            allowRegistration: true,
            maxCanvasesPerUser: 5,
            maxStoragePerUser: 26214400
          });
          console.log('Initialized default app settings');
        } catch (createErr) {
          console.error('Failed to create app settings:', createErr);
        }
      }
    } catch (error) {
      console.error('Failed to initialize app settings:', error);
    }
  }

  // Fixed and optimized server metrics
  public async getServerMetrics() {
    try {
      const cancelKey = 'server_metrics';
      const controller = new AbortController();
      this.activeRequests.set(cancelKey, controller);
      
      // Get only the latest metrics record
      const result = await this.client.collection('serverMetrics').getList(1, 1, {
        sort: '-timestamp',
        fields: 'cpu,memory,totalMemory,storage,activeUsers,apiRequests,timestamp',
        $cancelKey: cancelKey
      });
      
      this.activeRequests.delete(cancelKey);
      
      if (result?.items?.length > 0) {
        const latestMetrics = result.items[0];
        return {
          cpu: typeof latestMetrics.cpu === 'number' ? latestMetrics.cpu : 0,
          memory: typeof latestMetrics.memory === 'number' ? latestMetrics.memory : 0,
          totalMemory: typeof latestMetrics.totalMemory === 'number' ? latestMetrics.totalMemory : 8 * 1024 * 1024 * 1024,
          storage: typeof latestMetrics.storage === 'number' ? latestMetrics.storage : 0,
          activeUsers: typeof latestMetrics.activeUsers === 'number' ? latestMetrics.activeUsers : 0,
          apiRequests: typeof latestMetrics.apiRequests === 'number' ? latestMetrics.apiRequests : 0,
          timestamp: latestMetrics.timestamp
        };
      }
      
      // Fallback to default metrics if no records
      return {
        cpu: 0,
        memory: 0,
        totalMemory: 8 * 1024 * 1024 * 1024, // Default 8GB
        storage: 0,
        activeUsers: 0,
        apiRequests: 0
      };
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Error collecting server metrics:', error);
      }
      return {
        cpu: 0,
        memory: 0,
        totalMemory: 8 * 1024 * 1024 * 1024,
        storage: 0,
        activeUsers: 0,
        apiRequests: 0
      };
    }
  }

  // Method to create a serverMetrics record
  public async recordServerMetrics() {
    try {
      const metrics = await this.getServerMetrics();
      
      await this.client.collection('serverMetrics').create({
        timestamp: new Date().toISOString(),
        cpu: metrics.cpu,
        memory: metrics.memory,
        storage: metrics.storage,
        activeUsers: metrics.activeUsers,
        apiRequests: metrics.apiRequests,
      });
      
      return true;
    } catch (error) {
      console.error('Failed to record server metrics:', error);
      return false;
    }
  }
}

export const pb = PocketBaseService.getInstance();
export default pb;