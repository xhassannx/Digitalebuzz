import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, MessageSquare } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      
      // Check if user is a SaaS owner
      const userResponse = await apiRequest("GET", "/api/auth/user");
      const user = await userResponse.json();
      
      if (!user.isSaaSOwner) {
        // Logout the user if they're not a SaaS owner
        await apiRequest("POST", "/api/auth/logout");
        toast({
          title: "Access Denied",
          description: "This login is restricted to SaaS administrators only.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Welcome, Administrator!",
        description: "You have been logged in successfully.",
      });

      // Invalidate user query and redirect to admin dashboard
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.replace("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">SaaS Admin Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              User Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Admin Badge */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Administrator Access</span>
            </div>
          </div>

          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-admin-login-title">
                Admin Login
              </CardTitle>
              <CardDescription>
                Sign in to access the SaaS administration panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="admin@saas-platform.com" 
                            {...field}
                            data-testid="input-admin-email"
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password" 
                            {...field}
                            data-testid="input-admin-password"
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-11" 
                    disabled={isLoading}
                    data-testid="button-admin-login"
                    size="lg"
                  >
                    {isLoading ? "Authenticating..." : "Sign in as Admin"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="w-full border-t pt-4">
                <p className="text-center text-sm text-muted-foreground">
                  Not an administrator?{" "}
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-primary hover:underline font-medium"
                    data-testid="link-user-login"
                  >
                    Go to user login
                  </button>
                </p>
              </div>
            </CardFooter>
          </Card>

          {/* Security Notice */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              🔒 This portal is restricted to authorized administrators only
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t bg-background/50 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 SaaS Platform Administration. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

