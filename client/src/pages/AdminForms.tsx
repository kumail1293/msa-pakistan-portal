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
  FileText,
  Loader2,
  Plus,
  Search,
  CheckCircle,
  Inbox,
  ChevronRight,
} from "lucide-react";

export default function AdminForms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    description: "",
    entityType: "application",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const forms = adminTrpc.forms.list.useQuery({
    entityType: statusFilter || undefined,
  });

  const filtered = (forms.data ?? []).filter(
    (f: any) =>
      !searchQuery ||
      f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Forms Builder</h1>
          <p className="text-sm text-[#5D7086]">
            §46-48: Dynamic forms, field builder, validation, submissions
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Form</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Name *</label>
                <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Form name" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Entity Type</label>
                <Select value={newForm.entityType} onValueChange={(v) => setNewForm({ ...newForm, entityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application">Application</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => {
                  adminTrpc.forms.create.mutate(newForm, {
                    onSuccess: () => { toast.success("Form created"); setCreateOpen(false); forms.refetch(); },
                    onError: (err: Error) => toast.error(err.message),
                  });
                }} disabled={!newForm.name}>
                  Create Form
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Forms", value: forms.data?.length ?? 0, icon: FileText, color: "text-[#138A73]" },
          { label: "Active", value: forms.data?.filter((f: any) => f.isActive)?.length ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Submissions", value: forms.data?.reduce((sum: number, f: any) => sum + (f.submissionCount ?? 0), 0) ?? 0, icon: Inbox, color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search forms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Forms ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {forms.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No forms found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((form: any) => (
                <div key={form.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{form.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${form.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {form.isActive ? "Active" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1 capitalize">{form.entityType} • {form.fieldCount ?? 0} fields</p>
                  </div>
                  <Button size="sm" variant="outline">
                    <CheckCircle className="h-4 w-4 mr-1" /> Activate
                  </Button>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
