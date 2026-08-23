import { useState, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, Building2, CalendarDays, BookOpen, FolderKanban,
  Download, Upload, Save, Plus, Trash2, Edit2, Check, X,
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Copy, ClipboardPaste, Undo2, RefreshCw, FileSpreadsheet,
  AlertTriangle, CheckCircle, Columns3, Rows3, Settings,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Entity Configurations
// ============================================================================

interface EntityConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  columns: ColumnDef[];
  data: Record<string, unknown>[];
}

interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "email" | "phone" | "checkbox";
  editable: boolean;
  options?: string[];
  width?: number;
}

// ============================================================================
// Sample Data
// ============================================================================

const MEMBERS_DATA: Record<string, unknown>[] = [
  { id: 1, membershipId: "MSAP-2024001", name: "Ahmed Khan", email: "ahmed.khan@edu.pk", phone: "+92 300 1234567", localCouncil: "KEMU LC", discipline: "MBBS", yearOfStudy: "3rd Year", status: "Active", joinDate: "2024-08-15" },
  { id: 2, membershipId: "MSAP-2024002", name: "Fatima Malik", email: "fatima.malik@edu.pk", phone: "+92 301 2345678", localCouncil: "AKU LC", discipline: "MBBS", yearOfStudy: "Final Year", status: "Active", joinDate: "2024-08-20" },
  { id: 3, membershipId: "MSAP-2024003", name: "Hussein Rao", email: "hussein.rao@edu.pk", phone: "+92 302 3456789", localCouncil: "DUHS LC", discipline: "BDS", yearOfStudy: "4th Year", status: "Active", joinDate: "2024-09-01" },
  { id: 4, membershipId: "MSAP-2024004", name: "Ayesha Qureshi", email: "ayesha.q@edu.pk", phone: "+92 303 4567890", localCouncil: "AIMC LC", discipline: "MBBS", yearOfStudy: "2nd Year", status: "Active", joinDate: "2024-09-10" },
  { id: 5, membershipId: "MSAP-2024005", name: "Omar Baig", email: "omar.baig@edu.pk", phone: "+92 304 5678901", localCouncil: "PMC LC", discipline: "Pharm-D", yearOfStudy: "3rd Year", status: "Pending", joinDate: "2024-10-01" },
  { id: 6, membershipId: "MSAP-2024006", name: "Sana Siddiqui", email: "sana.s@edu.pk", phone: "+92 305 6789012", localCouncil: "NMU LC", discipline: "MBBS", yearOfStudy: "Final Year", status: "Active", joinDate: "2024-10-15" },
  { id: 7, membershipId: "MSAP-2024007", name: "Ali Chaudhry", email: "ali.c@edu.pk", phone: "+92 306 7890123", localCouncil: "RMU LC", discipline: "MBBS", yearOfStudy: "Intern", status: "Active", joinDate: "2024-11-01" },
  { id: 8, membershipId: "MSAP-2024008", name: "Noor Hussain", email: "noor.h@edu.pk", phone: "+92 307 8901234", localCouncil: "SIMS LC", discipline: "DPT", yearOfStudy: "1st Year", status: "Active", joinDate: "2024-11-15" },
  { id: 9, membershipId: "MSAP-2024009", name: "Bilal Butt", email: "bilal.b@edu.pk", phone: "+92 308 9012345", localCouncil: "KEMU LC", discipline: "MBBS", yearOfStudy: "2nd Year", status: "Inactive", joinDate: "2024-12-01" },
  { id: 10, membershipId: "MSAP-2024010", name: "Zainab Shah", email: "zainab.s@edu.pk", phone: "+92 309 0123456", localCouncil: "AKU LC", discipline: "BSc Nursing", yearOfStudy: "4th Year", status: "Active", joinDate: "2024-12-15" },
  { id: 11, membershipId: "MSAP-2024011", name: "Usman Cheema", email: "usman.c@edu.pk", phone: "+92 310 1234567", localCouncil: "PMC LC", discipline: "MBBS", yearOfStudy: "3rd Year", status: "Active", joinDate: "2025-01-05" },
  { id: 12, membershipId: "MSAP-2024012", name: "Maryam Javed", email: "maryam.j@edu.pk", phone: "+92 311 2345678", localCouncil: "AIMC LC", discipline: "MBBS", yearOfStudy: "Final Year", status: "Active", joinDate: "2025-01-20" },
];

