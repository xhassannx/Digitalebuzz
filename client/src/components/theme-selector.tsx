import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Power, User, CreditCard, Settings, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/lib/theme-provider";
import { useLocation } from "wouter";

type OrganizationTheme = {
  themeMode?: 'light' | null;
  accentColor?: 'grey' | 'pink' | 'red' | 'orange' | 'green' | 'blue' | 'yellow' | 'purple' | null;
};

const COLOR_SWATCHES = [
  { name: 'grey', value: 'grey', color: '#6b7280' },
  { name: 'pink', value: 'pink', color: '#ec4899' },
  { name: 'red', value: 'red', color: '#ef4444' },
  { name: 'orange', value: 'orange', color: '#f97316' },
  { name: 'green', value: 'green', color: '#22c55e' },
  { name: 'blue', value: 'blue', color: '#3b82f6' },
  { name: 'yellow', value: 'yellow', color: '#eab308' },
  { name: 'purple', value: 'purple', color: '#a855f7' },
];

export function ThemeSelector() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // Get user's organization
  const { data: organizations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.organizations || []);
    },
    enabled: !!user,
  });

  const organization = organizations[0];

  // Get current theme
  const { data: themeData, refetch: refetchTheme } = useQuery<{ theme: OrganizationTheme | null }>({
    queryKey: ["/api/organizations", organization?.id, "theme"],
    queryFn: async () => {
      if (!organization?.id) return { theme: null };
      try {
        const res = await apiRequest("GET", `/api/organizations/${organization.id}/theme`);
        return await res.json();
      } catch {
        return { theme: null };
      }
    },
    enabled: !!organization?.id,
  });

  const currentTheme = themeData?.theme;
  const accentColor = currentTheme?.accentColor || 'orange';

  // Update theme mutation
  const updateThemeMutation = useMutation({
    mutationFn: async (data: { accentColor?: string }) => {
      if (!organization?.id) throw new Error("Organization not found");
      const res = await apiRequest("POST", `/api/organizations/${organization.id}/theme`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organization?.id, "theme"] });
      refetchTheme();
      setTheme('light');
      toast({
        title: "Theme updated",
        description: "Your theme preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update theme",
        variant: "destructive",
      });
    },
  });

  const handleColorChange = (color: string) => {
    updateThemeMutation.mutate({ accentColor: color as any });
  };

  // Ensure light theme is always applied
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  const getInitials = () => {
    if (user?.firstName) {
      return `${user.firstName.charAt(0).toUpperCase()}${user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}`;
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {user?.email || 'User'}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setLocation('/settings?tab=profile'); setOpen(false); }}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setLocation('/settings?tab=billing'); setOpen(false); }}>
          <CreditCard className="mr-2 h-4 w-4" />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setLocation('/settings'); setOpen(false); }}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium mb-2">Accent Color</div>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                onClick={() => handleColorChange(swatch.value)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  accentColor === swatch.value
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:border-muted-foreground/50'
                }`}
                style={{ backgroundColor: swatch.color }}
                aria-label={`Select ${swatch.name} color`}
              >
                {accentColor === swatch.value && (
                  <Check className="h-4 w-4 text-white m-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void logout();
          }}
        >
          <Power className="mr-2 h-4 w-4" />
          Log out
          <span className="ml-auto text-xs text-muted-foreground">⇧⌘Q</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

