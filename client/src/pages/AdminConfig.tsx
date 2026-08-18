import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Settings, Save, RotateCcw } from "lucide-react";

export default function AdminConfig() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);

  const configQuery = { data: [] }; // TODO: Implement
  const setConfig = { mutateAsync: async () => ({}) }; // TODO: Implement

  const [formData, setFormData] = useState<Record<string, string>>({});

  // Wait for the session before deciding access — otherwise the first render
  // (user still undefined) redirects admins to "/".
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  if (!user || !canAccessModule(user, "config")) {
    navigate("/official");
    return null;
  }

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(formData)) {
        if (value) {
          await (setConfig.mutateAsync as any)({
            key,
            value,
          });
        }
      }
      toast.success("Configuration saved successfully!");
      setFormData({});
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({});
  };

  const configItems = configQuery.data || [];
  const groupedConfig = configItems.reduce(
    (acc: any, item: any) => {
      const category = item.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, typeof configItems>
  );

  return (
    <div className="py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-[#106E5B]" />
            System Configuration
          </h1>
          <p className="text-[#66788D]">Manage all system settings and configuration parameters</p>
        </div>

        {/* Configuration Sections */}
        <div className="space-y-6">
          {Object.entries(groupedConfig).map(([category, items]: any) => (
            <Card key={category} className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E]">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {items.map((item: any) => (
                  <ConfigField
                    key={item.key}
                    config={item}
                    value={formData[item.key] || item.value}
                    onChange={(value) => handleInputChange(item.key, value)}
                  />
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Email Configuration */}
          <Card className="card-cinematic">
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Email Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConfigField
                config={{
                  key: "SMTP_HOST",
                  value: formData["SMTP_HOST"] || "",
                  description: "SMTP server hostname",
                  dataType: "string",
                }}
                value={formData["SMTP_HOST"] || ""}
                onChange={(value) => handleInputChange("SMTP_HOST", value)}
              />
              <ConfigField
                config={{
                  key: "SMTP_PORT",
                  value: formData["SMTP_PORT"] || "",
                  description: "SMTP server port",
                  dataType: "number",
                }}
                value={formData["SMTP_PORT"] || ""}
                onChange={(value) => handleInputChange("SMTP_PORT", value)}
              />
              <ConfigField
                config={{
                  key: "SMTP_USER",
                  value: formData["SMTP_USER"] || "",
                  description: "SMTP username",
                  dataType: "string",
                  isSecret: true,
                }}
                value={formData["SMTP_USER"] || ""}
                onChange={(value) => handleInputChange("SMTP_USER", value)}
              />
              <ConfigField
                config={{
                  key: "SMTP_PASSWORD",
                  value: formData["SMTP_PASSWORD"] || "",
                  description: "SMTP password",
                  dataType: "string",
                  isSecret: true,
                }}
                value={formData["SMTP_PASSWORD"] || ""}
                onChange={(value) => handleInputChange("SMTP_PASSWORD", value)}
              />
              <ConfigField
                config={{
                  key: "FROM_EMAIL",
                  value: formData["FROM_EMAIL"] || "",
                  description: "Default sender email address",
                  dataType: "string",
                }}
                value={formData["FROM_EMAIL"] || ""}
                onChange={(value) => handleInputChange("FROM_EMAIL", value)}
              />
            </CardContent>
          </Card>

          {/* Recruitment Settings */}
          <Card className="card-cinematic">
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Recruitment Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConfigField
                config={{
                  key: "MAX_APPLICATIONS_PER_CANDIDATE",
                  value: formData["MAX_APPLICATIONS_PER_CANDIDATE"] || "",
                  description: "Maximum applications per candidate",
                  dataType: "number",
                }}
                value={formData["MAX_APPLICATIONS_PER_CANDIDATE"] || ""}
                onChange={(value) => handleInputChange("MAX_APPLICATIONS_PER_CANDIDATE", value)}
              />
              <ConfigField
                config={{
                  key: "INTERVIEW_REMINDER_DAYS",
                  value: formData["INTERVIEW_REMINDER_DAYS"] || "",
                  description: "Days before interview to send reminder",
                  dataType: "number",
                }}
                value={formData["INTERVIEW_REMINDER_DAYS"] || ""}
                onChange={(value) => handleInputChange("INTERVIEW_REMINDER_DAYS", value)}
              />
              <ConfigField
                config={{
                  key: "EMAIL_RETRY_ATTEMPTS",
                  value: formData["EMAIL_RETRY_ATTEMPTS"] || "3",
                  description: "Maximum email retry attempts",
                  dataType: "number",
                }}
                value={formData["EMAIL_RETRY_ATTEMPTS"] || "3"}
                onChange={(value) => handleInputChange("EMAIL_RETRY_ATTEMPTS", value)}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <Button className="btn-primary flex-1" onClick={handleSave} disabled={saving || Object.keys(formData).length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
              disabled={Object.keys(formData).length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Changes are applied immediately after saving. Some changes may require a server restart.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfigField({
  config,
  value,
  onChange,
}: {
  config: any;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={config.key} className="text-foreground font-semibold">
        {config.key}
        {config.isSecret && <span className="text-destructive ml-2">*</span>}
      </Label>
      {config.description && <p className="text-xs text-muted-foreground">{config.description}</p>}

      {config.dataType === "number" ? (
        <Input
          id={config.key}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-cinematic"
          placeholder={config.value}
        />
      ) : config.dataType === "boolean" ? (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={config.key}
              value="true"
              checked={value === "true"}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm text-foreground">Enabled</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={config.key}
              value="false"
              checked={value === "false"}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm text-foreground">Disabled</span>
          </label>
        </div>
      ) : config.dataType === "json" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-cinematic font-mono text-xs min-h-24"
          placeholder={config.value}
        />
      ) : (
        <Input
          id={config.key}
          type={config.isSecret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-cinematic"
          placeholder={config.value}
        />
      )}
    </div>
  );
}
