import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { normalizeScreensForEditor } from "@/lib/flow-converter";
import { 
  ArrowLeft, 
  Plus, 
  Check, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Type,
  FileText,
  Calendar,
  List,
  CheckSquare,
  ChevronDown as ChevronDownIcon,
  ToggleLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type FieldType = 
  | 'large_heading' | 'small_heading' | 'caption_text' | 'body_text'
  | 'short_answer' | 'paragraph' | 'date_picker'
  | 'single_choice' | 'multiple_choice' | 'dropdown' | 'opt_in';

type InputType = 'text' | 'password' | 'email' | 'number' | 'passcode' | 'phone';
type TextType = 'large_heading' | 'small_heading' | 'caption_text' | 'body_text';

type Field = {
  id: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  instructions?: string;
  required?: boolean;
  options?: string[];
  inputType?: InputType; // For text input fields
  textType?: TextType; // For text fields
  name?: string; // Field name for WhatsApp Flow format
  includeTime?: boolean; // For date_picker: include time (uses TextInput in WhatsApp since DatePicker is date-only)
  [key: string]: any;
};

type Screen = {
  id: string;
  title: string;
  fields: Field[];
  footerButton?: {
    text: string;
    action?: string;
  };
  terminal?: boolean;
  success?: boolean;
  layout?: any; // WhatsApp Flow layout structure
};

type Flow = {
  id?: string;
  name: string;
  businessAccountId: string;
  screens: Screen[];
};

function flowApiUrl(path: string, organizationId: string | undefined): string {
  const base = path ? `/api/whatsapp-flows${path.startsWith("/") ? path : "/" + path}` : "/api/whatsapp-flows";
  if (!organizationId) return base;
  return `${base}${base.includes("?") ? "&" : "?"}organizationId=${encodeURIComponent(organizationId)}`;
}

export default function FlowBuilderPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;
  
  // Extract params from URL
  const pathParts = location.split('/');
  const businessAccountIdIndex = pathParts.indexOf('whatsapp-flows') + 1;
  const actionIndex = businessAccountIdIndex + 1;
  const flowIdIndex = actionIndex + 1;
  
  const businessAccountId = pathParts[businessAccountIdIndex] || 'new';
  const action = pathParts[actionIndex];
  const isEdit = action === 'edit';
  const flowId = isEdit ? pathParts[flowIdIndex] : undefined;
  
  // Extract phoneNumberId from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const phoneNumberIdFromUrl = urlParams.get('phoneNumberId');
  
  const [flowName, setFlowName] = useState("");
  
  // Create default fields for first screen
  const createDefaultFields = (): Field[] => {
    const timestamp = Date.now();
    const fieldId1 = `field-${timestamp}-1`;
    const fieldId2 = `field-${timestamp}-2`;
    
    return [
      {
        id: fieldId1,
        type: 'large_heading',
        textType: 'large_heading',
        label: 'Welcome to our form',
        required: false,
      },
      {
        id: fieldId2,
        type: 'short_answer',
        inputType: 'text',
        label: 'Your Name',
        placeholder: 'Enter text...',
        instructions: '',
        required: true,
      },
    ];
  };

  // Initialize default fields only for new flows
  const initialDefaultFields = isEdit ? [] : createDefaultFields();
  const initialExpandedFields = isEdit ? new Set<string>() : new Set(initialDefaultFields.map(f => f.id));

  const [screens, setScreens] = useState<Screen[]>([
    {
      id: 'screen-1',
      title: 'Basic',
      fields: initialDefaultFields,
      footerButton: { text: 'Continue' },
    },
  ]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('screen-1');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(initialExpandedFields);
  const hasHydratedFlowRef = useRef(false);

  // Load flow if editing (org-scoped)
  const { data: flowData, isLoading } = useQuery<Flow>({
    queryKey: ['/api/whatsapp-flows', organizationId, flowId],
    queryFn: async () => {
      const res = await apiRequest('GET', flowApiUrl(`/${flowId}`, organizationId));
      return await res.json();
    },
    enabled: isEdit && !!flowId,
  });

  useEffect(() => {
    hasHydratedFlowRef.current = false;
  }, [flowId]);

  useEffect(() => {
    if (!flowData || hasHydratedFlowRef.current) return;
    hasHydratedFlowRef.current = true;

    setFlowName(flowData.name || '');
    if (flowData.screens && flowData.screens.length > 0) {
      const normalizedScreens = normalizeScreensForEditor(flowData.screens) as Screen[];
      setScreens(normalizedScreens);
      setSelectedScreenId(normalizedScreens[0].id);
      // Expand all fields when loading existing flow
      const allFieldIds = normalizedScreens.flatMap(screen => screen.fields.map(f => f.id));
      setExpandedFields(new Set(allFieldIds));
    } else {
      // If no screens, use default
      setScreens([{
        id: 'screen-1',
        title: 'Basic',
        fields: initialDefaultFields,
        footerButton: { text: 'Continue' },
      }]);
    }
  }, [flowData]);

  // Get connected phone numbers to find phoneNumberId
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
  });

  // Find phoneNumberId from URL param or from connected numbers matching businessAccountId
  const getPhoneNumberId = (): string | undefined => {
    if (phoneNumberIdFromUrl) return phoneNumberIdFromUrl;
    
    if (phoneNumbersData?.phoneNumbers && businessAccountId && businessAccountId !== 'new') {
      const matchingPhone = phoneNumbersData.phoneNumbers.find(
        (p: any) => (p.businessAccountId || p.wabaId) === businessAccountId
      );
      return matchingPhone?.phoneNumberId || matchingPhone?.id;
    }
    
    return undefined;
  };

  const createFlowMutation = useMutation({
    mutationFn: async (flow: Flow) => {
      const path = isEdit && flowId ? `/${flowId}` : "";
      const url = flowApiUrl(path, organizationId);
      const method = isEdit ? 'PATCH' : 'POST';
      
      const phoneNumberId = getPhoneNumberId();
      const flowPayload = phoneNumberId 
        ? { ...flow, phoneNumberId }
        : flow;
      
      return apiRequest(method, url, flowPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      toast({
        title: isEdit ? "Flow updated" : "Flow created",
        description: isEdit ? "Flow has been updated successfully." : "Flow has been created successfully.",
      });
      setLocation('/whatsapp-flows');
    },
    onError: (error: Error) => {
      toast({
        title: "Operation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedScreen = screens.find(s => s.id === selectedScreenId);

  const addScreen = () => {
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      title: `Screen ${screens.length + 1}`,
      fields: [], // New screens start empty, only first screen has defaults
      footerButton: { text: 'Continue' },
    };
    setScreens([...screens, newScreen]);
    setSelectedScreenId(newScreen.id);
  };

  const addField = (fieldType: FieldType) => {
    if (!selectedScreen) return;

    // Check maximum 8 fields per screen
    if (selectedScreen.fields.length >= 8) {
      toast({
        title: "Maximum fields reached",
        description: "Each screen can have a maximum of 8 fields.",
        variant: "destructive",
      });
      return;
    }

    const fieldId = `field-${Date.now()}`;
    const fieldIndex = selectedScreen.fields.length;
    const fieldName = `${fieldType}_${fieldIndex}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    const newField: Field = {
      id: fieldId,
      type: fieldType,
      label: '',
      required: false,
      name: fieldName, // Add name for WhatsApp Flow format compatibility
      ...(fieldType === 'date_picker' && { includeTime: true }), // Date picker includes time by default
    };

    // Set default input type for text input fields
    if (fieldType === 'short_answer' || fieldType === 'paragraph') {
      newField.inputType = 'text' as InputType;
    }

    // Set default text type for text fields
    if (fieldType === 'large_heading' || fieldType === 'small_heading' || fieldType === 'caption_text' || fieldType === 'body_text') {
      newField.textType = fieldType;
    }

    if (fieldType === 'single_choice' || fieldType === 'multiple_choice' || fieldType === 'dropdown') {
      newField.options = ['Option 1', 'Option 2'];
    }

    const updatedScreens = screens.map(screen =>
      screen.id === selectedScreenId
        ? { ...screen, fields: [...screen.fields, newField] }
        : screen
    );
    setScreens(updatedScreens);
    setExpandedFields(new Set([...expandedFields, fieldId]));
  };

  const updateField = (fieldId: string, updates: Partial<Field>) => {
    const updatedScreens = screens.map(screen => ({
      ...screen,
      fields: screen.fields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      ),
    }));
    setScreens(updatedScreens);
  };

  const deleteField = (fieldId: string) => {
    const updatedScreens = screens.map(screen => ({
      ...screen,
      fields: screen.fields.filter(field => field.id !== fieldId),
    }));
    setScreens(updatedScreens);
    const newExpanded = new Set(expandedFields);
    newExpanded.delete(fieldId);
    setExpandedFields(newExpanded);
  };

  const updateScreenTitle = (screenId: string, title: string) => {
    const updatedScreens = screens.map(screen =>
      screen.id === screenId ? { ...screen, title } : screen
    );
    setScreens(updatedScreens);
  };

  const updateFooterButton = (screenId: string, text: string) => {
    const updatedScreens = screens.map(screen =>
      screen.id === screenId
        ? { ...screen, footerButton: { ...screen.footerButton, text } }
        : screen
    );
    setScreens(updatedScreens);
  };

  const toggleFieldExpanded = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const handleSave = () => {
    if (!flowName.trim()) {
      toast({
        title: "Validation error",
        description: "Flow name is required",
        variant: "destructive",
      });
      return;
    }

    const flow: Flow = {
      id: flowId,
      name: flowName.trim(),
      businessAccountId,
      screens,
    };

    createFlowMutation.mutate(flow);
  };

  const getFieldTypeLabel = (type: FieldType): string => {
    const labels: Record<FieldType, string> = {
      large_heading: 'Large Heading',
      small_heading: 'Small Heading',
      caption_text: 'Caption Text',
      body_text: 'Body Text',
      short_answer: 'Text Input',
      paragraph: 'Text Area',
      date_picker: 'Date Picker',
      single_choice: 'Single Choice',
      multiple_choice: 'Multiple Choice',
      dropdown: 'Dropdown',
      opt_in: 'Opt-in',
    };
    return labels[type] || type;
  };

  const renderFieldPreview = (field: Field) => {
    switch (field.type) {
      case 'large_heading':
      case 'small_heading':
        return <div className={`font-${field.type === 'large_heading' ? 'bold text-xl' : 'semibold'} mb-2`}>{field.label || 'Heading'}</div>;
      case 'caption_text':
      case 'body_text':
        return <p className="text-sm text-muted-foreground mb-2">{field.label || 'Text content'}</p>;
      case 'short_answer':
        return (
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Label'}</label>
            <input 
              type={field.inputType || 'text'} 
              placeholder={field.placeholder || 'Enter text...'} 
              className="w-full p-2 border rounded" 
              disabled 
            />
          </div>
        );
      case 'paragraph':
        return (
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Label'}</label>
            <textarea placeholder={field.placeholder || 'Enter text...'} className="w-full p-2 border rounded" rows={3} disabled />
          </div>
        );
      case 'date_picker':
        return (
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">{field.label || (field.includeTime ? 'Date & Time' : 'Date')}</label>
            <input
              type={field.includeTime ? 'datetime-local' : 'date'}
              className="w-full p-2 border rounded"
              placeholder={field.includeTime ? 'dd-mm-yyyy hh:mm' : undefined}
              disabled
            />
          </div>
        );
      case 'single_choice':
      case 'multiple_choice':
        return (
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Select an option'}</label>
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <input type={field.type === 'multiple_choice' ? 'checkbox' : 'radio'} disabled />
                <span className="text-sm">{opt}</span>
              </div>
            ))}
          </div>
        );
      case 'dropdown':
        return (
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Select'}</label>
            <select className="w-full p-2 border rounded" disabled>
              {(field.options || []).map((opt, idx) => (
                <option key={idx}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'opt_in':
        return (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" disabled />
              <span className="text-sm">{field.label || 'Opt-in text'}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading flow...</p>
        </div>
      </div>
    );
  }

  // When no business account selected (e.g. /whatsapp-flows/new/create), show message and back CTA
  if (!isEdit && businessAccountId === 'new') {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="max-w-[95%] mx-auto p-6">
          <div className="text-sm text-muted-foreground mb-4">
            Dashboard &gt; Manage &gt; Whatsapp-Flows &gt; Create
          </div>
          <Card className="max-w-xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-2">Select a Business Account</h2>
              <p className="text-muted-foreground mb-4">
                Forms are created for a specific WhatsApp Business Account (connected number). Go back and select a Business Account from the list to create a form for that account.
              </p>
              <Button onClick={() => setLocation('/whatsapp-flows')} className="bg-orange-500 hover:bg-orange-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Whatsapp-Flows
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isEdit && businessAccountId === "new") {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="max-w-[95%] mx-auto p-6">
          <div className="text-sm text-muted-foreground mb-4">Dashboard &gt; Manage &gt; Whatsapp-Flows &gt; Create</div>
          <Card className="max-w-xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-2">Select a Business Account</h2>
              <p className="text-muted-foreground mb-4">
                Forms are created for a specific WhatsApp Business Account (connected number). Go back and select a Business Account to create a form.
              </p>
              <Button onClick={() => setLocation("/whatsapp-flows")} className="bg-orange-500 hover:bg-orange-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Whatsapp-Flows
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[95%] mx-auto p-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-muted-foreground mb-4">
          Dashboard &gt; Manage &gt; Whatsapp-Flows &gt; {businessAccountId} &gt; {isEdit ? 'Edit' : 'Create'}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation('/whatsapp-flows')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-semibold">Flow Builder</h1>
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Enter flow name..."
              className="max-w-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            {!isEdit && (
              <Button 
                variant="outline" 
                className="bg-green-500 text-white hover:bg-green-600"
                onClick={() => {
                  if (!flowName.trim()) {
                    toast({
                      title: "Validation error",
                      description: "Flow name is required",
                      variant: "destructive",
                    });
                    return;
                  }
                  const flow: Flow = {
                    name: flowName.trim(),
                    businessAccountId,
                    screens,
                  };
                  createFlowMutation.mutate(flow);
                }}
                disabled={createFlowMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Ready
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={createFlowMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isEdit ? 'Update Flow' : 'Create Flow'}
            </Button>
            {isEdit && (
              <Button
                onClick={() => {
                  if (!flowName.trim()) {
                    toast({
                      title: "Validation error",
                      description: "Flow name is required",
                      variant: "destructive",
                    });
                    return;
                  }
                  const flow: Flow = {
                    id: flowId,
                    name: flowName.trim(),
                    businessAccountId,
                    screens,
                  };
                  // Publish the flow
                  apiRequest('PATCH', flowApiUrl(`/${flowId}`, organizationId), { ...flow, status: 'PUBLISHED' })
                    .then(async (res) => {
                      const data = await res.json().catch(() => ({}));
                      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
                      toast({
                        title: "Flow published",
                        description:
                          data?.message ||
                          "Flow has been published successfully. Customers will see the latest screens.",
                      });
                      setLocation('/whatsapp-flows');
                    })
                    .catch((error: Error) => {
                      toast({
                        title: "Publish failed",
                        description: error.message,
                        variant: "destructive",
                      });
                    });
                }}
                disabled={createFlowMutation.isPending}
                className="bg-green-500 hover:bg-green-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Screens */}
          <div className="w-64 space-y-2">
            <div className="font-semibold mb-2">Screens</div>
            {screens.map((screen) => (
              <Card
                key={screen.id}
                className={`cursor-pointer transition-colors ${
                  selectedScreenId === screen.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : ''
                }`}
                onClick={() => setSelectedScreenId(screen.id)}
              >
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{screen.title}</div>
                      <div className="text-xs text-muted-foreground">{screen.fields.length} fields</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button onClick={addScreen} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Screen
            </Button>
          </div>

          {/* Middle Panel - Field Configuration */}
          <div className="flex-1 overflow-y-auto pr-4">
            {selectedScreen && (
              <div className="space-y-4">
                {/* Screen Title */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        <span className="font-medium">Screen title</span>
                      </div>
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      value={selectedScreen.title}
                      onChange={(e) => updateScreenTitle(selectedScreen.id, e.target.value)}
                      placeholder="Screen Title"
                      maxLength={60}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{selectedScreen.title.length}/60</div>
                  </CardContent>
                </Card>

                {/* Fields */}
                {selectedScreen.fields.map((field) => (
                  <Card key={field.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getFieldTypeLabel(field.type)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFieldExpanded(field.id)}
                          >
                            {expandedFields.has(field.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteField(field.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {expandedFields.has(field.id) && (
                        <div className="space-y-3 mt-4">
                          {(field.type === 'short_answer' || field.type === 'paragraph' || field.type === 'date_picker' ||
                            field.type === 'single_choice' || field.type === 'multiple_choice' || field.type === 'dropdown' ||
                            field.type === 'opt_in') && (
                            <>
                              {field.type === 'short_answer' && (
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Input Type</label>
                                  <Select
                                    value={field.inputType || 'text'}
                                    defaultValue="text"
                                    onValueChange={(value: InputType) => updateField(field.id, { inputType: value as InputType })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Text" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="password">Password</SelectItem>
                                      <SelectItem value="email">Email</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="passcode">Passcode</SelectItem>
                                      <SelectItem value="phone">Phone</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div>
                                <label className="text-sm font-medium mb-1 block">Label</label>
                                <Input
                                  value={field.label || ''}
                                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                                  placeholder="Field label"
                                  maxLength={20}
                                />
                                <div className="text-xs text-muted-foreground mt-1">{(field.label || '').length}/20</div>
                              </div>
                              {(field.type === 'short_answer' || field.type === 'paragraph') && (
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Instructions (Optional)</label>
                                  <Input
                                    value={field.instructions || ''}
                                    onChange={(e) => updateField(field.id, { instructions: e.target.value })}
                                    placeholder="Add helpful instructions for users..."
                                    maxLength={80}
                                  />
                                  <div className="text-xs text-muted-foreground mt-1">{(field.instructions || '').length}/80</div>
                                </div>
                              )}
                              {(field.type === 'single_choice' || field.type === 'multiple_choice' || field.type === 'dropdown') && (
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Options</label>
                                  {(field.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                      <Input
                                        value={opt}
                                        onChange={(e) => {
                                          const newOptions = [...(field.options || [])];
                                          newOptions[idx] = e.target.value;
                                          updateField(field.id, { options: newOptions });
                                        }}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newOptions = (field.options || []).filter((_, i) => i !== idx);
                                          updateField(field.id, { options: newOptions });
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newOptions = [...(field.options || []), `Option ${(field.options || []).length + 1}`];
                                      updateField(field.id, { options: newOptions });
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Option
                                  </Button>
                                </div>
                              )}
                              {field.type === 'date_picker' && (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={field.includeTime || false}
                                    onCheckedChange={(checked) => updateField(field.id, { includeTime: checked })}
                                  />
                                  <label className="text-sm">Include time</label>
                                </div>
                              )}
                              {(field.type === 'short_answer' || field.type === 'paragraph' || field.type === 'date_picker' ||
                                field.type === 'single_choice' || field.type === 'multiple_choice' || field.type === 'dropdown' ||
                                field.type === 'opt_in') && (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={field.required || false}
                                    onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                                  />
                                  <label className="text-sm">Required</label>
                                </div>
                              )}
                            </>
                          )}
                          {(field.type === 'large_heading' || field.type === 'small_heading' || field.type === 'caption_text' || field.type === 'body_text') && (
                            <>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Text Type</label>
                                <Select
                                  value={field.textType || field.type}
                                  onValueChange={(value: TextType) => {
                                    updateField(field.id, { textType: value, type: value });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="large_heading">Large Heading</SelectItem>
                                    <SelectItem value="small_heading">Small Heading</SelectItem>
                                    <SelectItem value="caption_text">Caption Text</SelectItem>
                                    <SelectItem value="body_text">Body Text</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Text Content</label>
                                <Input
                                  value={field.label || ''}
                                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                                  placeholder="Enter text"
                                  maxLength={field.type === 'large_heading' ? 60 : field.type === 'small_heading' ? 60 : field.type === 'caption_text' ? 80 : 1024}
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {(field.label || '').length}/{field.type === 'large_heading' ? 60 : field.type === 'small_heading' ? 60 : field.type === 'caption_text' ? 80 : 1024}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Footer Button */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Footer button</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      value={selectedScreen.footerButton?.text ?? ''}
                      onChange={(e) => updateFooterButton(selectedScreen.id, e.target.value)}
                      placeholder="Continue"
                      maxLength={30}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{(selectedScreen.footerButton?.text ?? '').length}/30</div>
                  </CardContent>
                </Card>

                {/* Add Field Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      disabled={selectedScreen?.fields.length >= 8}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add field {selectedScreen?.fields.length >= 8 ? '(Max 8)' : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Text</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => addField('large_heading')}>
                      <Type className="h-4 w-4 mr-2" />
                      Large Heading
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('small_heading')}>
                      <Type className="h-4 w-4 mr-2" />
                      Small Heading
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('caption_text')}>
                      <Type className="h-4 w-4 mr-2" />
                      Caption Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('body_text')}>
                      <Type className="h-4 w-4 mr-2" />
                      Body Text
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Text Answer</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => addField('short_answer')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Text Input
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('paragraph')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Text Area
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('date_picker')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Date Picker
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Selection</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => addField('single_choice')}>
                      <List className="h-4 w-4 mr-2" />
                      Single Choice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('multiple_choice')}>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Multiple Choice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('dropdown')}>
                      <ChevronDownIcon className="h-4 w-4 mr-2" />
                      Dropdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addField('opt_in')}>
                      <ToggleLeft className="h-4 w-4 mr-2" />
                      Opt-in
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="w-80 bg-muted/30 rounded-lg p-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg border min-h-[500px] p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">X</div>
                <div className="font-semibold">{selectedScreen?.title || 'Screen'}</div>
                <div className="w-6 h-6 flex items-center justify-center">⋯</div>
              </div>
              <div className="space-y-4">
                {selectedScreen?.fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Type className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Add fields to see preview</p>
                  </div>
                ) : (
                  selectedScreen?.fields.map((field) => (
                    <div key={field.id}>
                      {renderFieldPreview(field)}
                    </div>
                  ))
                )}
                {selectedScreen?.footerButton && (
                  <Button className="w-full bg-green-500 hover:bg-green-600 mt-4">
                    {selectedScreen.footerButton.text || 'Continue'}
                  </Button>
                )}
              </div>
              <div className="mt-4 pt-4 border-t text-xs text-center text-muted-foreground">
                Managed by the business. <a href="#" className="underline">Learn more</a>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <div className="font-semibold mb-2">Preview Notes:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Rendering may vary on different devices</li>
                <li>Interactions are disabled in preview mode</li>
                <li>Actual WhatsApp styling may differ slightly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

