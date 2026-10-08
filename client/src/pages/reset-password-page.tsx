import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Eye, EyeOff } from "lucide-react";


const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reset-password/:token");
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const token = params?.token;

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid link",
        description: "The reset link is invalid or missing.",
        variant: "destructive",
      });
      setLocation("/forgot-password");
    }
  }, [token, toast, setLocation]);

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) return;

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      
      setIsSuccess(true);
      toast({
        title: "Password reset successful",
        description: "Your password has been reset. You can now log in with your new password.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. The link may have expired.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">WhatsApp SaaS Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setLocation("/signup")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">
              Reset password
            </CardTitle>
            <CardDescription>
              {isSuccess 
                ? "Your password has been reset successfully"
                : "Enter your new password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  You can now log in with your new password.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full"
                >
                  Go to login
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        {/* <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your new password" 
                            {...field}
                            className="h-11"
                          />
                        </FormControl> */}
                         <FormControl>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            {...field}
            // data-testid="input-password"
            className="h-11 pr-10"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
      </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        {/* <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Confirm your new password" 
                            {...field}
                            className="h-11"
                          />
                        </FormControl> */}
                         <FormControl>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            {...field}
            // data-testid="input-password"
            className="h-11 pr-10"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
      </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-11" 
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? "Resetting..." : "Reset password"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="w-full border-t pt-4">
              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-primary hover:underline font-medium"
                >
                  Log in
                </button>
              </p>
            </div>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="w-full border-t bg-background/50 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 WhatsApp SaaS Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
