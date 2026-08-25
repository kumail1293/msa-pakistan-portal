import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CommentSection } from "@/components/CommentSection";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Receipt, Clock, CheckCircle2, Lock, Loader2, PlusCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberFinance() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("summary");
  const [showForm, setShowForm] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");

  const summaryQuery = trpc.finance.mySummary.useQuery();
  const expensesQuery = trpc.finance.myExpenses.useQuery();
  const submitExpense = trpc.finance.submitExpense.useMutation({
    onSuccess: () => {
      toast.success("Expense claim submitted!");
      setShowForm(false);
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseDescription("");
      expensesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Could not submit expense."),
  });

  const summary = summaryQuery.data as any;
  const expenses = (expensesQuery.data ?? []) as any[];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "submitted": case "pending": return "bg-amber-100 text-amber-700 border-amber-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const handleSubmitExpense = () => {
    if (!expenseTitle.trim() || !expenseAmount) {
      toast.error("Please fill in title and amount.");
      return;
    }
    submitExpense.mutate({
      title: expenseTitle.trim(),
      amount: parseFloat(expenseAmount),
      category: expenseCategory || undefined,
      description: expenseDescription || undefined,
    });
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view finances</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Access your financial summary and submit expense claims after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/finance")} className="msap-primary-action mt-6 px-8 text-white">
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">My Finances</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Financial Summary</h1>
          <p className="mt-2 text-[#66788D]">View your expense history and submit new claims</p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F0]">
                  <Wallet className="h-5 w-5 text-[#106E5B]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">PKR {(summary?.totalExpenses ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-[#66788D]">Total Expenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{summary?.pendingExpenses ?? 0}</p>
                  <p className="text-xs text-[#66788D]">Pending Claims</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{summary?.approvedExpenses ?? 0}</p>
                  <p className="text-xs text-[#66788D]">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Receipt className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{summary?.expenseCount ?? 0}</p>
                  <p className="text-xs text-[#66788D]">Total Claims</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
            <TabsTrigger value="summary">Overview</TabsTrigger>
            <TabsTrigger value="expenses">My Expenses</TabsTrigger>
            <TabsTrigger value="submit">Submit Claim</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {summaryQuery.isLoading ? (
              <Card className="msap-card py-16 text-center">
                <CardContent>
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
                  <p className="text-[#5D7086]">Loading summary...</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="msap-card">
                <CardHeader>
                  <CardTitle className="text-[#1B355E]">Financial Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                      <p className="text-sm text-[#66788D]">Total Expenses Submitted</p>
                      <p className="mt-1 text-xl font-bold text-[#1B355E]">PKR {(summary?.totalExpenses ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                      <p className="text-sm text-[#66788D]">Claims This Month</p>
                      <p className="mt-1 text-xl font-bold text-[#1B355E]">{summary?.expenseCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#E7EFEC] bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)] p-4">
                    <p className="text-sm text-[#42566E]">
                      Submit expense claims for MSAP-related activities. Claims are reviewed by the Finance
                      department and approved within 5-7 business days.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            {expensesQuery.isLoading ? (
              <Card className="msap-card py-16 text-center">
                <CardContent>
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
                  <p className="text-[#5D7086]">Loading expenses...</p>
                </CardContent>
              </Card>
            ) : expenses.length === 0 ? (
              <Card className="msap-card py-12 text-center">
                <CardContent>
                  <Receipt className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                  <h3 className="text-lg font-semibold text-[#1B355E]">No expense claims yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                    Submit your first expense claim to get started.
                  </p>
                  <Button onClick={() => setSelectedTab("submit")} className="msap-primary-action mt-4 text-white">
                    <PlusCircle className="mr-2 h-4 w-4" /> Submit Claim
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense: any) => (
                  <Card key={expense.id} className="msap-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-[#1B355E]">{expense.title}</h4>
                          {expense.description && (
                            <p className="mt-1 text-sm text-[#5D7086]">{expense.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-sm text-[#66788D]">
                            <span>{new Date(expense.createdAt).toLocaleDateString()}</span>
                            {expense.category && (
                              <Badge variant="outline" className="border-[#D9E4E1] text-[#66788D]">
                                {expense.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-[#1B355E]">
                            PKR {Number(expense.totalAmount ?? 0).toLocaleString()}
                          </p>
                          <Badge className={`mt-1 border ${getStatusColor(expense.status ?? "submitted")}`}>
                            {expense.status ?? "submitted"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submit">
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Submit Expense Claim</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#344A61]">Title *</label>
                  <Input
                    placeholder="e.g., Travel to Regional Conference"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-[#344A61]">Amount (PKR) *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#344A61]">Category</label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                        <SelectItem value="meals">Meals</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#344A61]">Description</label>
                  <Input
                    placeholder="Brief description of the expense..."
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-3 text-sm text-[#5D7086]">
                  <DollarSign className="mr-1 inline h-4 w-4 text-[#106E5B]" />
                  Expense claims are reviewed by the Finance department. You will be notified once a decision is made.
                </div>
                <Button
                  onClick={handleSubmitExpense}
                  disabled={!expenseTitle.trim() || !expenseAmount || submitExpense.isPending}
                  className="msap-primary-action w-full text-white disabled:opacity-50"
                >                    {submitExpense.isPending ? "Submitting..." : "Submit Expense Claim"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <CommentSection entityType="finance" entityId={1} module="finance" />
        </div>
      </div>
    </div>
  );
}
