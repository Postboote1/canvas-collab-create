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
// Import charting library
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
// Add these imports
import { Loader2, Activity, HardDrive, Cpu, MemoryStick } from 'lucide-react';

const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<any[]>([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [totalMemory, setTotalMemory] = useState(0);
  const [totalCanvases, setTotalCanvases] = useState(0);
  const [settings, setSettings] = useState<any>({
    allowRegistration: true,
    maxCanvasesPerUser: 5,
    maxStoragePerUser: 26214400, // 25MB
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // New state for metrics
  const [serverMetrics, setServerMetrics] = useState<any>({
    cpu: 0,
    memory: 0,
    storage: 0,
    activeUsers: 0,
    apiRequests: 0,
  });
  const [historicalMetrics, setHistoricalMetrics] = useState<any[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<'24h'|'7d'|'14d'>('7d');
  
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
      // Check if we're logged in as admin
      if (!pb.client.authStore.isValid || !pb.client.authStore.model.role || pb.client.authStore.model.role !== 'admin') {
        toast.error("Admin authentication required");
        return;
      }
  
      // Try a different approach to get all user data
      const userRecords = await pb.client.send('/api/collections/users/records', {
        method: 'GET',
        headers: {
          // Include admin token explicitly
          'Authorization': `Bearer ${pb.client.authStore.token}`
        },
        params: {
          sort: '-created',
          fields: '*',
          perPage: 200
        }
      });
      
      console.log('Raw user data from API:', userRecords);
      
      // Extract users from response
      const users = userRecords?.items || [];
      
      // Separately fetch canvases with user relations
      const canvasRecords = await pb.client.collection('canvases').getFullList({
        expand: 'user',
      });
      
      // Map canvases to users
      const userCanvasMap = new Map();
      const userStorageMap = new Map();
      
      canvasRecords.forEach(canvas => {
        if (canvas.user) {
          // Count canvases per user
          if (!userCanvasMap.has(canvas.user)) {
            userCanvasMap.set(canvas.user, 0);
          }
          userCanvasMap.set(canvas.user, userCanvasMap.get(canvas.user) + 1);
          
          // Sum storage per user
          if (!userStorageMap.has(canvas.user)) {
            userStorageMap.set(canvas.user, 0);
          }
          userStorageMap.set(
            canvas.user, 
            userStorageMap.get(canvas.user) + (canvas.size || 0)
          );
        }
      });
      
      // Attach canvas counts and storage to users
      const enhancedUsers = users.map(user => ({
        ...user,
        canvasCount: userCanvasMap.get(user.id) || 0,
        actualStorage: userStorageMap.get(user.id) || 0
      }));
      
      setUsers(enhancedUsers);
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

  const fetchCurrentMetrics = async () => {
    try {
      const metrics = await pb.getServerMetrics();
      
      // Only update if we received valid metrics
      if (metrics && typeof metrics.cpu === 'number') {
        setServerMetrics(metrics);
        setLastUpdated(new Date());
        
        // Store total memory for GB conversion if available
        if (metrics.totalMemory) {
          setTotalMemory(metrics.totalMemory);
        }
      }
    } catch (error) {
      console.error('Failed to fetch server metrics:', error);
    }
  };
  
  // Add a function to fetch historical metrics
  const fetchHistoricalMetrics = async (range: '24h'|'7d'|'14d') => {
    setIsLoadingMetrics(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate;
      
      if (range === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (range === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      }
      
      // Fetch metrics from PocketBase
      const records = await pb.client.collection('serverMetrics').getList(1, 100, {
        filter: `timestamp >= "${startDate.toISOString()}" && timestamp <= "${now.toISOString()}"`,
        sort: 'timestamp',
      });
      
      if (records.items.length === 0) {
        console.log('No historical metrics found in the date range');
        setHistoricalMetrics([]);
        setIsLoadingMetrics(false);
        return;
      }
      
      // Process data for the chart
      const formattedData = records.items.map(record => {
        // Make sure all values are numbers with fallbacks
        return {
          timestamp: new Date(record.timestamp).toLocaleString(),
          cpu: typeof record.cpu === 'number' ? record.cpu : 0,
          memory: typeof record.memory === 'number' ? record.memory : 0,
          storage: typeof record.storage === 'number' ? record.storage : 0,
          activeUsers: typeof record.activeUsers === 'number' ? record.activeUsers : 0,
          apiRequests: typeof record.apiRequests === 'number' ? record.apiRequests : 0,
          totalMemory: typeof record.totalMemory === 'number' ? record.totalMemory : totalMemory
        };
      });
      
      console.log('Loaded historical metrics:', formattedData);
      setHistoricalMetrics(formattedData);
    } catch (error) {
      console.error('Failed to fetch historical metrics:', error);
      toast.error('Failed to load historical server metrics');
      setHistoricalMetrics([]);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const refreshMetrics = async () => {
    setIsRefreshingMetrics(true);
    await fetchCurrentMetrics();
    setTimeout(() => setIsRefreshingMetrics(false), 500);
  };

  // Update useEffect to fetch metrics
  useEffect(() => {
    if (isAdmin) {
      // Initial loads
      fetchData();
      fetchCurrentMetrics();
      fetchHistoricalMetrics('7d');
      
      // Use ref to track the interval for cleanup
      const intervalRef = { current: null };
      
      // Function to fetch and schedule next update
      const fetchAndSchedule = async () => {
        try {
          await fetchCurrentMetrics();
        } catch (err) {
          console.error('Error in metrics update interval:', err);
        }
        // Schedule next update
        intervalRef.current = setTimeout(fetchAndSchedule, 30000);
      };
      
      // Start the interval cycle
      intervalRef.current = setTimeout(fetchAndSchedule, 30000);
      
      return () => {
        if (intervalRef.current) {
          clearTimeout(intervalRef.current);
        }
      };
    }
  }, [isAdmin, navigate]);

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
            <TabsTrigger value="monitoring">Server Monitoring</TabsTrigger>
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
                            {user.canvasCount || 0} / {user.canvasLimit || 5}
                          </TableCell>
                          <TableCell>
                            {formatBytes(user.actualStorage || 0)} / {formatBytes(user.storageLimit || 26214400)}
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
                  {/* New monitoring tab */}
          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle>Server Monitoring</CardTitle>
                <CardDescription>Real-time server metrics and historical data</CardDescription>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Current Server Metrics</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshMetrics}
                    disabled={isRefreshingMetrics}
                  >
                    {isRefreshingMetrics ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : 'Refresh Metrics'}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground text-center mb-4">
                  Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}{' '}
                  {isRefreshingMetrics && <Loader2 className="inline h-3 w-3 animate-spin" />}
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg font-medium mb-4">Current Server Metrics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <Cpu className="w-8 h-8 text-blue-500 mb-2" />
                      <p className="text-sm text-muted-foreground">CPU Usage</p>
                      <p className="text-2xl font-bold">{serverMetrics.cpu.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <MemoryStick className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-muted-foreground">Memory Usage</p>
                      <p className="text-2xl font-bold">
                        {totalMemory 
                          ? `${((serverMetrics.memory * totalMemory / 100) / 1024 / 1024 / 1024).toFixed(2)} GB` 
                          : `${serverMetrics.memory.toFixed(1)}%`}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <HardDrive className="w-8 h-8 text-amber-500 mb-2" />
                      <p className="text-sm text-muted-foreground">Storage Used</p>
                      <p className="text-2xl font-bold">{formatBytes(serverMetrics.storage)}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <Activity className="w-8 h-8 text-purple-500 mb-2" />
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{serverMetrics.activeUsers}</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Historical Metrics</h3>
                  <div className="flex space-x-2 mb-4">
                    <Button 
                      variant={timeRange === '24h' ? 'default' : 'outline'} 
                      onClick={() => {
                        setTimeRange('24h');
                        fetchHistoricalMetrics('24h');
                      }}
                    >
                      Last 24 Hours
                    </Button>
                    <Button 
                      variant={timeRange === '7d' ? 'default' : 'outline'} 
                      onClick={() => {
                        setTimeRange('7d');
                        fetchHistoricalMetrics('7d');
                      }}
                    >
                      Last 7 Days
                    </Button>
                    <Button 
                      variant={timeRange === '14d' ? 'default' : 'outline'} 
                      onClick={() => {
                        setTimeRange('14d');
                        fetchHistoricalMetrics('14d');
                      }}
                    >
                      Last 14 Days
                    </Button>
                  </div>
                  
                  {isLoadingMetrics ? (
                    <div className="h-80 w-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : historicalMetrics.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* CPU Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-medium mb-3">CPU Usage (%)</h4>
                        <div className="h-60">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalMetrics}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tick={{ fontSize: 12 }} 
                                tickFormatter={(value) => {
                                  const date = new Date(value);
                                  if (timeRange === '24h') {
                                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                  }
                                  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                }}
                              />
                              <YAxis domain={[0, 'dataMax + 10']} />
                              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'CPU']} />
                              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      {/* Memory Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-medium mb-3">Memory Usage (GB)</h4>
                        <div className="h-60">
                          <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={historicalMetrics.map(metric => {
                            // Ensure we have valid memory data
                            const memoryValue = typeof metric.memory === 'number' && metric.memory > 0 
                              ? metric.memory 
                              : 20; // Fallback value
                            
                            return {
                              ...metric,
                              // Convert memory value to GB (handles both percentage and absolute values)
                              memoryGB: memoryValue < 100 
                                ? (memoryValue * totalMemory / 100 / 1024 / 1024 / 1024).toFixed(2)
                                : (memoryValue / 1024 / 1024 / 1024).toFixed(2)
                            };
                          })}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="timestamp" 
                              tick={{ fontSize: 12 }} 
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                if (timeRange === '24h') {
                                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                }
                                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                              }}
                            />
                            <YAxis domain={[0, 'dataMax + 1']} />
                            <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} GB`, 'Memory']} />
                            <Line type="monotone" dataKey="memoryGB" stroke="#10b981" name="Memory" strokeWidth={2} dot={false} />
                          </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      {/* Storage Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-medium mb-3">Storage Used (GB)</h4>
                        <div className="h-60">
                          <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={historicalMetrics.map(metric => {
                            // Ensure storage is a valid number and convert to GB
                            const storageValue = typeof metric.storage === 'number' && metric.storage > 0 
                              ? metric.storage 
                              : 1024 * 1024; // Fallback value (1MB)
                            
                            return {
                              ...metric,
                              storageGB: (storageValue / (1024 * 1024 * 1024)).toFixed(3)
                            };
                          })}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="timestamp" 
                              tick={{ fontSize: 12 }} 
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                if (timeRange === '24h') {
                                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                }
                                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                              }}
                            />
                            <YAxis domain={[0, 'dataMax + 0.5']} />
                            <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} GB`, 'Storage']} />
                            <Line type="monotone" dataKey="storageGB" stroke="#f59e0b" name="Storage" strokeWidth={2} dot={false} />
                          </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      {/* Active Users Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-medium mb-3">Active Users</h4>
                        <div className="h-60">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalMetrics}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tick={{ fontSize: 12 }} 
                                tickFormatter={(value) => {
                                  const date = new Date(value);
                                  if (timeRange === '24h') {
                                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                  }
                                  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                }}
                              />
                              <YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} />
                              <Tooltip formatter={(value) => [Math.round(Number(value)), 'Users']} />
                              <Line type="monotone" dataKey="activeUsers" stroke="#8b5cf6" name="Users" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="h-80 w-full flex items-center justify-center">
                      <p className="text-muted-foreground">No historical data available</p>
                    </div>
                  )}
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
