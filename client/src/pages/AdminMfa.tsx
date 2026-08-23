import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  ShieldCheck,
  Loader2,
  Smartphone,
  Key,
  Lock,
  ChevronRight,
} from "lucide-react";

export default function AdminMfa() {
  const [settings, setSettings] = useState({
    totpEnabled: true,
    passkeysEnabled: false,
    recoveryCodesEnabled: true,
    enforceForRoles: [] as string[],
    gracePeriodDays: 7,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.mfa?.stats?.useQuery() ?? { data: null };
  const users = adminTrpc.mfa?.enrollmentStatus?.useQuery() ?? {
    data: [],
    isLoading: false,
  };

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">
          Multi-Factor Authentication
        </h1>
        <p className="text-sm text-[#5D7086]">
          §35: TOTP, passkeys/WebAuthn, recovery codes, optional enforced MFA
          by role
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Users",
            value: stats.data?.total ?? 0,
            icon: ShieldCheck,
            color: "text-[#138A73]",
          },
          {
            label: "MFA Enrolled",
            value: stats.data?.enrolled ?? 0,
            icon: Smartphone,
            color: "text-green-600",
          },
          {
            label: "Pending Enrollment",
            value: stats.data?.pending ?? 0,
            icon: Key,
            color: "text-orange-600",
          },
          {
            label: "Recovery Codes Used",
            value: stats.data?.recoveryUsed ?? 0,
            icon: Lock,
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

      {/* MFA Methods Configuration */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">
              MFA Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[#138A73]" />
                <div>
                  <p className="font-medium text-sm text-[#1B355E]">
                    TOTP (Authenticator App)
                  </p>
                  <p className="text-xs text-[#5D7086]">
                    Google Authenticator, Authy, etc.
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.totpEnabled}
                onCheckedChange={(v) =>
                  setSettings((p) => ({ ...p, totpEnabled: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm text-[#1B355E]">
                    Passkeys / WebAuthn
                  </p>
                  <p className="text-xs text-[#5D7086]">
                    Hardware keys, biometrics
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.passkeysEnabled}
                onCheckedChange={(v) =>
                  setSettings((p) => ({ ...p, passkeysEnabled: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm text-[#1B355E]">
                    Recovery Codes
                  </p>
                  <p className="text-xs text-[#5D7086]">
                    One-time backup codes for account recovery
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.recoveryCodesEnabled}
                onCheckedChange={(v) =>
                  setSettings((p) => ({ ...p, recoveryCodesEnabled: v }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">
              Enforcement Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Enforce MFA for Roles
              </Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select roles to enforce MFA..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {settings.enforceForRoles.map((role) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className="bg-[#E7F4F0] text-[#138A73]"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Grace Period (days)
              </Label>
              <Input
                type="number"
                value={settings.gracePeriodDays}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    gracePeriodDays: parseInt(e.target.value) || 0,
                  }))
                }
                className="mt-1 w-32"
                min={0}
                max={90}
              />
              <p className="text-xs text-[#5D7086] mt-1">
                Days before enforced MFA is required after account creation
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Enrollment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (users.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No enrollment data yet</p>
              <p className="text-sm mt-1">
                User MFA enrollment status will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(users.data ?? []).map((u: any) => (
                <div
                  key={u.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div
                    className={`rounded-lg p-2.5 ${
                      u.mfaEnrolled ? "bg-green-50" : "bg-orange-50"
                    }`}
                  >
                    <ShieldCheck
                      className={`h-5 w-5 ${
                        u.mfaEnrolled ? "text-green-600" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1B355E] truncate">
                      {u.name || u.email}
                    </h3>
                    <p className="text-xs text-[#5D7086]">{u.email}</p>
                  </div>
                  <Badge
                    className={
                      u.mfaEnrolled
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }
                  >
                    {u.mfaEnrolled ? "Enrolled" : "Pending"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
          Save MFA Settings
        </Button>
      </div>
    </div>
  );
}
