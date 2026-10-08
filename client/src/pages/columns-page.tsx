// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit, Columns, Search, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";

type ContactColumn = {
  id: string;
  userId: string;
  organizationId: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'phone' | 'select' | 'date';
  options?: string[];
  visible: boolean;
  required: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

const columnSchema = z.object({
  label: z.string().min(1, "Label is required"),
  type: z.enum(['text', 'email', 'number', 'textarea', 'phone', 'select', 'date']),
  options: z.string().optional(),
  visible: z.boolean().default(true),
  required: z.boolean().default(false),
});

type ColumnInput = z.infer<typeof columnSchema>;

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
];

const getTypeDisplay = (type: string): string => {
  const found = COLUMN_TYPES.find(t => t.value === type);
  return found?.label.toUpperCase() || type.toUpperCase();
};

export default function ColumnsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColumn, setSelectedColumn] = useState<ContactColumn | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optionsInput, setOptionsInput] = useState("");
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const { data: columnsResponse, isLoading } = useQuery({
    queryKey: ["/api/columns", debouncedSearchQuery, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      const res = await apiRequest("GET", `/api/columns?${params.toString()}`);
      return await res.json();
    },
  });

  const { items: columns, total: totalColumns } = parsePaginatedListResponse<ContactColumn>(
    columnsResponse,
    "columns"
  );

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, resetPage]);

  const columnForm = useForm<ColumnInput>({
    resolver: zodResolver(columnSchema),
    defaultValues: {
      label: "",
      type: 'text',
      options: "",
      visible: true,
      required: false,
    },
  });

  const editColumnForm = useForm<ColumnInput>({
    resolver: zodResolver(columnSchema),
  });

  const watchedType = columnForm.watch("type");
  const watchedEditType = editColumnForm.watch("type");

  const createColumnMutation = useMutation({
    mutationFn: (data: ColumnInput & { options?: string[] }) => {
      const { options: optionsStr, ...rest } = data;
      const payload: any = { ...rest };
      if (data.type === 'select' && optionsStr) {
        payload.options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
      }
      return apiRequest("POST", "/api/columns", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/columns"] });
      setCreateDialogOpen(false);
      columnForm.reset();
      setOptionsInput("");
      toast({
        title: "Success",
        description: "Column created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create column",
        variant: "destructive",
      });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: (data: ColumnInput & { options?: string[] }) => {
      const { options: optionsStr, ...rest } = data;
      const payload: any = { ...rest };
      if (data.type === 'select' && optionsStr) {
        payload.options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
      }
      return apiRequest("PATCH", `/api/columns/${selectedColumn?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/columns"] });
      setEditDialogOpen(false);
      setSelectedColumn(null);
      setOptionsInput("");
      toast({
        title: "Success",
        description: "Column updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update column",
        variant: "destructive",
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/columns/${selectedColumn?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/columns"] });
      setDeleteDialogOpen(false);
      setSelectedColumn(null);
      toast({
        title: "Success",
        description: "Column deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete column",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: (column: ContactColumn) => apiRequest("PATCH", `/api/columns/${column.id}`, { visible: !column.visible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/columns"] });
      toast({
        title: "Success",
        description: "Column visibility updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update visibility",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: ColumnInput) => {
    createColumnMutation.mutate({ ...data, options: optionsInput });
  };

  const handleEdit = (column: ContactColumn) => {
    setSelectedColumn(column);
    const optionsStr = column.options?.join(', ') || '';
    setOptionsInput(optionsStr);
    editColumnForm.reset({
      label: column.label,
      type: column.type,
      options: optionsStr,
      visible: column.visible,
      required: column.required,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = (data: ColumnInput) => {
    if (selectedColumn) {
      updateColumnMutation.mutate({ ...data, options: optionsInput });
    }
  };

  const handleDelete = (column: ContactColumn) => {
    setSelectedColumn(column);
    setDeleteDialogOpen(true);
  };

  const handleToggleVisibility = (column: ContactColumn) => {
    toggleVisibilityMutation.mutate(column);
  };

  return (
    <div
      className="atlas-manage-page atlas-columns-page h-full overflow-auto"
      data-testid="page-columns"
    >
      <div className="max-w-[95%] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="rh-page-hero flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Columns</h1>
            <p className="text-muted-foreground mt-1">Manage columns</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </div>
        </div>

        {/* Columns Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading columns...</p>
            </div>
          </div>
        ) : columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Columns className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No columns found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery ? "Try adjusting your search" : "Create your first column to get started"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {columns.map((column) => (
              <Card key={column.id} className="relative bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{column.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">({getTypeDisplay(column.type)})</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(column)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(column)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button
                      variant={column.visible ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleVisibility(column)}
                      className={`text-xs ${column.visible ? 'bg-primary hover:bg-primary/90' : ''}`}
                    >
                      {column.visible ? "Visible" : "Hidden"}
                    </Button>
                  </div>

                  {column.type === 'select' && column.options && column.options.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium">
                        {column.options.length} Option{column.options.length !== 1 ? 's' : ''}:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {column.options.map((option, idx) => (
                          <Badge 
                            key={idx} 
                            variant="secondary" 
                            className="text-xs cursor-default hover:bg-secondary/80"
                          >
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {totalColumns > 0 && (
          <ListPaginationFooter
            total={totalColumns}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        )}

        {/* Create Column Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Column</DialogTitle>
            </DialogHeader>
            <Form {...columnForm}>
              <form onSubmit={columnForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={columnForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter column label" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={columnForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COLUMN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedType === 'select' && (
                  <FormItem>
                    <FormLabel>Options</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter options separated by commas (e.g., Option 1, Option 2, Option 3)"
                        value={optionsInput}
                        onChange={(e) => setOptionsInput(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Separate multiple options with commas
                    </FormDescription>
                  </FormItem>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setOptionsInput("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createColumnMutation.isPending}>
                    {createColumnMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Column Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Column</DialogTitle>
            </DialogHeader>
            <Form {...editColumnForm}>
              <form onSubmit={editColumnForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editColumnForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter column label" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editColumnForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COLUMN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedEditType === 'select' && (
                  <FormItem>
                    <FormLabel>Options</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter options separated by commas (e.g., Option 1, Option 2, Option 3)"
                        value={optionsInput}
                        onChange={(e) => setOptionsInput(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Separate multiple options with commas
                    </FormDescription>
                  </FormItem>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setOptionsInput("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateColumnMutation.isPending}>
                    {updateColumnMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Column Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Column</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedColumn?.label}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedColumn) {
                    deleteColumnMutation.mutate();
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

