import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accessibility,
  Loader2,
  Eye,
  Keyboard,
  Monitor,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

export default function AdminAccessibility() {
  const [categoryFilter, setCategoryFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.accessibility?.stats?.useQuery() ?? { data: null };
  const checks = adminTrpc.accessibility?.checks?.useQuery({
    category: categoryFilter || undefined,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  const statusIcons: Record<string, typeof CheckCircle> = {
    pass: CheckCircle,
    warn: AlertTriangle,
    fail: XCircle,
  };

  const statusColors: Record<string, string> = {
    pass: "bg-green-100 text-green-700",
    warn: "bg-orange-100 text-orange-700",
    fail: "bg-red-100 text-red-700",
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Accessibility</h1>
          <p className="text-sm text-[#5D7086]">
            §141: WCAG 2.2 AA — keyboard navigation, focus management,
            semantic structure, contrast, labels, screen-reader support
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4" /> Run Audit
        </Button>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Checks",
            value: stats.data?.total ?? 0,
            icon: Accessibility,
            color: "text-[#138A73]",
          },
          {
            label: "Passing",
            value: stats.data?.pass ?? 0,
            icon: CheckCircle,
            color: "text-green-600",
          },
          {
            label: "Warnings",
            value: stats.data?.warn ?? 0,
            icon: AlertTriangle,
            color: "text-orange-600",
          },
          {
            label: "Failing",
            value: stats.data?.fail ?? 0,
            icon: XCircle,
            color: "text-red-600",
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

      {/* Compliance Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg
                className="w-20 h-20 -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-100"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#138A73]"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${
                    stats.data?.total
                      ? Math.round(
                          ((stats.data?.pass ?? 0) / stats.data.total) * 100
                        )
                      : 0
                  }, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-[#1B355E]">
                  {stats.data?.total
                    ? Math.round(
                        ((stats.data?.pass ?? 0) / stats.data.total) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1B355E]">
                WCAG 2.2 AA Compliance
              </h3>
              <p className="text-sm text-[#5D7086]">
                Target: 100% passing checks across all accessibility criteria
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="keyboard">Keyboard Navigation</SelectItem>
            <SelectItem value="contrast">Color Contrast</SelectItem>
            <SelectItem value="labels">Labels & ARIA</SelectItem>
            <SelectItem value="focus">Focus Management</SelectItem>
            <SelectItem value="semantic">Semantic HTML</SelectItem>
            <SelectItem value="forms">Accessible Forms</SelectItem>
            <SelectItem value="motion">Motion & Animation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Accessibility Audit Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checks.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (checks.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Accessibility className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No audit results yet</p>
              <p className="text-sm mt-1">
                Run an accessibility audit to see results here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(checks.data ?? []).map((check: any) => {
                const CheckIcon =
                  statusIcons[check.status] || AlertTriangle;
                return (
                  <div
                    key={check.id}
                    className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                  >
                    <CheckIcon
                      className={`h-5 w-5 ${
                        check.status === "pass"
                          ? "text-green-600"
                          : check.status === "warn"
                          ? "text-orange-600"
                          : "text-red-600"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1B355E] truncate">
                          {check.rule}
                        </h3>
                        <Badge className={statusColors[check.status]}>
                          {check.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#5D7086] mt-1">
                        {check.description}
                      </p>
                    </div>
                    <span className="text-xs text-[#8A9BAE] shrink-0">
                      {check.category}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
