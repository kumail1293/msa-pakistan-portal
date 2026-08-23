import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Rocket,
  Loader2,
  Plus,
  Building,
  Users,
  Globe,
  CreditCard,
  ChevronRight,
} from "lucide-react";

export default function AdminSaaS() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: "",
    domain: "",
    plan: "free",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.saas?.stats?.useQuery() ?? { data: null };
  const tenants = adminTrpc.saas?.tenants?.useQuery() ?? {
    data: [],
    isLoading: false,
  };

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-100 text-blue-700",
    professional: "bg-purple-100 text-purple-700",
    enterprise: "bg-[#138A73] text-white",
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            SaaS & Federation
          </h1>
          <p className="text-sm text-[#5D7086]">
            Multi-tenant management, subscription plans, and federation
            platform for national/international organizations
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Tenants",
            value: stats.data?.total ?? 0,
            icon: Building,
            color: "text-[#138A73]",
          },
          {
            label: "Active",
            value: stats.data?.active ?? 0,
            icon: Globe,
            color: "text-green-600",
          },
          {
            label: "Total Users",
            value: stats.data?.users ?? 0,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Revenue",
            value: `$${stats.data?.revenue ?? 0}`,
            icon: CreditCard,
            color: "text-purple-600",
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

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Subscription Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0/mo",
                features: ["100 members", "Basic modules", "Community support"],
                tenants: stats.data?.freePlan ?? 0,
              },
              {
                name: "Starter",
                price: "$49/mo",
                features: [
                  "500 members",
                  "All modules",
                  "Email support",
                ],
                tenants: stats.data?.starterPlan ?? 0,
              },
              {
                name: "Professional",
                price: "$199/mo",
                features: [
                  "5,000 members",
                  "All modules",
                  "API access",
                  "Priority support",
                ],
                tenants: stats.data?.proPlan ?? 0,
              },
              {
                name: "Enterprise",
                price: "Custom",
                features: [
                  "Unlimited",
                  "Custom modules",
                  "SLA",
                  "Dedicated support",
                ],
                tenants: stats.data?.enterprisePlan ?? 0,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[#1B355E]">{plan.name}</h3>
                  <Badge className={planColors[plan.name.toLowerCase()]}>
                    {plan.tenants} tenant(s)
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-[#138A73] mb-3">
                  {plan.price}
                </p>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-xs text-[#5D7086]"
                    >
                      <CheckIcon className="h-3 w-3 text-[#138A73] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tenants List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Tenants ({(tenants.data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (tenants.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Rocket className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tenants onboarded</p>
              <p className="text-sm mt-1">
                Add organizations to the SaaS platform.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(tenants.data ?? []).map((tenant: any) => (
                <div
                  key={tenant.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-[#1B355E]/10 p-2.5">
                    <Building className="h-5 w-5 text-[#1B355E]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {tenant.name}
                      </h3>
                      <Badge
                        className={
                          planColors[tenant.plan] || "bg-gray-100 text-gray-600"
                        }
                      >
                        {tenant.plan}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">
                      {tenant.domain || "No custom domain"} —{" "}
                      {tenant.memberCount ?? 0} members
                    </p>
                  </div>
                  <Switch checked={tenant.active} />
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
              Add New Tenant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Organization Name
              </Label>
              <Input
                value={newTenant.name}
                onChange={(e) =>
                  setNewTenant((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="MSA Indonesia"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Custom Domain
              </Label>
              <Input
                value={newTenant.domain}
                onChange={(e) =>
                  setNewTenant((p) => ({ ...p, domain: e.target.value }))
                }
                placeholder="portal.msaindonesia.org"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Plan
              </Label>
              <Select
                value={newTenant.plan}
                onValueChange={(v) =>
                  setNewTenant((p) => ({ ...p, plan: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter ($49/mo)</SelectItem>
                  <SelectItem value="professional">
                    Professional ($199/mo)
                  </SelectItem>
                  <SelectItem value="enterprise">Enterprise (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={!newTenant.name}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              Add Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
