import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearableDateInput } from "@/components/ui/clearable-date-input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Filter, Copy, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentGateway: string;
  createdAt: string;
  completedAt: string | null;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone?: string | null;
  };
  plan?: {
    id: string;
    name: string;
    displayName: string;
  };
  orgNo?: string;
};

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [itemName, setItemName] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  if (itemName) queryParams.set("itemName", itemName);
  if (createdFrom) queryParams.set("createdFrom", createdFrom);
  if (createdTo) queryParams.set("createdTo", createdTo);
  queryParams.set("limit", String(rowsPerPage));
  queryParams.set("offset", String(page * rowsPerPage));

  const { data, isLoading } = useQuery<{ orders: Order[]; total: number }>({
    queryKey: ["/api/admin/orders", queryParams.toString()],
    queryFn: async () => {
      const url = `/api/admin/orders?${queryParams.toString()}`;
      const res = await apiRequest("GET", url);
      return await res.json();
    },
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / rowsPerPage);

  const copyOrderId = (id: string) => {
    const shortId = id.slice(0, 6);
    navigator.clipboard.writeText(shortId);
    setCopiedId(id);
    toast({ title: "Copied", description: `Order ID ${shortId} copied` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Orders</h1>
        <p className="text-muted-foreground">
          {total} Total ·{" "}
          <Link href="/admin/onboarding-fees" className="underline hover:text-foreground">
            Onboarding fees (licensor)
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>Payment history and subscription orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search org, user, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="max-w-[180px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 rounded-lg border bg-muted/30">
              <div>
                <label className="text-xs text-muted-foreground">Created date (from)</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Created date (to)</label>
                <ClearableDateInput
                  showCalendarIcon={false}
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Org No</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Gateway</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const userName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(" ") || "—";
                    const initials = userName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">#{order.id.slice(0, 6)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyOrderId(order.id)}
                            >
                              {copiedId === order.id ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/users/${order.userId}`}>
                            <div className="flex items-center gap-2 hover:underline cursor-pointer">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{userName}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                                  {order.user?.email ?? "—"}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>{order.user?.phone ?? "—"}</TableCell>
                        <TableCell>{order.orgNo ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {order.plan?.displayName || order.plan?.name || "—"}
                        </TableCell>
                        <TableCell>{formatAmount(order.amount, order.currency)}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>{formatAmount(order.amount, order.currency)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "completed"
                                ? "default"
                                : order.status === "pending"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {order.status === "completed" ? "paid" : order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{order.paymentGateway}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Rows per page: {rowsPerPage} • Page {page + 1} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
