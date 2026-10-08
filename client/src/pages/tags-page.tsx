import { useState, useEffect, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit, Tag, Search } from "lucide-react";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";

type ContactTag = {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: string;
};

const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().min(1, "Color is required"),
});

type TagInput = z.infer<typeof tagSchema>;

const TAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

function getTagColorLabel(hex: string): string {
  const normalized = (hex || "").trim().toLowerCase();
  const match = TAG_COLORS.find((c) => c.value.toLowerCase() === normalized);
  return match?.name ?? hex;
}

export default function TagsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<ContactTag | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const { data: tagsResponse, isLoading } = useQuery({
    queryKey: ["/api/tags", debouncedSearchQuery, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      const res = await apiRequest("GET", `/api/tags?${params.toString()}`);
      return await res.json();
    },
  });

  const { items: tags, total: totalTags } = parsePaginatedListResponse<ContactTag>(tagsResponse, "tags");

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, resetPage]);

  const tagForm = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: TAG_COLORS[0].value,
    },
  });

  const editTagForm = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: TagInput) => apiRequest("POST", "/api/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setCreateDialogOpen(false);
      tagForm.reset();
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: (data: TagInput) => apiRequest("PATCH", `/api/tags/${selectedTag?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setEditDialogOpen(false);
      setSelectedTag(null);
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tags/${selectedTag?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setDeleteDialogOpen(false);
      setSelectedTag(null);
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: TagInput) => {
    createTagMutation.mutate(data);
  };

  const handleEdit = (tag: ContactTag) => {
    setSelectedTag(tag);
    editTagForm.reset({
      name: tag.name,
      color: tag.color,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = (data: TagInput) => {
    if (selectedTag) {
      updateTagMutation.mutate(data);
    }
  };

  const handleDelete = (tag: ContactTag) => {
    setSelectedTag(tag);
    setDeleteDialogOpen(true);
  };

  return (
    <div
      className="atlas-manage-page atlas-tags-page h-full overflow-auto"
      data-testid="page-tags"
    >
      <div className="max-w-[95%] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="rh-page-hero flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Tags</h1>
            <p className="text-muted-foreground mt-1">Manage contact tags and categories</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Manage your contact tags</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground">Loading tags...</p>
                </div>
              </div>
            ) : tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tags found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchQuery ? "Try adjusting your search" : "Create your first tag to get started"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[150px]">Color</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div className="font-medium">{tag.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="tag-color-badge border-transparent"
                          style={
                            {
                              "--tag-color": tag.color,
                              backgroundColor: tag.color,
                              color: "#ffffff",
                            } as CSSProperties
                          }
                          title={tag.color}
                        >
                          <span
                            className="tag-color-swatch mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
                            style={
                              {
                                "--tag-color": tag.color,
                                backgroundColor: tag.color,
                              } as CSSProperties
                            }
                            aria-hidden
                          />
                          {getTagColorLabel(tag.color)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(tag.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tag)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tag)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {totalTags > 0 && (
              <ListPaginationFooter
                total={totalTags}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
                className="mt-4"
              />
            )}
          </CardContent>
        </Card>

        {/* Create Tag Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tag</DialogTitle>
            </DialogHeader>
            <Form {...tagForm}>
              <form onSubmit={tagForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={tagForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter tag name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={tagForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-4 gap-2">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              title={color.name}
                              aria-label={color.name}
                              onClick={() => field.onChange(color.value)}
                              className={`tag-color-swatch h-10 w-full rounded border-2 ${
                                field.value === color.value
                                  ? "border-primary"
                                  : "border-transparent"
                              }`}
                              style={
                                {
                                  "--tag-color": color.value,
                                  backgroundColor: color.value,
                                } as CSSProperties
                              }
                            />
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTagMutation.isPending}>
                    {createTagMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Tag Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tag</DialogTitle>
            </DialogHeader>
            <Form {...editTagForm}>
              <form onSubmit={editTagForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editTagForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter tag name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editTagForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-4 gap-2">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              title={color.name}
                              aria-label={color.name}
                              onClick={() => field.onChange(color.value)}
                              className={`tag-color-swatch h-10 w-full rounded border-2 ${
                                field.value === color.value
                                  ? "border-primary"
                                  : "border-transparent"
                              }`}
                              style={
                                {
                                  "--tag-color": color.value,
                                  backgroundColor: color.value,
                                } as CSSProperties
                              }
                            />
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateTagMutation.isPending}>
                    {updateTagMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Tag Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tag</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedTag?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedTag) {
                    deleteTagMutation.mutate();
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

