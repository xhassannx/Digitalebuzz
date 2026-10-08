import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, UserCheck, UserX, Shield, TrendingUp, AlertCircle, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "wouter";

type AdminStats = {
  totalUsers: number;
  onboardedUsers?: number;
  activeUsers: number;
  inactiveUsers: number;
  saasOwners: number;
  totalResellers?: number;
  totalOrganizations: number;
  totalPlans: number;
  activeSubscriptions: number;
  connectedNumbers?: number;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/admin/stats');
        return await res.json();
      } catch (err: any) {
        // Extract error message from apiRequest error
        const errorMessage = err?.message || 'Failed to fetch admin stats';
        throw new Error(errorMessage);
      }
    },
    retry: false,
  });

  // BYPASSED: SaaS owner access allowed for local

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load admin dashboard. Please try again.'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Resellers",
      value: stats?.totalResellers ?? stats?.totalOrganizations ?? 0,
      icon: Building2,
      description: "Reseller organizations on the platform",
      color: "text-orange-600",
    },
    {
      title: "Total Users Onboarded",
      value: stats?.onboardedUsers ?? stats?.totalUsers ?? 0,
      icon: Users,
      description: "Users across all resellers",
      color: "text-blue-600",
    },
    {
      title: "Active Users",
      value: stats?.activeUsers || 0,
      icon: UserCheck,
      description: "Currently active",
      color: "text-green-600",
    },
    {
      title: "Inactive Users",
      value: stats?.inactiveUsers || 0,
      icon: UserX,
      description: "Deactivated accounts",
      color: "text-red-600",
    },
    {
      title: "Connected Numbers",
      value: stats?.connectedNumbers || 0,
      icon: Smartphone,
      description: "WhatsApp numbers currently connected",
      color: "text-emerald-600",
    },
    {
      title: "SaaS Owners",
      value: stats?.saasOwners || 0,
      icon: Shield,
      description: "Admin users",
      color: "text-purple-600",
    },
    {
      title: "Subscription Plans",
      value: stats?.totalPlans || 0,
      icon: CreditCard,
      description: "Available plans",
      color: "text-indigo-600",
    },
    {
      title: "Active Subscriptions",
      value: stats?.activeSubscriptions || 0,
      icon: TrendingUp,
      description: "Current subscriptions",
      color: "text-emerald-600",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your SaaS platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/users">
              <div className="block p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                <div className="font-medium">Manage Users</div>
                <div className="text-sm text-muted-foreground">View and manage all users</div>
              </div>
            </Link>
            <Link href="/admin/plans">
              <div className="block p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                <div className="font-medium">Manage Plans</div>
                <div className="text-sm text-muted-foreground">Create and edit subscription plans</div>
              </div>
            </Link>
            <Link href="/admin/organizations">
              <div className="block p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                <div className="font-medium">Manage Organizations</div>
                <div className="text-sm text-muted-foreground">View all organizations</div>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>Recent platform activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Activity tracking coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

