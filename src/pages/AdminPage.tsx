// src/pages/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { pb } from '@/services/pocketbaseService';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<any[]>([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [totalCanvases, setTotalCanvases] = useState(0);
  const [settings, setSettings] = useState<any>({
    allowRegistration: true,
    maxCanvasesPerUser: 5,
    maxStoragePerUser: 26214400, // 25MB
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Only admins can access this page
    if (!isAdmin) {
      toast.error("You don't have permission to access this page");
      navigate('/');
      return;
    }
    
    fetchData();
  }, [isAdmin, navigate]);
  
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch users
      const userRecords = await pb.client.collection('users').getFullList({
        sort: '-created',
        expand: 'canvases',
      });
      setUsers(userRecords);
      
      // Fetch total storage and canvases
      const canvasRecords = await pb.client.collection('canvases').getFullList({
        sort: '-created',
      });
      
      setTotalCanvases(canvasRecords.length);
      setTotalStorage(canvasRecords.reduce((acc, canvas) => acc + (canvas.size || 0), 0));
      
      // Fetch app settings
      const appSettings = await pb.getSettings();
      if (appSettings) {
        setSettings(appSettings);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateSettings = async () => {
    try {
      // Get the first settings record or create one if it doesn't exist
      let settingsRecord;
      try {
        const records = await pb.client.collection('appSettings').getList(1, 1);
        settingsRecord = records.items[0];
      } catch (error) {
        // Create settings if they don't exist
        settingsRecord = await pb.client.collection('appSettings').create({
          allowRegistration: settings.allowRegistration,
          maxCanvasesPerUser: settings.maxCanvasesPerUser,
          maxStoragePerUser: settings.maxStoragePerUser
        });
      }
      
      // Now update the settings
      if (settingsRecord?.id) {
        await pb.client.collection('appSettings').update(settingsRecord.id, {
          allowRegistration: settings.allowRegistration,
          maxCanvasesPerUser: settings.maxCanvasesPerUser,
          maxStoragePerUser: settings.maxStoragePerUser
        });
      }
      
      toast.success('Settings updated successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    }
  };
  
  const updateUserLimits = async (userId: string, canvasLimit: number, storageLimit: number) => {
    try {
      await pb.client.collection('users').update(userId, {
        canvasLimit,
        storageLimit,
      });
      
      // Refresh user list
      fetchData();
      toast.success('User limits updated');
    } catch (error) {
      console.error('Failed to update user limits:', error);
      toast.error('Failed to update user limits');
    }
  };
  
  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will also delete all their canvases and cannot be undone.')) {
      return;
    }
    
    try {
      await pb.client.collection('users').delete(userId);
      fetchData();
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  if (isLoading) {
    return <Layout><div className="p-8 text-center">Loading admin data...</div></Layout>;
  }
  
  return (
    
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Total registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{users.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Canvases</CardTitle>
              <CardDescription>Total created canvases</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{totalCanvases}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Total storage used</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{formatBytes(totalStorage)}</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">App Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users and their limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Canvas Usage</TableHead>
                        <TableHead>Storage Usage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.role || 'user'}</TableCell>
                          <TableCell>{user.verified ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            {user.expand?.canvases?.length || 0} / {user.canvasLimit || 5}
                          </TableCell>
                          <TableCell>
                            {formatBytes(user.currentStorage || 0)} / {formatBytes(user.storageLimit || 26214400)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const canvasLimit = prompt('Enter new canvas limit:', user.canvasLimit || '5');
                                  const storageLimit = prompt('Enter new storage limit (in MB):', ((user.storageLimit || 26214400) / 1024 / 1024).toString());
                                  
                                  if (canvasLimit && storageLimit) {
                                    updateUserLimits(
                                      user.id, 
                                      parseInt(canvasLimit), 
                                      parseInt(storageLimit) * 1024 * 1024
                                    );
                                  }
                                }}
                              >
                                Edit Limits
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => deleteUser(user.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>App Settings</CardTitle>
                <CardDescription>Configure global application settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Allow Registration</h3>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable new user registration
                      </p>
                    </div>
                    <Switch
                      checked={settings.allowRegistration}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        allowRegistration: checked
                      })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Default Canvas Limit Per User
                    </label>
                    <Input
                      type="number"
                      value={settings.maxCanvasesPerUser}
                      onChange={(e) => setSettings({
                        ...settings,
                        maxCanvasesPerUser: parseInt(e.target.value)
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of canvases each user can create
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Default Storage Limit Per User (MB)
                    </label>
                    <Input
                      type="number"
                      value={settings.maxStoragePerUser / 1024 / 1024}
                      onChange={(e) => setSettings({
                        ...settings,
                        maxStoragePerUser: parseInt(e.target.value) * 1024 * 1024
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum storage space (in MB) for each user
                    </p>
                  </div>
                  
                  <Button onClick={updateSettings}>
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    
  );
};

export default AdminPage;