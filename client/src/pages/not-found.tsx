import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const [location] = useLocation();
  const underAdmin = location.startsWith("/admin");

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>

          {underAdmin ? (
            <div className="mt-4 rounded-md border bg-muted/50 p-3 text-sm text-gray-700 space-y-2">
              <p className="font-medium text-gray-900">Looking for an admin page?</p>
              <p>
                URLs like <code className="text-xs">/admin/onboarding-fees</code> and{" "}
                <code className="text-xs">/admin/platform-settings</code> only exist for the{" "}
                <strong>platform owner</strong> (<code className="text-xs">is_saas_owner</code> in the database). Sign in
                with that account, or use{" "}
                <Link href="/licensor-access" className="text-primary underline font-medium">
                  Licensor access
                </Link>{" "}
                with the installation production key.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