const LC_DATA: Record<string, unknown>[] = [
  { id: 1, name: "MSA-Pakistan KEMU LC", shortCode: "KEMU-LC", city: "Lahore", region: "Punjab Central", type: "permanent", memberCount: 280, status: "Active", president: "Ahmed Khan" },
  { id: 2, name: "MSA-Pakistan AKU LC", shortCode: "AKU-LC", city: "Karachi", region: "Sindh Urban", type: "permanent", memberCount: 195, status: "Active", president: "Fatima Malik" },
  { id: 3, name: "MSA-Pakistan DUHS LC", shortCode: "DUHS-LC", city: "Karachi", region: "Sindh Urban", type: "permanent", memberCount: 320, status: "Active", president: "Hussein Rao" },
  { id: 4, name: "MSA-Pakistan AIMC LC", shortCode: "AIMC-LC", city: "Lahore", region: "Punjab Central", type: "permanent", memberCount: 150, status: "Active", president: "Ayesha Qureshi" },
  { id: 5, name: "MSA-Pakistan PMC LC", shortCode: "PMC-LC", city: "Faisalabad", region: "Punjab South", type: "permanent", memberCount: 175, status: "Active", president: "Omar Baig" },
  { id: 6, name: "MSA-Pakistan NMU LC", shortCode: "NMU-LC", city: "Multan", region: "Punjab South", type: "permanent", memberCount: 140, status: "Active", president: "Sana Siddiqui" },
  { id: 7, name: "MSA-Pakistan RMU LC", shortCode: "RMU-LC", city: "Rawalpindi", region: "Punjab North", type: "permanent", memberCount: 165, status: "Active", president: "Ali Chaudhry" },
  { id: 8, name: "MSA-Pakistan SIMS LC", shortCode: "SIMS-LC", city: "Lahore", region: "Punjab Central", type: "permanent", memberCount: 130, status: "Active", president: "Noor Hussain" },
  { id: 9, name: "MSA-Pakistan Punjab Region", shortCode: "PUNJAB-R", city: "Lahore", region: "Punjab", type: "regional", memberCount: 1200, status: "Active", president: "Bilal Butt" },
  { id: 10, name: "MSA-Pakistan Sindh Region", shortCode: "SINDH-R", city: "Karachi", region: "Sindh", type: "regional", memberCount: 700, status: "Active", president: "Zainab Shah" },
  { id: 11, name: "SC Health Policy", shortCode: "SC-HPA", city: "Islamabad", region: "National", type: "standing_committee", memberCount: 25, status: "Active", president: "Usman Cheema" },
  { id: 12, name: "SC Medical Education", shortCode: "SC-ME", city: "Lahore", region: "National", type: "standing_committee", memberCount: 20, status: "Active", president: "Maryam Javed" },
];

const ACTIVITIES_DATA: Record<string, unknown>[] = [
  { id: 1, title: "Community Health Screening", type: "health_camp", city: "Lahore", status: "active", participants: 45, startDate: "2026-03-15", budget: 50000 },
  { id: 2, title: "Medical Ethics Workshop", type: "workshop", city: "Karachi", status: "active", participants: 80, startDate: "2026-03-20", budget: 25000 },
  { id: 3, title: "Blood Donation Drive", type: "blood_donation", city: "Islamabad", status: "active", participants: 120, startDate: "2026-04-01", budget: 30000 },
  { id: 4, title: "First Aid Training", type: "training", city: "Peshawar", status: "active", participants: 200, startDate: "2026-04-05", budget: 45000 },
  { id: 5, title: "Mental Health Awareness", type: "awareness", city: "Multan", status: "active", participants: 150, startDate: "2026-04-10", budget: 35000 },
  { id: 6, title: "Research Methodology", type: "seminar", city: "Faisalabad", status: "active", participants: 90, startDate: "2026-04-15", budget: 20000 },
];

const EVENTS_DATA: Record<string, unknown>[] = [
  { id: 1, title: "National Conference 2026", type: "conference", city: "Islamabad", status: "upcoming", registrations: 350, startDate: "2026-06-15" },
  { id: 2, title: "Inter-University Quiz", type: "competition", city: "Lahore", status: "upcoming", registrations: 120, startDate: "2026-05-20" },
  { id: 3, title: "Leadership Summit", type: "summit", city: "Karachi", status: "upcoming", registrations: 80, startDate: "2026-05-10" },
  { id: 4, title: "World Health Day", type: "observance", city: "All Cities", status: "upcoming", registrations: 500, startDate: "2026-04-07" },
];

