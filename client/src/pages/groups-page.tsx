import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Plus, Trash2, Edit, MessageSquare, UserPlus, X, Search, BookOpen } from "lucide-react";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { Link } from "wouter";

type Group = {
  id: string;
  name: string;
  description: string | null;
  whatsappGroupId: string | null;
  userId: string;
  organizationId: string;
  createdAt: string;
};

type GroupMember = {
  id: string;
  groupId: string;
  contactId: string;
  phoneNumber: string;
  name: string | null;
  addedAt: string;
};

type ManagedContact = {
  id: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
};

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  whatsappGroupId: z.string().optional(),
});

const addMemberSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  phoneNumber: z.string().min(1),
  name: z.string().optional(),
});

type CreateGroupInput = z.infer<typeof createGroupSchema>;
type AddMemberInput = z.infer<typeof addMemberSchema>;
type GroupSort = "recent" | "name-asc" | "name-desc";

export default function GroupsPage() {
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
    }
  }, []);
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<GroupSort>("recent");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const { data: groupsResponse, isLoading } = useQuery({
    queryKey: ["/api/groups", debouncedSearchQuery, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      const res = await apiRequest("GET", `/api/groups?${params.toString()}`);
      return res.json();
    },
  });

  const { items: groups, total: totalGroups } = parsePaginatedListResponse<Group>(groupsResponse, "groups");

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, resetPage]);

  const { data: contacts = [] } = useQuery<ManagedContact[]>({
    queryKey: ["/api/contacts"],
    queryFn: () => fetchLegacyListApi<ManagedContact>("/api/contacts", "contacts"),
  });

  const { data: members = [], refetch: refetchMembers } = useQuery<GroupMember[]>({
    queryKey: ["/api/groups", selectedGroup?.id, "members"],
    enabled: !!selectedGroup?.id && membersDialogOpen,
  });

  const createForm = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      whatsappGroupId: "",
    },
  });

  const editForm = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
  });

  const addMemberForm = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      contactId: "",
      phoneNumber: "",
      name: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGroupInput) => apiRequest("POST", "/api/groups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Group created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateGroupInput) => apiRequest("PATCH", `/api/groups/${selectedGroup?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setEditDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Success",
        description: "Group updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update group",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/groups/${selectedGroup?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setDeleteDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: AddMemberInput) => apiRequest("POST", `/api/groups/${selectedGroup?.id}/members`, data),
    onSuccess: () => {
      refetchMembers();
      addMemberForm.reset();
      setAddMemberDialogOpen(false);
      toast({
        title: "Success",
        description: "Member added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", `/api/groups/${selectedGroup?.id}/members/${memberId}`),
    onSuccess: () => {
      refetchMembers();
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CreateGroupInput) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: CreateGroupInput) => {
    updateMutation.mutate(data);
  };

  const handleEdit = (group: Group) => {
    setSelectedGroup(group);
    editForm.reset({
      name: group.name,
      description: group.description || "",
      whatsappGroupId: group.whatsappGroupId || "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (group: Group) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleViewMembers = (group: Group) => {
    setSelectedGroup(group);
    setMembersDialogOpen(true);
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      addMemberForm.setValue("contactId", contact.id);
      addMemberForm.setValue("phoneNumber", contact.phoneNumber);
      addMemberForm.setValue("name", contact.name || "");
    }
  };

  const handleAddMemberSubmit = (data: AddMemberInput) => {
    addMemberMutation.mutate(data);
  };

  const filteredGroups = [...groups].sort((a, b) => {
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className={cn(skin ? "space-y-6" : "p-6 space-y-6")} data-testid="page-groups">
      <div className="flex items-center justify-between gap-4">
        <div className="groups-page-chrome min-w-0">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Groups
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize contacts into groups for broadcasts and campaigns. Native WhatsApp group chat management is available on WhatsApp Web (unofficial) connections; Cloud API numbers use these as contact lists.
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-create-group"
              className={cn(primaryBtnClass, isAtlas && "rounded-xl", skin && "ml-auto")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-group">
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input data-testid="input-group-name" placeholder="My Contact Group" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="input-group-description"
                          placeholder="Describe this group..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="whatsappGroupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Group ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-whatsapp-group-id"
                          placeholder="123456789@g.us"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    data-testid="button-submit-create"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Group"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isAtlas ? (
        <div className="rh-groups-atlas-toolbar">
          <RhSearchField
            className="min-w-0 flex-1"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search groups..."
          />
          <div className="rh-groups-atlas-sort">
            <span className="rh-groups-atlas-sort-label">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as GroupSort)}>
              <SelectTrigger className="rh-groups-atlas-sort-trigger h-10 w-[180px] border-[#e5e7eb] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Created</SelectItem>
                <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z–A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : skin ? (
        <RhSearchField
          className="max-w-md"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search groups…"
        />
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-search-groups"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : totalGroups === 0 ? (
        isAtlas ? (
          <div className="rh-groups-empty">
            <div className="rh-groups-empty-icon">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="rh-groups-empty-title">No groups found</h3>
            <p className="rh-groups-empty-desc">
              {searchQuery
                ? "Try a different search query to find what you're looking for."
                : "It looks like you haven't created any contact groups yet. Create your first group to start organizing your WhatsApp communication more effectively."}
            </p>
            {!searchQuery && (
              <div className="rh-groups-empty-actions">
                <Button
                  className={cn(primaryBtnClass, "rounded-xl")}
                  onClick={() => setCreateDialogOpen(true)}
                  data-testid="button-create-first-group"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Group
                </Button>
                <Button variant="outline" className="rounded-xl border-[#e5e7eb]" asChild>
                  <Link href="/my-support">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Read Guide
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No groups found</p>
              <p className="text-muted-foreground mt-1">
                {searchQuery ? "Try a different search query" : "Create your first group to get started"}
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <Card
              key={group.id}
              data-testid={`card-group-${group.id}`}
              className={cn(
                skin ? "rh-panel-card hover-elevate" : "hover-elevate",
                isAtlas && "rh-groups-card",
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-group-name-${group.id}`}>{group.name}</CardTitle>
                    {group.description && (
                      <CardDescription className="mt-1 line-clamp-2">{group.description}</CardDescription>
                    )}
                  </div>
                  {group.whatsappGroupId && (
                    <Badge variant="secondary" className="ml-2" data-testid={`badge-synced-${group.id}`}>
                      Synced
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-view-members-${group.id}`}
                    onClick={() => handleViewMembers(group)}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-edit-group-${group.id}`}
                    onClick={() => handleEdit(group)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-delete-group-${group.id}`}
                    onClick={() => handleDelete(group)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalGroups > 0 && (
        <ListPaginationFooter
          total={totalGroups}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea data-testid="input-edit-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="whatsappGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Group ID</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-whatsapp-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" data-testid="button-submit-edit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-group">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGroup?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-group-members">
          <DialogHeader>
            <DialogTitle>Group Members - {selectedGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              size="sm"
              data-testid="button-open-add-member"
              onClick={() => setAddMemberDialogOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No members in this group yet</p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    data-testid={`row-member-${member.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{member.name || member.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">{member.phoneNumber}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`button-remove-member-${member.id}`}
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent data-testid="dialog-add-member">
          <DialogHeader>
            <DialogTitle>Add Member to Group</DialogTitle>
          </DialogHeader>
          <Form {...addMemberForm}>
            <form onSubmit={addMemberForm.handleSubmit(handleAddMemberSubmit)} className="space-y-4">
              <FormField
                control={addMemberForm.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Contact</FormLabel>
                    <Select onValueChange={handleContactSelect} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contact">
                          <SelectValue placeholder="Choose a contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name || contact.phoneNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addMemberForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input data-testid="input-member-phone" readOnly {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addMemberForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-member-name" readOnly {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  data-testid="button-submit-add-member"
                  disabled={addMemberMutation.isPending}
                >
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
