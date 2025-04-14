// src/scripts/initializeDB.ts
import { pb } from '../services/pocketbaseService';

export async function initializeDatabase() {
  try {
    console.log('Initializing database settings...');
    
    // Wait for PocketBase to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Initialize app settings
    await pb.initializeAppSettings();
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}