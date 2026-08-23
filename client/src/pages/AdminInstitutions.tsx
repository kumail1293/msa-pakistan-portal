import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building,
  Loader2,
  Search,
  Plus,
  MapPin,
  GraduationCap,
  ChevronRight,
} from "lucide-react";

export default function AdminInstitutions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newInstitution, setNewInstitution] = useState({
    name: "",
    type: "university",
    city: "",
    province: "",
    description: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.institutions?.stats?.useQuery() ?? { data: null };
  const institutions = adminTrpc.institutions?.list?.useQuery({
    type: typeFilter || undefined,
    search: searchQuery || undefined,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            Institutions
          </h1>
          <p className="text-sm text-[#5D7086]">
            §7: Academic/institution directory — universities, colleges,
            campuses, departments, cities, provinces
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Institution
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Institutions",
            value: stats.data?.total ?? 0,
            icon: Building,
            color: "text-[#138A73]",
          },
          {
            label: "Universities",
            value: stats.data?.universities ?? 0,
            icon: GraduationCap,
            color: "text-blue-600",
          },
          {
            label: "Colleges",
            value: stats.data?.colleges ?? 0,
            icon: Building,
            color: "text-purple-600",
          },
          {
            label: "Provinces",
            value: stats.data?.provinces ?? 0,
            icon: MapPin,
            color: "text-orange-600",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">
                    {stat.value}
                  </p>
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
          <Input
            className="pl-9"
            placeholder="Search institutions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="university">University</SelectItem>
            <SelectItem value="college">College</SelectItem>
            <SelectItem value="medical_school">Medical School</SelectItem>
            <SelectItem value="campus">Campus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Institutions ({(institutions.data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {institutions.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (institutions.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No institutions found</p>
              <p className="text-sm mt-1">
                Add academic institutions to track chapters and members.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(institutions.data ?? []).map((inst: any) => (
                <div
                  key={inst.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {inst.name}
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                        {inst.type}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">
                      {[inst.city, inst.province].filter(Boolean).join(", ") ||
                        "Location not set"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B355E]">
              Add Institution
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Institution Name
              </Label>
              <Input
                value={newInstitution.name}
                onChange={(e) =>
                  setNewInstitution((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="University of Punjab"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">
                  Type
                </Label>
                <Select
                  value={newInstitution.type}
                  onValueChange={(v) =>
                    setNewInstitution((p) => ({ ...p, type: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="medical_school">
                      Medical School
                    </SelectItem>
                    <SelectItem value="campus">Campus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">
                  City
                </Label>
                <Input
                  value={newInstitution.city}
                  onChange={(e) =>
                    setNewInstitution((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="Lahore"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Province
              </Label>
              <Input
                value={newInstitution.province}
                onChange={(e) =>
                  setNewInstitution((p) => ({
                    ...p,
                    province: e.target.value,
                  }))
                }
                placeholder="Punjab"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Description
              </Label>
              <Textarea
                value={newInstitution.description}
                onChange={(e) =>
                  setNewInstitution((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={!newInstitution.name}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              Add Institution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
