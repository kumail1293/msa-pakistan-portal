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
  Building,
  Loader2,
  MapPin,
  Plus,
  Search,
  Users,
  ChevronRight,
} from "lucide-react";

export default function AdminChapters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newChapter, setNewChapter] = useState({
    name: "",
    shortName: "",
    city: "",
    province: "",
    type: "local_council",
    description: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.chapters.stats.useQuery();
  const chapters = adminTrpc.chapters.list.useQuery({
    type: typeFilter || undefined,
    limit: 50,
  });

  const createChapter = adminTrpc.chapters.create.useMutation({
    onSuccess: () => {
      toast.success("Chapter created successfully");
      setCreateOpen(false);
      chapters.refetch();
      stats.refetch();
      setNewChapter({ name: "", shortName: "", city: "", province: "", type: "local_council", description: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (chapters.data ?? []).filter(
    (c: any) =>
      !searchQuery ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Chapters</h1>
          <p className="text-sm text-[#5D7086]">
            Manage local councils, regional, and national chapters
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Chapter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Chapter</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Name *</label>
                <Input value={newChapter.name} onChange={(e) => setNewChapter({ ...newChapter, name: e.target.value })} placeholder="Chapter name" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Short Name</label>
                <Input value={newChapter.shortName} onChange={(e) => setNewChapter({ ...newChapter, shortName: e.target.value })} placeholder="e.g. KEMU LC" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newChapter.type} onValueChange={(v) => setNewChapter({ ...newChapter, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local_council">Local Council</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">City</label>
                <Input value={newChapter.city} onChange={(e) => setNewChapter({ ...newChapter, city: e.target.value })} placeholder="City" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Province</label>
                <Input value={newChapter.province} onChange={(e) => setNewChapter({ ...newChapter, province: e.target.value })} placeholder="Province" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newChapter.description} onChange={(e) => setNewChapter({ ...newChapter, description: e.target.value })} rows={3} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createChapter.mutate(newChapter)} disabled={!newChapter.name || createChapter.isPending}>
                  {createChapter.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Chapter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Chapters", value: Object.values(stats.data ?? {}).reduce((a: number, b: any) => a + Number(b), 0), icon: Building, color: "text-[#138A73]" },
          { label: "Local Councils", value: stats.data?.local_council ?? 0, icon: MapPin, color: "text-blue-600" },
          { label: "Regional", value: stats.data?.regional ?? 0, icon: Users, color: "text-purple-600" },
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
          <Input className="pl-9" placeholder="Search chapters..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="local_council">Local Council</SelectItem>
            <SelectItem value="regional">Regional</SelectItem>
            <SelectItem value="national">National</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Chapters ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {chapters.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No chapters found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((chapter: any) => (
                <div key={chapter.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-[#E7F4F0] p-2.5">
                    <Building className="h-5 w-5 text-[#138A73]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1B355E] truncate">{chapter.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                      {chapter.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {chapter.city}</span>}
                      {chapter.province && <span>{chapter.province}</span>}
                      <span className="capitalize">{chapter.type?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
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
