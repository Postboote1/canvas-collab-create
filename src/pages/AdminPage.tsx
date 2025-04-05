
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AdminPage: React.FC = () => {
  const { user, isLoggedIn } = useAuth();
  const { getStats } = useAnalytics();
  const navigate = useNavigate();
  
  // Redirect if not admin
  useEffect(() => {
    if (!isLoggedIn() || (user && !user.isAdmin)) {
      navigate('/');
    }
  }, [isLoggedIn, user, navigate]);
  
  const stats = getStats();
  
  // Prepare chart data
  const pieData = [
    { name: 'Visitors', value: stats.visitors || 0 },
    { name: 'Canvases Created', value: stats.canvasesCreated || 0 },
    { name: 'Canvases Joined', value: stats.canvasesJoined || 0 }
  ];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];
  
  // Prepare page views data for bar chart
  const pageViewsData = Object.entries(stats.pageViews || {}).map(([page, views]) => ({
    page: page || '/',
    views: views as number
  }));
  
  if (!user?.isAdmin) {
    return <div>Loading...</div>;
  }
  
  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Total Visitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.visitors || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Canvases Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.canvasesCreated || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Canvases Joined</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.canvasesJoined || 0}</div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Usage Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pageViewsData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 60,
                    }}
                  >
                    <XAxis 
                      dataKey="page" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70} 
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" fill="#0FA0CE" name="Views" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AdminPage;
