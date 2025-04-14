import PocketBase from 'pocketbase';

// Create a singleton instance
class PocketBaseService {
  private static instance: PocketBaseService;
  public client: PocketBase;
  
  private constructor() {
    this.client = new PocketBase('http://localhost:8090');
    
    // Add auto-refresh of the auth store on token expiration
    this.client.autoCancellation(false);
  }
  
  public static getInstance(): PocketBaseService {
    if (!PocketBaseService.instance) {
      PocketBaseService.instance = new PocketBaseService();
    }
    return PocketBaseService.instance;
  }
  
  public async getSettings() {
    try {
      // First try to get settings as a regular request
      const settings = await this.client.collection('appSettings').getFirstListItem('');
      return settings;
    } catch (error) {
      // Log with different severity based on error type
      if (error.status === 403) {
        console.log('Using default settings (permission error)');
      } else {
        console.error('Failed to get app settings:', error);
      }
      
      // Return default settings regardless of error
      return {
        allowRegistration: true,
        maxCanvasesPerUser: 5,
        maxStoragePerUser: 26214400 // 25MB
      };
    }
  }
  
  public async getUserStorageUsage(userId: string) {
    try {
      const user = await this.client.collection('users').getOne(userId);
      return {
        currentStorage: user.currentStorage || 0,
        storageLimit: user.storageLimit || 26214400,
        canvasCount: await this.getCanvasCount(userId),
        canvasLimit: user.canvasLimit || 5
      };
    } catch (error) {
      console.error('Failed to get user storage:', error);
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
      const resultList = await this.client.collection('canvases').getList(1, 1, {
        filter: `user = "${userId}"`,
        $cancelKey: 'canvasCount'
      });
      return resultList.totalItems;
    } catch (error) {
      console.error('Failed to get canvas count:', error);
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
}

export const pb = PocketBaseService.getInstance();
export default pb;