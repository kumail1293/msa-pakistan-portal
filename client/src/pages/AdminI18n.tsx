import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe,
  Loader2,
  Search,
  Plus,
  Languages,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

export default function AdminI18n() {
  const [searchQuery, setSearchQuery] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLocale, setNewLocale] = useState({
    code: "",
    name: "",
    nativeName: "",
    rtl: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.i18n?.stats?.useQuery() ?? { data: null };
  const locales = adminTrpc.i18n?.list?.useQuery() ?? {
    data: [],
    isLoading: false,
  };
  const translations = adminTrpc.i18n?.translations?.useQuery({
    locale: "en",
    limit: 20,
  }) ?? { data: [], isLoading: false };

  const localeFlags: Record<string, string> = {
    en: "🇬🇧",
    ur: "🇵🇰",
    ar: "🇸🇦",
    fr: "🇫🇷",
    es: "🇪🇸",
    tr: "🇹🇷",
    ms: "🇲🇾",
    id: "🇮🇩",
    bn: "🇧🇩",
    fa: "🇮🇷",
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            Internationalization
          </h1>
          <p className="text-sm text-[#5D7086]">
            §140: English, Urdu, and future languages — locale-aware dates,
            numbers, currencies, RTL support
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Locale
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Locales",
            value: stats.data?.total ?? 0,
            icon: Globe,
            color: "text-[#138A73]",
          },
          {
            label: "Active",
            value: stats.data?.active ?? 0,
            icon: CheckCircle,
            color: "text-green-600",
          },
          {
            label: "Translation Keys",
            value: stats.data?.keys ?? 0,
            icon: Languages,
            color: "text-blue-600",
          },
          {
            label: "RTL Languages",
            value: stats.data?.rtl ?? 0,
            icon: Languages,
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

      {/* Locales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Locales ({(locales.data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locales.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (locales.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No locales configured</p>
              <p className="text-sm mt-1">
                Add languages to enable multi-language support.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(locales.data ?? []).map((locale: any) => (
                <div
                  key={locale.code}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="text-2xl">
                    {localeFlags[locale.code] || "🌍"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {locale.name}
                      </h3>
                      <Badge className="bg-gray-100 text-gray-600 text-[10px] font-mono">
                        {locale.code}
                      </Badge>
                      {locale.rtl && (
                        <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                          RTL
                        </Badge>
                      )}
                      {locale.active && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </div>
                    {locale.nativeName && (
                      <p className="text-xs text-[#5D7086] mt-1">
                        Native: {locale.nativeName}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sample Translations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Recent Translations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(translations.data ?? []).length === 0 ? (
            <div className="text-center py-8 text-[#5D7086]">
              <Languages className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No translations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(translations.data ?? []).map((t: any) => (
                <div
                  key={t.key}
                  className="flex items-center gap-3 rounded-lg border border-[#E7F4F0] p-3"
                >
                  <code className="text-xs font-mono text-[#138A73] shrink-0 w-40 truncate">
                    {t.key}
                  </code>
                  <span className="text-sm text-[#1B355E] truncate flex-1">
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B355E]">Add Locale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">
                  Locale Code
                </Label>
                <Input
                  value={newLocale.code}
                  onChange={(e) =>
                    setNewLocale((p) => ({ ...p, code: e.target.value }))
                  }
                  placeholder="ur"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">
                  Language Name
                </Label>
                <Input
                  value={newLocale.name}
                  onChange={(e) =>
                    setNewLocale((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Urdu"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Native Name
              </Label>
              <Input
                value={newLocale.nativeName}
                onChange={(e) =>
                  setNewLocale((p) => ({
                    ...p,
                    nativeName: e.target.value,
                  }))
                }
                placeholder="اردو"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newLocale.rtl}
                onCheckedChange={(v) =>
                  setNewLocale((p) => ({ ...p, rtl: v }))
                }
              />
              <Label className="text-sm">Right-to-left (RTL)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={!newLocale.code || !newLocale.name}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              Add Locale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
