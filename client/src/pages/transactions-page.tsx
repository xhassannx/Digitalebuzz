"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Banknote, ExternalLink, Loader2, Search } from "lucide-react";

type ContactPaymentRequestRow = {
  id: string;
  token: string;
  status: string;
  currency: string;
  amountMinor: number;
  gateway: string;
  gatewayPaymentId?: string | null;
  description?: string | null;
  createdAt: string;
  paidAt?: string | null;
  customerPhone?: string | null;
  contactId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function contactLabel(row: ContactPaymentRequestRow): string {
  const name = row.metadata && typeof row.metadata.contactName === "string" ? row.metadata.contactName.trim() : "";
  const phone = (row.customerPhone || "").trim();
  if (name && phone) return `${name} · ${phone}`;
  if (name) return name;
  if (phone) return phone;
  if (row.contactId) return `Contact ${row.contactId.slice(0, 8)}…`;
  return "—";
}

export default function TransactionsPage() {
  const [q, setQ] = useState("");
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(25);
  const debouncedQ = useDebouncedValue(q);

  const { data: transactionsResponse, isLoading } = useQuery({
    queryKey: ["/api/payments/contact-requests", "org", debouncedQ, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedQ.trim()) params.set("search", debouncedQ.trim());
      const res = await apiRequest("GET", `/api/payments/contact-requests?${params.toString()}`);
      return res.json();
    },
  });

  const { items: rows, total } = parsePaginatedListResponse<ContactPaymentRequestRow>(
    transactionsResponse,
    "transactions"
  );

  useEffect(() => {
    resetPage();
  }, [debouncedQ, resetPage]);

  return (
    <div
      className="atlas-manage-page atlas-transactions-page container max-w-6xl py-6 space-y-6"
      data-testid="page-transactions"
    >
      <div className="rh-page-hero">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          Transactions
        </h1>
        <p className="text-muted-foreground mt-1">
          Contact payment links (Razorpay / Cashfree) for your organization, newest first.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4 sm:flex sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Payment requests</CardTitle>
            <CardDescription>Statuses and gateway transaction IDs after customers pay.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contact, amount, txn id…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {total === 0 && !q.trim() ? "No payment requests yet." : "No rows match your search."}
            </p>
          ) : (
            <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const amountMajor = (row.amountMinor / 100).toFixed(2);
                    const paid = row.status === "paid";
                    const created = row.createdAt ? format(new Date(row.createdAt), "dd MMM yyyy, HH:mm") : "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">{created}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="font-medium truncate" title={contactLabel(row)}>
                            {contactLabel(row)}
                          </div>
                          {row.description ? (
                            <div className="text-xs text-muted-foreground truncate" title={row.description}>
                              {row.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium tabular-nums">
                          {row.currency} {amountMajor}
                        </TableCell>
                        <TableCell>
                          {paid ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
                          ) : (
                            <Badge variant="secondary">{row.status || "Pending"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize text-sm">{row.gateway}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[140px] break-all">
                          {row.gatewayPaymentId || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {!paid ? (
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/pay/${row.token}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Pay link
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {total > 0 && (
              <ListPaginationFooter
                total={total}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
                className="mt-4"
              />
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
