import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Eye, Edit2, Trash2, Award, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Position {
  id: number;
  title: string;
  organization: string;
  startDate: string;
  endDate: string;
  description: string;
  isCurrent: boolean;
}

interface CVData {
  fullName: string;
  email: string;
  phone: string;
  summary: string;
}

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toDateOrUndefined(value: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

export default function CVMaker() {
  const profileQuery = trpc.member.getProfile.useQuery();
  const entriesQuery = trpc.cvMaker.getEntries.useQuery();

  const addEntry = trpc.cvMaker.addEntry.useMutation({
    onSuccess: () => {
      toast.success("Position added");
      entriesQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Could not add position."),
  });
  const updateEntry = trpc.cvMaker.updateEntry.useMutation({
    onSuccess: () => {
      toast.success("Position updated");
      entriesQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Could not update position."),
  });
  const deleteEntry = trpc.cvMaker.deleteEntry.useMutation({
    onSuccess: () => {
      toast.success("Position removed");
      entriesQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Could not remove position."),
  });

  const [cvData, setCVData] = useState<CVData>({
    fullName: "",
    email: "",
    phone: "",
    summary: "",
  });

  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setCVData((prev) => ({
      ...prev,
      fullName: p.name ?? prev.fullName,
      email: p.email ?? prev.email,
      phone: p.phone ?? prev.phone,
    }));
  }, [profileQuery.data]);

  const positions: Position[] = (entriesQuery.data ?? []).map((entry) => ({
    id: entry.id,
    title: entry.title,
    organization: entry.organization ?? "",
    startDate: toDateInput(entry.startDate),
    endDate: toDateInput(entry.endDate),
    description: entry.description ?? "",
    isCurrent: Boolean(entry.isCurrent),
  }));

  const handleAddPosition = (position: Position) => {
    const payload = {
      type: "Position" as const,
      title: position.title,
      organization: position.organization || undefined,
      description: position.description || undefined,
      startDate: toDateOrUndefined(position.startDate),
      endDate: position.isCurrent ? undefined : toDateOrUndefined(position.endDate),
      isCurrent: position.isCurrent,
    };
    if (position.id > 0) {
      updateEntry.mutate({ entryId: position.id, ...payload });
      setEditingPosition(null);
    } else {
      addEntry.mutate(payload);
    }
    setShowForm(false);
  };

  const handleDeletePosition = (id: number) => {
    deleteEntry.mutate({ entryId: id });
  };

  const handleDownloadCV = () => {
    if (!cvData.fullName) {
      toast.error("Add your name before downloading your CV.");
      return;
    }
    toast.success("CV downloaded successfully!");
  };

  const currentPositions = positions.filter((p) => p.isCurrent);
  const pastPositions = positions.filter((p) => !p.isCurrent);

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Career toolkit
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            MSAP CV Maker
          </h1>
          <p className="mt-2 text-[#66788D]">
            Build and manage your professional CV with MSAP position history
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* CV Editor */}
          <div className="space-y-6 lg:col-span-2">
            {/* Personal Information */}
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                    Full Name
                  </label>
                  <Input
                    placeholder="Your full name"
                    value={cvData.fullName}
                    onChange={(e) => setCVData((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Email</label>
                    <Input
                      type="email"
                      placeholder="your.email@example.com"
                      value={cvData.email}
                      onChange={(e) => setCVData((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Phone</label>
                    <Input
                      placeholder="+92 300 1234567"
                      value={cvData.phone}
                      onChange={(e) => setCVData((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                    Professional Summary
                  </label>
                  <Textarea
                    placeholder="Brief overview of your professional background and goals..."
                    value={cvData.summary}
                    onChange={(e) => setCVData((prev) => ({ ...prev, summary: e.target.value }))}
                    className="min-h-24"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Position History */}
            <Card className="msap-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-[#1B355E]">Position History</CardTitle>
                  <CardDescription>Track your MSAP positions and roles</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingPosition(null);
                    setShowForm(!showForm);
                  }}
                  className="msap-primary-action text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Position
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showForm && (
                  <PositionForm
                    initialData={editingPosition}
                    onSubmit={handleAddPosition}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingPosition(null);
                    }}
                    isSaving={addEntry.isPending || updateEntry.isPending}
                  />
                )}

                {entriesQuery.isLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#138A73]" />
                    <p className="text-sm text-[#66788D]">Loading your positions...</p>
                  </div>
                ) : currentPositions.length > 0 ? (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#106E5B]">
                      <Award className="h-4 w-4" />
                      Current Positions
                    </h3>
                    <div className="space-y-3">
                      {currentPositions.map((position) => (
                        <PositionCard
                          key={position.id}
                          position={position}
                          onEdit={() => {
                            setEditingPosition(position);
                            setShowForm(true);
                          }}
                          onDelete={() => handleDeletePosition(position.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {pastPositions.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-[#66788D]">Past Positions</h3>
                    <div className="space-y-3">
                      {pastPositions.map((position) => (
                        <PositionCard
                          key={position.id}
                          position={position}
                          onEdit={() => {
                            setEditingPosition(position);
                            setShowForm(true);
                          }}
                          onDelete={() => handleDeletePosition(position.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!entriesQuery.isLoading && positions.length === 0 && !showForm && (
                  <div className="py-8 text-center text-[#66788D]">
                    <Award className="mx-auto mb-3 h-12 w-12 opacity-40" />
                    <p>No positions added yet. Start by adding your first position.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CV Preview & Actions */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card className="msap-card sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E]">CV Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-xl border border-[#D9E4E1] bg-[#F6F9F8] p-4 text-sm">
                  <div>
                    <p className="font-bold text-[#1B355E]">{cvData.fullName || "Your Name"}</p>
                    <p className="text-xs text-[#66788D]">{cvData.email || "email@example.com"}</p>
                    <p className="text-xs text-[#66788D]">{cvData.phone || "+92 300 1234567"}</p>
                  </div>

                  {cvData.summary && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-[#106E5B]">SUMMARY</p>
                      <p className="line-clamp-3 text-xs text-[#5D7086]">{cvData.summary}</p>
                    </div>
                  )}

                  {positions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#106E5B]">EXPERIENCE</p>
                      <div className="space-y-2">
                        {positions.slice(0, 3).map((pos) => (
                          <div key={pos.id} className="text-xs">
                            <p className="font-semibold text-[#1B355E]">{pos.title}</p>
                            <p className="text-[#66788D]">{pos.organization}</p>
                          </div>
                        ))}
                        {positions.length > 3 && (
                          <p className="text-xs italic text-[#8A9BAE]">
                            +{positions.length - 3} more...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleDownloadCV}
                    disabled={!cvData.fullName}
                    className="msap-primary-action w-full text-white disabled:opacity-50"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CV (PDF)
                  </Button>
                  <Button variant="outline" className="msap-btn-outline w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="msap-card bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)]">
              <CardHeader>
                <CardTitle className="text-sm text-[#1B355E]">Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#42566E]">
                <p>• Keep your summary concise and impactful</p>
                <p>• List positions in reverse chronological order</p>
                <p>• Include key achievements and responsibilities</p>
                <p>• Use professional language and formatting</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionForm({
  initialData,
  onSubmit,
  onCancel,
  isSaving,
}: {
  initialData: Position | null;
  onSubmit: (position: Position) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<Position>(
    initialData || {
      id: 0,
      title: "",
      organization: "",
      startDate: "",
      endDate: "",
      description: "",
      isCurrent: false,
    }
  );

  return (
    <Card className="border-[#D9E4E1] bg-[#F6F9F8]">
      <CardContent className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1B355E]">
            Position Title *
          </label>
          <Input
            placeholder="e.g., LC President"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="h-10 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1B355E]">
            Organization *
          </label>
          <Input
            placeholder="e.g., MSAP Karachi"
            value={formData.organization}
            onChange={(e) => setFormData((prev) => ({ ...prev, organization: e.target.value }))}
            className="h-10 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Start Date</label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#1B355E]">End Date</label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
              disabled={formData.isCurrent}
              className="h-10 text-sm disabled:opacity-50"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1B355E]">
          <input
            type="checkbox"
            checked={formData.isCurrent}
            onChange={(e) => setFormData((prev) => ({ ...prev, isCurrent: e.target.checked }))}
            className="h-4 w-4 accent-[#106E5B]"
          />
          Currently in this position
        </label>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Description</label>
          <Textarea
            placeholder="Describe your responsibilities and achievements..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-20 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onSubmit(formData)}
            disabled={!formData.title || !formData.organization || isSaving}
            className="msap-primary-action flex-1 text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : initialData ? "Update" : "Add"} Position
          </Button>
          <Button onClick={onCancel} variant="outline" className="msap-btn-outline flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionCard({
  position,
  onEdit,
  onDelete,
}: {
  position: Position;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startLabel = position.startDate
    ? new Date(position.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";
  const endLabel = position.isCurrent
    ? "Present"
    : position.endDate
      ? new Date(position.endDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : "";

  return (
    <div className="space-y-2 rounded-xl border border-[#D9E4E1] bg-white p-3 shadow-[0_10px_26px_-20px_rgba(27,53,94,.4)]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-semibold text-[#1B355E]">{position.title}</p>
          <p className="text-sm text-[#66788D]">{position.organization}</p>
          {(startLabel || endLabel) && (
            <p className="text-xs text-[#8A9BAE]">
              {[startLabel, endLabel].filter(Boolean).join(" – ")}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded p-1 text-[#106E5B] hover:bg-[#E7F4F0]">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {position.description && (
        <p className="text-sm text-[#5D7086]">{position.description}</p>
      )}
    </div>
  );
}
