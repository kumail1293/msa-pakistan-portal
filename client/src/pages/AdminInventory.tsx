import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Loader2,
  Search,
  CheckCircle,
  AlertTriangle,
  Wrench,
  ChevronRight,
} from "lucide-react";

export default function AdminInventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.inventory.stats.useQuery();
  const items = adminTrpc.inventory.list.useQuery({
    category: categoryFilter || undefined,
    limit: 50,
  });

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Inventory</h1>
        <p className="text-sm text-[#5D7086]">
          §125: Equipment, badges, devices, ownership, location, and disposal
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Items", value: stats.data?.total ?? 0, icon: Package, color: "text-[#138A73]" },
          { label: "Available", value: stats.data?.available ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Assigned", value: stats.data?.assigned ?? 0, icon: Wrench, color: "text-blue-600" },
          { label: "Maintenance", value: stats.data?.maintenance ?? 0, icon: AlertTriangle, color: "text-orange-600" },
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
          <Input className="pl-9" placeholder="Search inventory..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="badges">Badges</SelectItem>
            <SelectItem value="devices">Devices</SelectItem>
            <SelectItem value="event_assets">Event Assets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Items ({(items.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (items.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No inventory items found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(items.data ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-purple-50 p-2.5">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{item.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.status === "available" ? "bg-green-100 text-green-700" : item.status === "maintenance" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">{item.category}</p>
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