const COURSES_DATA: Record<string, unknown>[] = [
  { id: 1, title: "Evidence-Based Medicine", category: "Research", enrolled: 234, status: "published", duration: "6 weeks" },
  { id: 2, title: "Leadership in Healthcare", category: "Leadership", enrolled: 189, status: "published", duration: "8 weeks" },
  { id: 3, title: "Medical Research Ethics", category: "Ethics", enrolled: 312, status: "published", duration: "4 weeks" },
  { id: 4, title: "Clinical Communication", category: "Clinical", enrolled: 456, status: "published", duration: "5 weeks" },
];

// ============================================================================
// Entity Configs
// ============================================================================

const ENTITY_CONFIGS: EntityConfig[] = [
  {
    key: "members", label: "Members", icon: <Users className="h-4 w-4" />, color: "text-[#138A73]",
    columns: [
      { key: "membershipId", label: "Membership ID", type: "text", editable: false, width: 130 },
      { key: "name", label: "Full Name", type: "text", editable: true, width: 160 },
      { key: "email", label: "Email", type: "email", editable: true, width: 180 },
      { key: "phone", label: "Phone", type: "phone", editable: true, width: 140 },
      { key: "localCouncil", label: "Local Council", type: "select", editable: true, width: 140, options: ["KEMU LC", "AKU LC", "DUHS LC", "AIMC LC", "PMC LC", "NMU LC", "RMU LC", "SIMS LC"] },
      { key: "discipline", label: "Discipline", type: "select", editable: true, width: 100, options: ["MBBS", "BDS", "BSc Nursing", "Pharm-D", "DPT"] },
      { key: "yearOfStudy", label: "Year", type: "select", editable: true, width: 100, options: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year", "Intern"] },
      { key: "status", label: "Status", type: "select", editable: true, width: 90, options: ["Active", "Pending", "Inactive", "Suspended"] },
      { key: "joinDate", label: "Join Date", type: "date", editable: false, width: 110 },
    ],
    data: MEMBERS_DATA,
  },
  {
    key: "local_councils", label: "Local Councils", icon: <Building2 className="h-4 w-4" />, color: "text-blue-500",
    columns: [
      { key: "name", label: "LC Name", type: "text", editable: true, width: 200 },
      { key: "shortCode", label: "Code", type: "text", editable: true, width: 100 },
      { key: "city", label: "City", type: "text", editable: true, width: 100 },
      { key: "region", label: "Region", type: "text", editable: true, width: 120 },
      { key: "type", label: "Type", type: "select", editable: true, width: 130, options: ["permanent", "temporary", "regional", "standing_committee"] },
      { key: "memberCount", label: "Members", type: "number", editable: true, width: 80 },
      { key: "status", label: "Status", type: "select", editable: true, width: 90, options: ["Active", "Inactive", "Suspended"] },
      { key: "president", label: "President", type: "text", editable: true, width: 140 },
    ],
    data: LC_DATA,
  },
  {
    key: "activities", label: "Activities", icon: <CalendarDays className="h-4 w-4" />, color: "text-amber-500",
    columns: [
      { key: "title", label: "Title", type: "text", editable: true, width: 200 },
      { key: "type", label: "Type", type: "select", editable: true, width: 130, options: ["health_camp", "workshop", "blood_donation", "training", "awareness", "seminar"] },
      { key: "city", label: "City", type: "text", editable: true, width: 100 },
      { key: "status", label: "Status", type: "select", editable: true, width: 90, options: ["active", "completed", "cancelled"] },
      { key: "participants", label: "Participants", type: "number", editable: true, width: 100 },
      { key: "startDate", label: "Start Date", type: "date", editable: true, width: 110 },
      { key: "budget", label: "Budget (PKR)", type: "number", editable: true, width: 110 },
    ],
    data: ACTIVITIES_DATA,
  },
  {
    key: "events", label: "Events", icon: <CalendarDays className="h-4 w-4" />, color: "text-violet-500",
    columns: [
      { key: "title", label: "Title", type: "text", editable: true, width: 200 },
      { key: "type", label: "Type", type: "select", editable: true, width: 130, options: ["conference", "competition", "summit", "observance", "academic"] },
      { key: "city", label: "City", type: "text", editable: true, width: 100 },
      { key: "status", label: "Status", type: "select", editable: true, width: 90, options: ["upcoming", "ongoing", "completed", "cancelled"] },
      { key: "registrations", label: "Registrations", type: "number", editable: true, width: 110 },
      { key: "startDate", label: "Start Date", type: "date", editable: true, width: 110 },
    ],
    data: EVENTS_DATA,
  },
  {
    key: "courses", label: "Training Courses", icon: <BookOpen className="h-4 w-4" />, color: "text-emerald-500",
    columns: [
      { key: "title", label: "Course Title", type: "text", editable: true, width: 200 },
      { key: "category", label: "Category", type: "select", editable: true, width: 120, options: ["Research", "Leadership", "Ethics", "Clinical", "Public Health", "Emergency"] },
      { key: "enrolled", label: "Enrolled", type: "number", editable: true, width: 90 },
      { key: "status", label: "Status", type: "select", editable: true, width: 90, options: ["published", "draft", "archived"] },
      { key: "duration", label: "Duration", type: "text", editable: true, width: 100 },
    ],
    data: COURSES_DATA,
  },
];

// ============================================================================
// Component
// ============================================================================

export default function AdminBulkData() {
  const [selectedEntity, setSelectedEntity] = useState<string>("members");
  const [editData, setEditData] = useState<Record<string, unknown>[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [undoStack, setUndoStack] = useState<Record<string, unknown>[][]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const entity = ENTITY_CONFIGS.find(e => e.key === selectedEntity)!;

  // Initialize data when entity changes
  useState(() => {
    setEditData(JSON.parse(JSON.stringify(entity.data)));
  });

  const handleEntityChange = (key: string) => {
    setSelectedEntity(key);
    const ent = ENTITY_CONFIGS.find(e => e.key === key);
    if (ent) {
      setEditData(JSON.parse(JSON.stringify(ent.data)));
      setHasChanges(false);
      setUndoStack([]);
      setEditingCell(null);
      setSearchQuery("");
    }
  };

  // Cell editing
  const startEdit = (rowIdx: number, colKey: string, currentValue: unknown) => {
    setEditingCell({ row: rowIdx, col: colKey });
    setEditValue(String(currentValue ?? ""));
  };

  const saveEdit = () => {
    if (!editingCell) return;
    // Push to undo stack
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(editData))]);
    const newData = [...editData];
    const col = entity.columns.find(c => c.key === editingCell.col);
    let value: unknown = editValue;
    if (col?.type === "number") value = Number(editValue) || 0;
    if (col?.type === "checkbox") value = editValue === "true";
    newData[editingCell.row] = { ...newData[editingCell.row], [editingCell.col]: value };
    setEditData(newData);
    setEditingCell(null);
    setHasChanges(true);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  // Undo
  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setEditData(prev);
    toast.success("Undo successful");
  };

  // Save all
  const saveAll = () => {
    setHasChanges(false);
    toast.success(`Saved ${editData.length} ${entity.label} records!`);
  };

  // Add row
  const addRow = () => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(editData))]);
    const newRow: Record<string, unknown> = { id: Date.now() };
    entity.columns.forEach(col => {
      newRow[col.key] = col.type === "number" ? 0 : col.type === "checkbox" ? false : "";
    });
    setEditData([...editData, newRow]);
    setHasChanges(true);
  };

  // Delete row
  const deleteRow = (idx: number) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(editData))]);
    const newData = [...editData];
    newData.splice(idx, 1);
    setEditData(newData);
    setHasChanges(true);
    toast.success("Row deleted");
  };

  // Filter data
  const filteredData = editData.filter(row =>
    searchQuery ? Object.values(row).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase())) : true
  );

  // Export CSV
  const exportCSV = () => {
    const headers = entity.columns.map(c => c.label).join(",");
    const rows = editData.map(row => entity.columns.map(c => `"${String(row[c.key] ?? "")}"`).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${entity.key}_export.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Bulk Data Manager</h1>
          <p className="text-sm text-[#5D7086]">
            Google Sheets-style spreadsheet editing for members, LCs, activities & more — edit one by one or in batch
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge className="bg-amber-100 text-amber-700">
              <AlertTriangle className="mr-1 h-3 w-3" /> Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0}>
            <Undo2 className="mr-1 h-3 w-3" /> Undo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-1 h-3 w-3" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-3 w-3" /> Export CSV
          </Button>
          <Button size="sm" className="bg-[#138A73] text-white" onClick={saveAll} disabled={!hasChanges}>
            <Save className="mr-1 h-3 w-3" /> Save All
          </Button>
        </div>
      </div>

      {/* Entity Selector Tabs */}
      <div className="flex gap-2">
        {ENTITY_CONFIGS.map(ent => (
          <button key={ent.key}
            onClick={() => handleEntityChange(ent.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedEntity === ent.key
                ? "bg-[#1B355E] text-white"
                : "bg-white text-[#5D7086] hover:bg-[#E7F4F0]"
            }`}>
            <span className={selectedEntity === ent.key ? "text-white" : ent.color}>{ent.icon}</span>
            {ent.label}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-[#5D7086]">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{filteredData.length} rows</span>
          <span>•</span>
          <span>{entity.columns.length} columns</span>
          {hasChanges && <span>• <span className="text-amber-600 font-medium">{undoStack.length} changes</span></span>}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-[#8A9BAE]" />
          <Input placeholder="Search rows..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="h-8 w-64 pl-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowColumnSettings(true)}>
          <Settings className="h-3 w-3" />
        </Button>
      </div>

      {/* Spreadsheet Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F6F9F8]">
                <TableHead className="w-10 bg-[#F6F9F8]">#</TableHead>
                {entity.columns.map(col => (
                  <TableHead key={col.key} className="bg-[#F6F9F8] whitespace-nowrap" style={{ minWidth: col.width }}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-[#1B355E]">{col.label}</span>
                      <ArrowUpDown className="h-3 w-3 text-[#8A9BAE]" />
                      {!col.editable && <span className="text-[8px] text-[#8A9BAE]">🔒</span>}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-10 bg-[#F6F9F8]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row, rowIdx) => {
                const realIdx = editData.indexOf(row);
                return (
                  <TableRow key={rowIdx} className="hover:bg-[#F6F9F8] transition-colors">
                    <TableCell className="text-xs text-[#8A9BAE]">{rowIdx + 1}</TableCell>
                    {entity.columns.map(col => {
                      const isEditing = editingCell?.row === realIdx && editingCell?.col === col.key;
                      const value = row[col.key];
                      return (
                        <TableCell key={col.key}
                          className={`cursor-pointer text-sm transition-colors ${col.editable ? "hover:bg-[#E7F4F0]" : "text-[#8A9BAE] bg-gray-50/50"}`}
                          style={{ minWidth: col.width }}
                          onClick={() => col.editable && startEdit(realIdx, col.key, value)}>
                          {isEditing ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              {col.type === "select" ? (
                                <Select value={editValue} onValueChange={v => { setEditValue(v); }}>
                                  <SelectTrigger className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {col.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input value={editValue} onChange={e => setEditValue(e.target.value)}
                                  className="h-7 text-xs" autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} />
                              )}
                              <button onClick={saveEdit} className="rounded bg-green-500 p-0.5 text-white"><Check className="h-3 w-3" /></button>
                              <button onClick={cancelEdit} className="rounded bg-red-500 p-0.5 text-white"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <span className={col.type === "select" ? getSelectBadgeClass(String(value)) : ""}>
                              {col.type === "select" ? (
                                <Badge variant="outline" className={`text-[10px] font-normal ${getSelectBadgeClass(String(value))}`}>
                                  {String(value || "—")}
                                </Badge>
                              ) : col.type === "number" ? (
                                <span className="font-mono">{String(value ?? "0")}</span>
                              ) : (
                                String(value || "—")
                              )}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <button onClick={() => deleteRow(realIdx)} className="rounded p-1 text-red-400 opacity-0 hover:bg-red-50 hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Row Button */}
      <Button variant="outline" className="w-full border-dashed" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" /> Add New Row
      </Button>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Data from CSV</DialogTitle>
            <DialogDescription>Upload a CSV file to bulk-import {entity.label}. Column headers must match the spreadsheet columns.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border-2 border-dashed border-[#D9E4E1] p-12 text-center">
            <Upload className="mx-auto mb-3 h-10 w-10 text-[#8A9BAE]" />
            <p className="text-sm font-medium text-[#1B355E]">Drop CSV file here or click to browse</p>
            <p className="mt-1 text-xs text-[#5D7086]">Headers: {entity.columns.map(c => c.label).join(", ")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("CSV imported!"); setShowImportDialog(false); }}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Settings Dialog */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Column Settings</DialogTitle>
            <DialogDescription>Configure which columns are visible and editable</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {entity.columns.map(col => (
              <div key={col.key} className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#1B355E]">{col.label}</span>
                  <Badge variant="outline" className="text-[10px]">{col.type}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={col.editable ? "default" : "secondary"} className={col.editable ? "bg-green-100 text-green-700" : ""}>
                    {col.editable ? "Editable" : "Read-only"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColumnSettings(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getSelectBadgeClass(value: string): string {
  switch (value) {
    case "Active": case "active": case "published": case "upcoming":
      return "bg-green-100 text-green-700 border-green-200";
    case "Pending": case "draft": case "ongoing":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Inactive": case "archived": case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "Suspended": case "failed":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "";
  }
}
