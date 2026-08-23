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
  Activity,
  Loader2,
  Server,
  Database,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HardDrive,
  Cpu,
  Wifi,
  ChevronRight,
} from "lucide-react";

export default function AdminOps() {
  const [envFilter, setEnvFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const health = adminTrpc.ops?.health?.useQuery() ?? { data: null };
  const services = adminTrpc.ops?.services?.useQuery() ?? {
    data: [],
    isLoading: false,
  };
  const deployments = adminTrpc.ops?.deployments?.useQuery({
    environment: envFilter || undefined,
    limit: 20,
  }) ?? { data: [], isLoading: false };

  const statusColors: Record<string, string> = {
    healthy: "bg-green-100 text-green-700",
    degraded: "bg-orange-100 text-orange-700",
    down: "bg-red-100 text-red-700",
    unknown: "bg-gray-100 text-gray-600",
  };

  const statusIcons: Record<string, typeof CheckCircle> = {
    healthy: CheckCircle,
    degraded: AlertTriangle,
    down: XCircle,
    unknown: AlertTriangle,
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            Operations & DevOps
          </h1>
          <p className="text-sm text-[#5D7086]">
            §145: CI/CD, migrations, environment separation, observability,
            backups, health checks, monitoring
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "API Server",
            value: health.data?.api ?? "unknown",
            icon: Server,
          },
          {
            label: "Database",
            value: health.data?.database ?? "unknown",
            icon: Database,
          },
          {
            label: "Uptime",
            value: health.data?.uptime ?? "N/A",
            icon: Clock,
          },
          {
            label: "Last Deploy",
            value: health.data?.lastDeploy ?? "N/A",
            icon: Activity,
          },
        ].map((item) => {
          const StatusIcon = statusIcons[item.value] || AlertTriangle;
          return (
            <Card key={item.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-50 p-2 text-[#138A73]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#5D7086]">{item.label}</p>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon
                        className={`h-3.5 w-3.5 ${
                          item.value === "healthy"
                            ? "text-green-600"
                            : item.value === "degraded"
                            ? "text-orange-600"
                            : item.value === "down"
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      />
                      <p className="text-sm font-semibold text-[#1B355E] capitalize truncate">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* System Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            System Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "CPU Usage",
                value: health.data?.cpu ?? 0,
                icon: Cpu,
                color: "text-blue-600",
              },
              {
                label: "Memory",
                value: health.data?.memory ?? 0,
                icon: HardDrive,
                color: "text-purple-600",
              },
              {
                label: "Disk",
                value: health.data?.disk ?? 0,
                icon: Database,
                color: "text-green-600",
              },
            ].map((resource) => (
              <div
                key={resource.label}
                className="rounded-lg border border-[#E7F4F0] p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <resource.icon className={`h-4 w-4 ${resource.color}`} />
                  <span className="text-sm font-medium text-[#1B355E]">
                    {resource.label}
                  </span>
                  <span className="ml-auto text-sm font-bold text-[#1B355E]">
                    {resource.value}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      resource.value > 80
                        ? "bg-red-500"
                        : resource.value > 60
                        ? "bg-orange-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(resource.value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {services.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (services.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No service data available</p>
              <p className="text-sm mt-1">
                Health check results will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(services.data ?? []).map((service: any) => {
                const ServiceIcon =
                  statusIcons[service.status] || AlertTriangle;
                return (
                  <div
                    key={service.name}
                    className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                  >
                    <ServiceIcon
                      className={`h-5 w-5 ${
                        service.status === "healthy"
                          ? "text-green-600"
                          : service.status === "degraded"
                          ? "text-orange-600"
                          : "text-red-600"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {service.name}
                      </h3>
                      <p className="text-xs text-[#5D7086]">
                        {service.description}
                      </p>
                    </div>
                    <Badge className={statusColors[service.status]}>
                      {service.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[#1B355E]">
              Deployment History
            </CardTitle>
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Envs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {deployments.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (deployments.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No deployments recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(deployments.data ?? []).map((deploy: any) => (
                <div
                  key={deploy.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div
                    className={`rounded-lg p-2.5 ${
                      deploy.success ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    {deploy.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {deploy.version || deploy.commit || "Unknown"}
                      </h3>
                      <Badge className="bg-gray-100 text-gray-600 text-[10px]">
                        {deploy.environment}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">
                      {deploy.deployedBy || "System"} — {deploy.deployedAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
