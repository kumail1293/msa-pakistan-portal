import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Settings,
  Save,
  RotateCcw,
  Palette,
  Mail,
  Globe,
  Shield,
  Users,
  Zap,
  FileText,
} from "lucide-react";

export default function AdminConfig() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);

  // ── Configuration Queries ─────────────────────────────────────────
  const configQuery = trpc.admin.getConfiguration.useQuery({});
  const brandingQuery = trpc.admin.getBranding.useQuery();
  const emailBrandingQuery = trpc.admin.getEmailBranding.useQuery();
  const definitionsQuery = trpc.admin.getConfigDefinitions.useQuery();

  // ── Mutations ─────────────────────────────────────────────────────
  const updateConfig = trpc.admin.updateConfiguration.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved!");
      configQuery.refetch();
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  const updateBranding = trpc.admin.updateBranding.useMutation({
    onSuccess: () => {
      toast.success("Branding updated!");
      brandingQuery.refetch();
    },
    onError: () => toast.error("Failed to update branding"),
  });

  const updateEmailBranding = trpc.admin.updateEmailBranding.useMutation({
    onSuccess: () => {
      toast.success("Email branding updated!");
      emailBrandingQuery.refetch();
    },
    onError: () => toast.error("Failed to update email branding"),
  });

  const seedDefaults = trpc.enterprise.seedDefaults.useMutation({
    onSuccess: () => {
      toast.success("Defaults seeded successfully!");
      configQuery.refetch();
      brandingQuery.refetch();
      emailBrandingQuery.refetch();
      definitionsQuery.refetch();
    },
    onError: () => toast.error("Failed to seed defaults"),
  });

  const invalidateCaches = trpc.enterprise.invalidateCaches.useMutation({
    onSuccess: () => toast.success("All caches invalidated!"),
    onError: () => toast.error("Failed to invalidate caches"),
  });

  // ── Local State ───────────────────────────────────────────────────
  const [brandingForm, setBrandingForm] = useState<Record<string, string>>({});
  const [emailForm, setEmailForm] = useState<Record<string, string>>({});
  const [configForm, setConfigForm] = useState<Record<string, string>>({});

  // Initialize branding form from query
  useEffect(() => {
    if (brandingQuery.data) {
      const b = brandingQuery.data;
      setBrandingForm({
        orgName: b.orgName || "",
        orgFullName: b.orgFullName || "",
        orgShortName: b.orgShortName || "",
        orgEmail: b.orgEmail || "",
        orgWebsite: b.orgWebsite || "",
        presidentName: b.presidentName || "",
        presidentTitle: b.presidentTitle || "",
        primaryColor: b.primaryColor || "",
        secondaryColor: b.secondaryColor || "",
        accentColor: b.accentColor || "",
      });
    }
  }, [brandingQuery.data]);

  // Initialize email form
  useEffect(() => {
    if (emailBrandingQuery.data) {
      const e = emailBrandingQuery.data;
      setEmailForm({
        senderName: e.senderName || "",
        senderEmail: e.senderEmail || "",
        supportEmail: e.supportEmail || "",
        headerBgColor: e.headerBgColor || "",
        footerText: e.footerText || "",
      });
    }
  }, [emailBrandingQuery.data]);

  // ── Auth Guard ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !canAccessModule(user, "config")) {
    navigate("/official");
    return null;
  }

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await updateBranding.mutateAsync(brandingForm);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmailBranding = async () => {
    setSaving(true);
    try {
      await updateEmailBranding.mutateAsync(emailForm);
    } finally {
      setSaving(false);
    }
  };

  // ── Grouped Config ────────────────────────────────────────────────
  const configs = configQuery.data || [];
  const grouped = configs.reduce(
    (acc: Record<string, typeof configs>, item: (typeof configs)[number]) => {
      const cat = item.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, typeof configs>
  );

  // ── Color Picker Helper ──────────────────────────────────────────
  const ColorField = ({
    label,
    field,
    form,
    setForm,
  }: {
    label: string;
    field: string;
    form: Record<string, string>;
    setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }) => (
    <div className="flex items-center gap-3">
      <div
        className="h-8 w-8 rounded-lg border border-[#D9E4E1] shadow-inner"
        style={{ backgroundColor: form[field] || "#1B355E" }}
      />
      <div className="flex-1">
        <Label className="text-xs text-[#66788D]">{label}</Label>
        <Input
          value={form[field] || ""}
          onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder="#000000"
          className="mt-1 font-mono text-sm"
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <Settings className="h-8 w-8 text-[#106E5B]" />
              Enterprise Configuration
            </h1>
            <p className="text-[#66788D]">
              Manage branding, configuration, and system settings
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedDefaults.mutateAsync()}
              disabled={seedDefaults.isPending}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {seedDefaults.isPending ? "Seeding..." : "Seed Defaults"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => invalidateCaches.mutateAsync()}
              disabled={invalidateCaches.isPending}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Clear Caches
            </Button>
          </div>
        </div>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="bg-white border border-[#D9E4E1] p-1">
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" /> Branding
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ── Branding Tab ─────────────────────────────────────── */}
          <TabsContent value="branding">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                  <Palette className="h-5 w-5" /> Organization Branding
                </CardTitle>
                <CardDescription>
                  Configure the organization's public identity, colors, and leadership
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Organization Name</Label>
                    <Input
                      value={brandingForm.orgName || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, orgName: e.target.value }))}
                      placeholder="MSA Pakistan"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Short Name</Label>
                    <Input
                      value={brandingForm.orgShortName || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, orgShortName: e.target.value }))}
                      placeholder="MSAP"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-[#66788D]">Full Name</Label>
                    <Input
                      value={brandingForm.orgFullName || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, orgFullName: e.target.value }))}
                      placeholder="Medical Students' Association of Pakistan"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Contact Email</Label>
                    <Input
                      type="email"
                      value={brandingForm.orgEmail || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, orgEmail: e.target.value }))}
                      placeholder="contact@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Website</Label>
                    <Input
                      value={brandingForm.orgWebsite || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, orgWebsite: e.target.value }))}
                      placeholder="https://example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">President Name</Label>
                    <Input
                      value={brandingForm.presidentName || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, presidentName: e.target.value }))}
                      placeholder="Kumail Danial"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">President Title</Label>
                    <Input
                      value={brandingForm.presidentTitle || ""}
                      onChange={(e) => setBrandingForm((p) => ({ ...p, presidentTitle: e.target.value }))}
                      placeholder="National President"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="border-t border-[#E7F4F0] pt-4">
                  <Label className="text-sm font-semibold text-[#1B355E] mb-3 block">Brand Colors</Label>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ColorField label="Primary" field="primaryColor" form={brandingForm} setForm={setBrandingForm} />
                    <ColorField label="Secondary" field="secondaryColor" form={brandingForm} setForm={setBrandingForm} />
                    <ColorField label="Accent" field="accentColor" form={brandingForm} setForm={setBrandingForm} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving || updateBranding.isPending}
                    className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Branding"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Email Tab ────────────────────────────────────────── */}
          <TabsContent value="email">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                  <Mail className="h-5 w-5" /> Email Branding
                </CardTitle>
                <CardDescription>
                  Configure email sender identity, header color, and footer text
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Sender Name</Label>
                    <Input
                      value={emailForm.senderName || ""}
                      onChange={(e) => setEmailForm((p) => ({ ...p, senderName: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Sender Email</Label>
                    <Input
                      type="email"
                      value={emailForm.senderEmail || ""}
                      onChange={(e) => setEmailForm((p) => ({ ...p, senderEmail: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Support Email</Label>
                    <Input
                      type="email"
                      value={emailForm.supportEmail || ""}
                      onChange={(e) => setEmailForm((p) => ({ ...p, supportEmail: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#66788D]">Header Background Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="h-8 w-8 rounded border border-[#D9E4E1]"
                        style={{ backgroundColor: emailForm.headerBgColor || "#1B355E" }}
                      />
                      <Input
                        value={emailForm.headerBgColor || ""}
                        onChange={(e) => setEmailForm((p) => ({ ...p, headerBgColor: e.target.value }))}
                        placeholder="#1B355E"
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#66788D]">Footer Text</Label>
                  <Textarea
                    value={emailForm.footerText || ""}
                    onChange={(e) => setEmailForm((p) => ({ ...p, footerText: e.target.value }))}
                    placeholder="Best regards,<br/>Team Name"
                    className="mt-1 font-mono text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveEmailBranding}
                    disabled={saving || updateEmailBranding.isPending}
                    className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Email Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── General Settings Tab ─────────────────────────────── */}
          <TabsContent value="general">
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => (
                <Card key={category} className="card-cinematic">
                  <CardHeader>
                    <CardTitle className="text-lg text-[#1B355E] capitalize">{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {items.map((item: any) => (
                        <div key={item.key} className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-center">
                          <div>
                            <Label className="text-xs font-semibold text-[#1B355E]">{item.key}</Label>
                            <p className="text-[10px] text-[#8A9BAE]">{item.category}</p>
                          </div>
                          <Input
                            defaultValue={item.value || ""}
                            onBlur={async (e) => {
                              if (e.target.value !== item.value) {
                                await updateConfig.mutateAsync({
                                  key: item.key,
                                  value: e.target.value,
                                  category: item.category || undefined,
                                });
                              }
                            }}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {Object.keys(grouped).length === 0 && !configQuery.isLoading && (
                <Card className="card-cinematic">
                  <CardContent className="py-12 text-center text-[#8A9BAE]">
                    <Settings className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No configuration entries found.</p>
                    <p className="text-sm mt-1">Click "Seed Defaults" to populate default settings.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
