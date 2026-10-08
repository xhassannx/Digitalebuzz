import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ApiEndpoint } from "@shared/schema";

interface ApiEndpointCardProps {
  endpoint: ApiEndpoint;
}

export function ApiEndpointCard({ endpoint }: ApiEndpointCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const hasProjectApi = endpoint.path.startsWith('/api/project/v1');
  const [expanded, setExpanded] = useState(hasProjectApi);

  const handleCopy = () => {
    navigator.clipboard.writeText(endpoint.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    const text = (endpoint as any).curlExample || endpoint.example || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'POST':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'PUT':
      case 'PATCH':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'DELETE':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return '';
    }
  };

  const hasExamples = !!(endpoint as any).curlExample || (endpoint as any).requestBody || (endpoint as any).responseExample || ((endpoint as any).parameters?.length) || endpoint.example;

  return (
    <Card data-testid={`card-endpoint-${endpoint.method.toLowerCase()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getMethodColor(endpoint.method)} variant="secondary">
                {endpoint.method}
              </Badge>
              <code className="text-sm font-mono break-all" data-testid="text-endpoint-path">
                {endpoint.path}
              </code>
            </div>
            <CardDescription>{endpoint.description}</CardDescription>
            {(endpoint as any).authHeader && (
              <p className="text-xs text-muted-foreground mt-1">
                Auth: <code className="bg-muted px-1 rounded">{(endpoint as any).authHeader}</code>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleCopy} data-testid="button-copy-endpoint" title="Copy path">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            {hasExamples && (
              <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse" : "Show examples"}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {(expanded || (!hasExamples && endpoint.example)) && (
        <CardContent className="pt-0 space-y-4">
          {(endpoint as any).parameters && (endpoint as any).parameters.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Parameters</p>
              <div className="bg-muted/50 rounded-lg p-3 text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Name</th>
                      <th className="py-1 pr-2">In</th>
                      <th className="py-1 pr-2">Required</th>
                      <th className="py-1">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((endpoint as any).parameters as any[]).map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 pr-2 font-mono">{p.name}</td>
                        <td className="py-1 pr-2">{p.in}</td>
                        <td className="py-1 pr-2">{p.required ? 'Yes' : 'No'}</td>
                        <td className="py-1 text-muted-foreground">{p.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {(endpoint as any).requestBody && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Request body</p>
              <div className="bg-muted/50 rounded-lg p-3 relative">
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify((endpoint as any).requestBody, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {((endpoint as any).curlExample || endpoint.example) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">cURL example</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopyCurl}>
                  {copiedCurl ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  <span className="ml-1">Copy</span>
                </Button>
              </div>
              <pre className="text-xs font-mono overflow-x-auto bg-muted rounded-lg p-3 whitespace-pre-wrap break-words" data-testid="text-endpoint-example">
                {(endpoint as any).curlExample || endpoint.example}
              </pre>
            </div>
          )}
          {(endpoint as any).responseExample && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Response example</p>
              <pre className="text-xs font-mono overflow-x-auto bg-muted rounded-lg p-3 whitespace-pre-wrap">
                {JSON.stringify((endpoint as any).responseExample, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
