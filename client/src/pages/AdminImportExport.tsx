import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function AdminImportExport() {
  const [tab, setTab] = useState<"imports" | "exports">("imports");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const imports = adminTrpc.importExport.imports.useQuery({ limit: 50 });
  const exports = adminTrpc.importExport.exports.useQuery({ limit: 50 });

  const data = tab === "imports" ? imports.data : exports.data;
  const isLoading = tab === "imports" ? imports.isLoading : exports.isLoading;

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Import / Export</h1>
        <p className="text-sm text-[#5D7086]">
          §138: CSV/XLSX imports, mapping, validation, dry-run, and exports
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("imports")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "imports" ? "bg-[#1B355E] text-white" : "bg-white text-[#5D7086] hover:bg-[#E7F4F0]"}`}
        >
          <ArrowDownToLine className="h-4 w-4" /> Imports
        </button>
        <button
          onClick={() => setTab("exports")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "exports" ? "bg-[#1B355E] text-white" : "bg-white text-[#5D7086] hover:bg-[#E7F4F0]"}`}
        >
          <ArrowUpFromLine className="h-4 w-4" /> Exports
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total", value: (data ?? []).length, icon: tab === "imports" ? ArrowDownToLine : ArrowUpFromLine, color: "text-[#138A73]" },
          { label: "Completed", value: (data ?? []).filter((d: any) => d.status === "completed")?.length ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Failed", value: (data ?? []).filter((d: any) => d.status === "failed")?.length ?? 0, icon: AlertTriangle, color: "text-red-600" },
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            {tab === "imports" ? "Import History" : "Export History"} ({(data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              {tab === "imports" ? <ArrowDownToLine className="h-12 w-12 mx-auto mb-3 opacity-30" /> : <ArrowUpFromLine className="h-12 w-12 mx-auto mb-3 opacity-30" />}
              <p className="font-medium">No {tab} found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className={`rounded-lg p-2.5 ${tab === "imports" ? "bg-blue-50" : "bg-green-50"}`}>
                    {tab === "imports" ? <ArrowDownToLine className="h-5 w-5 text-blue-600" /> : <ArrowUpFromLine className="h-5 w-5 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{item.name || item.type || `Job #${item.id}`}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.status === "completed" ? "bg-green-100 text-green-700" : item.status === "failed" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">{item.type} • {item.entityType || "data"}</p>
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
