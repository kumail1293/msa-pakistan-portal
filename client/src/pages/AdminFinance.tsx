import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Loader2,
  Plus,
  Search,
  Wallet,
  Receipt,
  PiggyBank,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-orange-100 text-orange-700",
  reconciled: "bg-teal-100 text-teal-700",
};

function formatPKR(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "PKR 0";
  return `PKR ${num.toLocaleString("en-PK")}`;
}

export default function AdminFinance() {
  const [tab, setTab] = useState<"summary" | "budgets" | "transactions" | "expenses">("summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [createBudgetOpen, setCreateBudgetOpen] = useState(false);
  const [createTxOpen, setCreateTxOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({ name: "", fiscalYear: "", totalBudget: 0 });
  const [newTx, setNewTx] = useState({ type: "expense", amount: 0, description: "", category: "" });
  const [reviewNotes, setReviewNotes] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const summary = adminTrpc.finance.summary.useQuery();
  const transactions = adminTrpc.finance.transactions.useQuery({ limit: 50 });
  const expenses = adminTrpc.finance.expenses.useQuery({ limit: 50 });

  const reviewExpense = adminTrpc.finance.reviewExpense.useMutation({
    onSuccess: () => { toast.success("Expense reviewed"); expenses.refetch(); summary.refetch(); setReviewNotes(""); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createBudget = adminTrpc.finance.createBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget created");
      setCreateBudgetOpen(false);
      summary.refetch();
      setNewBudget({ name: "", fiscalYear: "", totalBudget: 0 });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredTransactions = (transactions.data ?? []).filter(
    (t: any) =>
      !searchQuery ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpenses = (expenses.data ?? []).filter(
    (e: any) =>
      !searchQuery ||
      e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Finance</h1>
          <p className="text-sm text-[#5D7086]">
            Budgets, transactions, expense claims, and financial reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createBudgetOpen} onOpenChange={setCreateBudgetOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#138A73] text-[#138A73]">
                <PiggyBank className="h-4 w-4 mr-2" /> New Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-[#1B355E]">Budget Name *</label>
                  <Input value={newBudget.name} onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })} placeholder="e.g. Annual Budget 2025-26" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1B355E]">Fiscal Year *</label>
                  <Input value={newBudget.fiscalYear} onChange={(e) => setNewBudget({ ...newBudget, fiscalYear: e.target.value })} placeholder="2025-2026" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1B355E]">Total Budget (PKR) *</label>
                  <Input type="number" value={newBudget.totalBudget || ""} onChange={(e) => setNewBudget({ ...newBudget, totalBudget: Number(e.target.value) })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateBudgetOpen(false)}>Cancel</Button>
                  <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createBudget.mutate(newBudget)} disabled={!newBudget.name || !newBudget.fiscalYear || createBudget.isPending}>
                    {createBudget.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Income", value: formatPKR(summary.data?.totalIncome ?? 0), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Total Expenses", value: formatPKR(summary.data?.totalExpenses ?? 0), icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
          { label: "Pending Expenses", value: String(summary.data?.pendingExpenses ?? 0), icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Active Budgets", value: String(summary.data?.activeBudgets ?? 0), icon: PiggyBank, color: "text-[#138A73]", bg: "bg-[#E7F4F0]" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { key: "summary" as const, label: "Overview" },
          { key: "transactions" as const, label: "Transactions" },
          { key: "expenses" as const, label: "Expense Claims" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-white text-[#1B355E] shadow-sm"
                : "text-[#5D7086] hover:text-[#1B355E]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
        <Input
          className="pl-9"
          placeholder={`Search ${tab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Transactions Tab */}
      {tab === "transactions" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">Transactions ({filteredTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-[#5D7086]">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-3 rounded-lg border border-[#E7F4F0] p-3">
                    <div className={`rounded-lg p-2 ${tx.type === "income" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                      {tx.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1B355E] truncate">{tx.description || tx.category || "Transaction"}</p>
                      <p className="text-xs text-[#5D7086]">{tx.category} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatPKR(tx.amount)}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[tx.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {tx.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expenses Tab */}
      {tab === "expenses" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">Expense Claims ({filteredExpenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-[#5D7086]">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No expense claims yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((expense: any) => (
                  <div key={expense.id} className="rounded-lg border border-[#E7F4F0] p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1B355E] truncate">{expense.title}</p>
                        <p className="text-xs text-[#5D7086]">{expense.category || "Uncategorized"} · {new Date(expense.createdAt).toLocaleDateString()}</p>
                        {expense.description && <p className="text-xs text-[#5D7086] mt-0.5 truncate">{expense.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">{formatPKR(expense.totalAmount)}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[expense.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {expense.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {expense.status === "submitted" && (
                      <div className="flex items-center gap-2 pt-1 border-t border-[#E7F4F0]">
                        <Input placeholder="Review notes (optional)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="h-8 text-xs flex-1" />
                        <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => reviewExpense.mutate({ claimId: expense.id, decision: "approved", notes: reviewNotes || undefined })} disabled={reviewExpense.isPending}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" className="h-8 bg-red-600 text-white hover:bg-red-700" onClick={() => reviewExpense.mutate({ claimId: expense.id, decision: "rejected", notes: reviewNotes || undefined })} disabled={reviewExpense.isPending}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Tab */}
      {tab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-lg text-[#1B355E]">Recent Transactions</CardTitle></CardHeader>
            <CardContent>
              {(transactions.data ?? []).slice(0, 5).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#E7F4F0] last:border-0">
                  <span className="text-sm text-[#1B355E]">{tx.description || tx.category || "Transaction"}</span>
                  <span className={`text-sm font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatPKR(tx.amount)}
                  </span>
                </div>
              ))}
              {(!transactions.data || transactions.data.length === 0) && (
                <p className="text-sm text-[#5D7086] text-center py-4">No transactions yet</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg text-[#1B355E]">Pending Expenses</CardTitle></CardHeader>
            <CardContent>
              {(expenses.data ?? []).filter((e: any) => ["submitted", "under_review"].includes(e.status)).slice(0, 5).map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between py-2 border-b border-[#E7F4F0] last:border-0">
                  <span className="text-sm text-[#1B355E]">{expense.title}</span>
                  <span className="text-sm font-semibold text-orange-600">{formatPKR(expense.totalAmount)}</span>
                </div>
              ))}
              {(!expenses.data || expenses.data.filter((e: any) => ["submitted", "under_review"].includes(e.status)).length === 0) && (
                <p className="text-sm text-[#5D7086] text-center py-4">No pending expenses</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
