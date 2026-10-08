import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Save } from "lucide-react";
import { Label } from "@/components/ui/label";

const MAX_OPT_KEYWORDS = 30;

type OptKeyword = {
  id: string;
  keyword: string;
  type: 'opt_in' | 'opt_out';
};

export default function OptsManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [optOutKeywords, setOptOutKeywords] = useState<string[]>([]);
  const [optInKeywords, setOptInKeywords] = useState<string[]>([]);
  const [optOutErrors, setOptOutErrors] = useState<Record<number, string>>({});
  const [optInErrors, setOptInErrors] = useState<Record<number, string>>({});

  // Fetch opt-out keywords
  const { data: optOutData } = useQuery<OptKeyword[]>({
    queryKey: ["/api/opt-keywords", "opt_out"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opt-keywords?type=opt_out");
      return await response.json();
    },
  });

  // Fetch opt-in keywords
  const { data: optInData } = useQuery<OptKeyword[]>({
    queryKey: ["/api/opt-keywords", "opt_in"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opt-keywords?type=opt_in");
      return await response.json();
    },
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (optOutData) {
      setOptOutKeywords(optOutData.map(k => k.keyword));
    }
  }, [optOutData]);

  useEffect(() => {
    if (optInData) {
      setOptInKeywords(optInData.map(k => k.keyword));
    }
  }, [optInData]);

  // Save opt-out keywords
  const saveOptOutMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const response = await apiRequest("POST", "/api/opt-keywords", {
        type: "opt_out",
        keywords,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt-keywords", "opt_out"] });
      toast({
        title: "Success",
        description: "Opt-out keywords saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save opt-out keywords",
        variant: "destructive",
      });
    },
  });

  // Save opt-in keywords
  const saveOptInMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const response = await apiRequest("POST", "/api/opt-keywords", {
        type: "opt_in",
        keywords,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt-keywords", "opt_in"] });
      toast({
        title: "Success",
        description: "Opt-in keywords saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save opt-in keywords",
        variant: "destructive",
      });
    },
  });

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveOptOut();
        handleSaveOptIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [optOutKeywords, optInKeywords]);

  const validateKeyword = (keyword: string, index: number, type: 'opt_in' | 'opt_out'): boolean => {
    const trimmed = keyword.trim();
    
    if (trimmed.length === 0) {
      if (type === 'opt_out') {
        setOptOutErrors(prev => ({ ...prev, [index]: '' }));
      } else {
        setOptInErrors(prev => ({ ...prev, [index]: '' }));
      }
      return true; // Empty is allowed (will be filtered)
    }
    
    if (trimmed.length > 12) {
      if (type === 'opt_out') {
        setOptOutErrors(prev => ({ ...prev, [index]: 'Word must be 12 characters or less' }));
      } else {
        setOptInErrors(prev => ({ ...prev, [index]: 'Word must be 12 characters or less' }));
      }
      return false;
    }
    
    if (type === 'opt_out') {
      setOptOutErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    } else {
      setOptInErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
    
    return true;
  };

  const handleOptOutKeywordChange = (index: number, value: string) => {
    const newKeywords = [...optOutKeywords];
    newKeywords[index] = value;
    setOptOutKeywords(newKeywords);
    validateKeyword(value, index, 'opt_out');
  };

  const handleOptInKeywordChange = (index: number, value: string) => {
    const newKeywords = [...optInKeywords];
    newKeywords[index] = value;
    setOptInKeywords(newKeywords);
    validateKeyword(value, index, 'opt_in');
  };

  const addOptOutKeyword = () => {
    if (optOutKeywords.length >= MAX_OPT_KEYWORDS) {
      toast({
        title: "Limit reached",
        description: `Maximum ${MAX_OPT_KEYWORDS} opt-out keywords allowed`,
        variant: "destructive",
      });
      return;
    }
    setOptOutKeywords([...optOutKeywords, ""]);
  };

  const addOptInKeyword = () => {
    if (optInKeywords.length >= MAX_OPT_KEYWORDS) {
      toast({
        title: "Limit reached",
        description: `Maximum ${MAX_OPT_KEYWORDS} opt-in keywords allowed`,
        variant: "destructive",
      });
      return;
    }
    setOptInKeywords([...optInKeywords, ""]);
  };

  const removeOptOutKeyword = (index: number) => {
    const newKeywords = optOutKeywords.filter((_, i) => i !== index);
    setOptOutKeywords(newKeywords);
    setOptOutErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // Reindex errors
      const reindexed: Record<number, string> = {};
      Object.keys(newErrors).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newErrors[oldIndex];
        } else {
          reindexed[oldIndex] = newErrors[oldIndex];
        }
      });
      return reindexed;
    });
  };

  const removeOptInKeyword = (index: number) => {
    const newKeywords = optInKeywords.filter((_, i) => i !== index);
    setOptInKeywords(newKeywords);
    setOptInErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // Reindex errors
      const reindexed: Record<number, string> = {};
      Object.keys(newErrors).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newErrors[oldIndex];
        } else {
          reindexed[oldIndex] = newErrors[oldIndex];
        }
      });
      return reindexed;
    });
  };

  const handleSaveOptOut = () => {
    // Validate all keywords
    let hasErrors = false;
    optOutKeywords.forEach((keyword, index) => {
      if (!validateKeyword(keyword, index, 'opt_out')) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      toast({
        title: "Validation error",
        description: "Please fix validation errors before saving",
        variant: "destructive",
      });
      return;
    }

    const trimmedKeywords = optOutKeywords
      .map(k => k.trim())
      .filter(k => k.length > 0);
    const uniqueKeywords = [...new Set(trimmedKeywords)];

    saveOptOutMutation.mutate(uniqueKeywords);
  };

  const handleSaveOptIn = () => {
    // Validate all keywords
    let hasErrors = false;
    optInKeywords.forEach((keyword, index) => {
      if (!validateKeyword(keyword, index, 'opt_in')) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      toast({
        title: "Validation error",
        description: "Please fix validation errors before saving",
        variant: "destructive",
      });
      return;
    }

    const trimmedKeywords = optInKeywords
      .map(k => k.trim())
      .filter(k => k.length > 0);
    const uniqueKeywords = [...new Set(trimmedKeywords)];

    saveOptInMutation.mutate(uniqueKeywords);
  };

  return (
    <div
      className="atlas-manage-page atlas-opts-page container mx-auto p-6 space-y-6"
      data-testid="page-opts-management"
    >
      <div className="rh-page-hero space-y-2">
        <h1 className="text-3xl font-bold">Manage Opt-In and Opt-Out Words</h1>
        <p className="text-muted-foreground">
          Define the keywords for your opt-in and opt-out lists.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opt-Out Keywords */}
        <Card>
          <CardHeader>
            <CardTitle>Opt-Out Keywords</CardTitle>
            <CardDescription>
              Manage keywords that users can send to opt-out of messages.
            </CardDescription>
            <div className="text-sm text-muted-foreground mt-2">
              {optOutKeywords.length}/{MAX_OPT_KEYWORDS} keywords • Press Ctrl+S to save
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {optOutKeywords.map((keyword, index) => (
              <div key={index} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={keyword}
                    onChange={(e) => handleOptOutKeywordChange(index, e.target.value)}
                    placeholder="Enter keyword"
                    maxLength={12}
                    className={optOutErrors[index] ? "border-red-500" : ""}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOptOutKeyword(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {optOutErrors[index] && (
                  <p className="text-sm text-red-500">{optOutErrors[index]}</p>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={addOptOutKeyword}
                disabled={optOutKeywords.length >= MAX_OPT_KEYWORDS}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Keyword
              </Button>
            </div>
            <Button
              onClick={handleSaveOptOut}
              disabled={saveOptOutMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveOptOutMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>

        {/* Opt-In Keywords */}
        <Card>
          <CardHeader>
            <CardTitle>Opt-In Keywords</CardTitle>
            <CardDescription>
              Manage keywords that users can send to opt-in to messages.
            </CardDescription>
            <div className="text-sm text-muted-foreground mt-2">
              {optInKeywords.length}/{MAX_OPT_KEYWORDS} keywords • Press Ctrl+S to save
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {optInKeywords.map((keyword, index) => (
              <div key={index} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={keyword}
                    onChange={(e) => handleOptInKeywordChange(index, e.target.value)}
                    placeholder="Enter keyword"
                    maxLength={12}
                    className={optInErrors[index] ? "border-red-500" : ""}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOptInKeyword(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {optInErrors[index] && (
                  <p className="text-sm text-red-500">{optInErrors[index]}</p>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={addOptInKeyword}
                disabled={optInKeywords.length >= MAX_OPT_KEYWORDS}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Keyword
              </Button>
            </div>
            <Button
              onClick={handleSaveOptIn}
              disabled={saveOptInMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveOptInMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

