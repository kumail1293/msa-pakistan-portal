import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle,
  Lock,
  ChevronRight,
} from "lucide-react";

export default function AdminSafeguarding() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.safeguarding.stats.useQuery();
  const incidents = adminTrpc.safeguarding.list.useQuery({
    category: categoryFilter || undefined,
    limit: 50,
  });

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Safeguarding</h1>
          <p className="text-sm text-[#5D7086]">
            §117: Safeguarding policies, consent, incident workflows, restricted records
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Incidents", value: stats.data?.total ?? 0, icon: Shield, color: "text-[#138A73]" },
          { label: "Open", value: stats.data?.open ?? 0, icon: AlertTriangle, color: "text-orange-600" },
          { label: "Under Review", value: stats.data?.under_review ?? 0, icon: Lock, color: "text-blue-600" },
          { label: "Closed", value: stats.data?.closed ?? 0, icon: CheckCircle, color: "text-green-600" },
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
          <Input className="pl-9" placeholder="Search incidents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="child_protection">Child Protection</SelectItem>
            <SelectItem value="vulnerable_adults">Vulnerable Adults</SelectItem>
            <SelectItem value="safety">Safety Incident</SelectItem>
            <SelectItem value="policy_violation">Policy Violation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Incidents ({(incidents.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (incidents.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No safeguarding incidents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(incidents.data ?? []).map((incident: any) => (
                <div key={incident.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-orange-50 p-2.5">
                    <Shield className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{incident.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${incident.status === "closed" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">{incident.category}</p>
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
