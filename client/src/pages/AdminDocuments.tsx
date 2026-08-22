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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Loader2,
  Plus,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  Archive,
  Shield,
  Tag,
  Trash2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  published: "bg-blue-100 text-blue-700",
  superseded: "bg-orange-100 text-orange-700",
  archived: "bg-gray-100 text-gray-500",
};

const TYPE_COLORS: Record<string, string> = {
  policy: "bg-purple-50 text-purple-700",
  procedure: "bg-blue-50 text-blue-700",
  template: "bg-teal-50 text-teal-700",
  form: "bg-cyan-50 text-cyan-700",
  certificate: "bg-amber-50 text-amber-700",
  report: "bg-green-50 text-green-700",
  notice: "bg-red-50 text-red-700",
  minutes: "bg-indigo-50 text-indigo-700",
  resolution: "bg-pink-50 text-pink-700",
  bcp: "bg-orange-50 text-orange-700",
  publication: "bg-cyan-50 text-cyan-700",
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "🌍 Public",
  members_only: "👥 Members Only",
  leadership_only: "🔒 Leadership Only",
  private: "🔐 Private",
};

export default function AdminDocuments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: "",
    description: "",
    type: "policy",
    category: "",
    content: "",
    visibility: "members_only" as "public" | "members_only" | "leadership_only" | "private",
    tags: "",
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.documents.stats.useQuery();
  const documents = adminTrpc.documents.list.useQuery({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    limit: 50,
  });

  const createDoc = adminTrpc.documents.create.useMutation({
    onSuccess: () => {
      toast.success("Document created");
      setCreateOpen(false);
      documents.refetch();
      stats.refetch();
      setNewDoc({ title: "", description: "", type: "policy", category: "", content: "", visibility: "members_only", tags: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDoc = adminTrpc.documents.delete.useMutation({
    onSuccess: () => { toast.success("Document deleted"); setDetailOpen(false); documents.refetch(); stats.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const transitionDoc = adminTrpc.documents.transition.useMutation({
    onSuccess: () => { toast.success("Status updated"); documents.refetch(); stats.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (documents.data ?? []).filter(
    (d: any) =>
      !searchQuery ||
      d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDocs = Object.values(stats.data ?? {}).reduce((a: number, b: any) => a + Number(b), 0);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Documents</h1>
          <p className="text-sm text-[#5D7086]">
            Policies, procedures, templates, forms, reports, and official notices
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Document</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Document title" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newDoc.description} onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })} placeholder="Brief description" rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newDoc.type} onValueChange={(v) => setNewDoc({ ...newDoc, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="form">Form</SelectItem>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="notice">Notice</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="resolution">Resolution</SelectItem>
                    <SelectItem value="bcp">Bylaw Change Proposal (§17.2)</SelectItem>
                    <SelectItem value="publication">Publication (§14.2, needs VPPRC approval)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Category</label>
                <Input value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })} placeholder="e.g. Governance, HR" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Visibility</label>
                <Select value={newDoc.visibility} onValueChange={(v: any) => setNewDoc({ ...newDoc, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="members_only">Members Only</SelectItem>
                    <SelectItem value="leadership_only">Leadership Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Tags (comma-separated)</label>
                <Input value={newDoc.tags} onChange={(e) => setNewDoc({ ...newDoc, tags: e.target.value })} placeholder="governance, policy, v1" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Content</label>
                <Textarea value={newDoc.content} onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })} placeholder="Document body text or markdown" rows={6} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  className="bg-[#138A73] hover:bg-[#106E5B] text-white"
                  onClick={() => createDoc.mutate({
                    ...newDoc,
                    tags: newDoc.tags ? newDoc.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
                  })}
                  disabled={!newDoc.title || createDoc.isPending}
                >
                  {createDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Document
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: totalDocs, icon: FileText, color: "text-[#138A73]" },
          { label: "Drafts", value: stats.data?.draft ?? 0, icon: Edit, color: "text-gray-600" },
          { label: "Published", value: stats.data?.published ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Under Review", value: stats.data?.under_review ?? 0, icon: Clock, color: "text-orange-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            <SelectItem value="procedure">Procedure</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="report">Report</SelectItem>
            <SelectItem value="notice">Notice</SelectItem>
            <SelectItem value="resolution">Resolution</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Documents ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No documents found</p>
              <p className="text-sm mt-1">Create your first document to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors cursor-pointer" onClick={() => { setSelectedDoc(doc); setDetailOpen(true); }}>
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#1B355E] truncate">{doc.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {doc.status?.replace(/_/g, " ")}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[doc.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {doc.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                      {doc.version && <span>v{doc.version}</span>}
                      {doc.visibility && <span>{VISIBILITY_LABELS[doc.visibility] ?? doc.visibility}</span>}
                      {doc.createdAt && <span>{new Date(doc.createdAt).toLocaleDateString()}</span>}
                      {doc.tags && doc.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {doc.tags.slice(0, 3).join(", ")}{doc.tags.length > 3 ? "..." : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); transitionDoc.mutate({ id: doc.id, status: "published" }); }}>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete "{doc.title}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteDoc.mutate({ id: doc.id })}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Document Details</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#1B355E]">{selectedDoc.title}</h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${STATUS_COLORS[selectedDoc.status] ?? "bg-gray-100 text-gray-600"}`}>{selectedDoc.status?.replace(/_/g, " ")}</span>
              </div>
              {selectedDoc.description && <p className="text-sm text-[#5D7086] leading-6">{selectedDoc.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Type</p><p className="font-semibold text-[#1B355E] capitalize">{selectedDoc.type}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Visibility</p><p className="font-semibold text-[#1B355E]">{VISIBILITY_LABELS[selectedDoc.visibility] ?? selectedDoc.visibility}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Version</p><p className="font-semibold text-[#1B355E]">v{selectedDoc.version ?? 1}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Created</p><p className="font-semibold text-[#1B355E]">{new Date(selectedDoc.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div className="border-t border-[#E7F4F0] pt-4">
                <p className="text-sm font-medium text-[#1B355E] mb-3">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDoc.status === "draft" && <Button size="sm" className="bg-yellow-600 text-white" onClick={() => { transitionDoc.mutate({ id: selectedDoc.id, status: "under_review" }); setSelectedDoc({ ...selectedDoc, status: "under_review" }); }}>Submit for Review</Button>}
                  {selectedDoc.status === "under_review" && <Button size="sm" className="bg-green-600 text-white" onClick={() => { transitionDoc.mutate({ id: selectedDoc.id, status: "approved" }); setSelectedDoc({ ...selectedDoc, status: "approved" }); }}>Approve</Button>}
                  {selectedDoc.status === "approved" && <Button size="sm" className="bg-blue-600 text-white" onClick={() => { transitionDoc.mutate({ id: selectedDoc.id, status: "published" }); setSelectedDoc({ ...selectedDoc, status: "published" }); }}>Publish</Button>}
                  <Button size="sm" variant="outline" onClick={() => { transitionDoc.mutate({ id: selectedDoc.id, status: "archived" }); setSelectedDoc({ ...selectedDoc, status: "archived" }); }}>Archive</Button>
                </div>
              </div>
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete Document</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteDoc.mutate({ id: selectedDoc.id })}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
