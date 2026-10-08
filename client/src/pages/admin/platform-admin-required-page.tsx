import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Shown when a logged-in user opens /admin/* but is not the SaaS platform owner.
 * (Previously this fell through to the generic 404 and looked like a missing route.)
 */
export default function PlatformAdminRequiredPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
            Platform admin only
          </CardTitle>
          <CardDescription>
            This area is for the whitelabel <strong>SaaS owner</strong> (platform admin). Your account does not have
            that role, so these URLs are not available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            If you should be the platform owner, ask whoever manages the database to set{" "}
            <code className="text-xs bg-muted px-1 rounded">is_saas_owner = true</code> for your user row (or sign in
            with the owner account).
          </p>
          <p>
            Licensor / source provider with the installation production key can use{" "}
            <Link href="/licensor-access" className="text-primary underline font-medium">
              Licensor access
            </Link>{" "}
            to sign in as the SaaS owner without a password.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Switch account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
