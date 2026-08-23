import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderOpen, FileText, Image, File, Upload, Download, Search, Plus,
  Trash2, Edit2, RefreshCw, Settings, Code2, Play, CheckCircle,
  Clock, AlertTriangle, HardDrive, Cloud, Folder, ChevronRight,
  Grid3X3, List, Eye, Share2, Copy, MoreVertical, Wrench,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Mock Drive Data (in production, fetched from backend)
// ============================================================================

const MOCK_FOLDERS = [
  { id: "root", name: "MSAP Drive", parentId: null, icon: Cloud, color: "text-[#138A73]" },
  { id: "member-docs", name: "Member Documents", parentId: "root", icon: FileText, color: "text-blue-500" },
  { id: "letters", name: "Membership Letters", parentId: "member-docs", icon: FileText, color: "text-blue-400" },
  { id: "cards", name: "Membership Cards", parentId: "member-docs", icon: File, color: "text-green-500" },
  { id: "certs", name: "Certificates", parentId: "member-docs", icon: FileText, color: "text-violet-500" },
  { id: "cvs", name: "CVs & Resumes", parentId: "member-docs", icon: FileText, color: "text-orange-500" },
  { id: "photos", name: "Profile Photos", parentId: "member-docs", icon: Image, color: "text-pink-500" },
  { id: "lc-docs", name: "Local Council Documents", parentId: "root", icon: FolderOpen, color: "text-amber-500" },
  { id: "governance", name: "Governance Documents", parentId: "root", icon: FolderOpen, color: "text-[#1B355E]" },
  { id: "templates", name: "Templates", parentId: "root", icon: FolderOpen, color: "text-teal-500" },
  { id: "activities", name: "Activity & Event Files", parentId: "root", icon: FolderOpen, color: "text-red-500" },
  { id: "scripts", name: "Apps Scripts", parentId: "root", icon: Code2, color: "text-indigo-500" },
];

const MOCK_FILES = [
  { id: "f1", name: "MSAP Constitution 2025.pdf", size: 2457600, type: "pdf", folder: "governance", date: "2025-12-01" },
  { id: "f2", name: "Annual Report 2025.pdf", size: 5678000, type: "pdf", folder: "governance", date: "2025-12-15" },
  { id: "f3", name: "Membership Letter Template.docx", size: 89000, type: "docx", folder: "templates", date: "2025-11-20" },
  { id: "f4", name: "Meeting Minutes Template.docx", size: 67000, type: "docx", folder: "templates", date: "2025-11-22" },
  { id: "f5", name: "Budget Template 2026.xlsx", size: 45000, type: "xlsx", folder: "templates", date: "2026-01-05" },
  { id: "f6", name: "Membership Card Template.png", size: 156000, type: "png", folder: "templates", date: "2025-10-30" },
  { id: "f7", name: "Health Screening Photos.zip", size: 23456000, type: "zip", folder: "activities", date: "2026-02-10" },
  { id: "f8", name: "NEF Report Q1 2026.pdf", size: 890000, type: "pdf", folder: "governance", date: "2026-03-01" },
  { id: "f9", name: "Certificate of Appreciation.pptx", size: 345000, type: "pptx", folder: "templates", date: "2026-01-15" },
  { id: "f10", name: "Member Directory Export.csv", size: 123000, type: "csv", folder: "member-docs", date: "2026-03-10" },
  { id: "f11", name: "Research Paper Guidelines.pdf", size: 234000, type: "pdf", folder: "templates", date: "2026-02-20" },
  { id: "f12", name: "LC Activity Report.docx", size: 78000, type: "docx", folder: "lc-docs", date: "2026-02-25" },
];

const MOCK_SCRIPTS = [
  { id: "s1", name: "Member Data Sync", description: "Synchronizes member data between Google Sheets and MSAP portal", status: "deployed" as const, lastRun: "2026-03-15T10:30:00Z" },
  { id: "s2", name: "LC Activity Tracker", description: "Tracks and reports on Local Council activities and events", status: "deployed" as const, lastRun: "2026-03-14T08:00:00Z" },
  { id: "s3", name: "Membership ID Generator", description: "Auto-generates membership IDs for approved applicants", status: "draft" as const, lastRun: null },
];

// ============================================================================
// Helpers
// ============================================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(type: string) {
  switch (type) {
    case "pdf": return <FileText className="h-5 w-5 text-red-500" />;
    case "docx": case "doc": return <FileText className="h-5 w-5 text-blue-500" />;
    case "xlsx": case "csv": return <FileText className="h-5 w-5 text-green-500" />;
    case "pptx": case "ppt": return <FileText className="h-5 w-5 text-orange-500" />;
    case "png": case "jpg": case "jpeg": return <Image className="h-5 w-5 text-purple-500" />;
    case "zip": return <FolderOpen className="h-5 w-5 text-yellow-500" />;
    default: return <File className="h-5 w-5 text-gray-400" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export default function AdminGoogleDrive() {
  const [currentFolder, setCurrentFolder] = useState("root");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("files");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [scriptCode, setScriptCode] = useState("");

  // Get current folder's children
  const currentFolders = MOCK_FOLDERS.filter(f => f.parentId === currentFolder);
  const currentFiles = MOCK_FILES.filter(f => f.folder === currentFolder);
  const breadcrumb = getBreadcrumb(currentFolder);

  // Stats
  const totalSize = MOCK_FILES.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Google Drive</h1>
          <p className="text-sm text-[#5D7086]">
            Full Google Drive environment — manage files, folders, Apps Scripts, and integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)}>
            <Upload className="mr-1 h-3 w-3" /> Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(true)}>
            <Plus className="mr-1 h-3 w-3" /> New Folder
          </Button>
          <Button size="sm" className="bg-[#138A73] text-white" onClick={() => toast.success("Drive synced with portal!")}>
            <RefreshCw className="mr-1 h-3 w-3" /> Sync Portal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Files", value: MOCK_FILES.length, icon: FileText, color: "text-[#138A73]" },
          { label: "Folders", value: MOCK_FOLDERS.length - 1, icon: FolderOpen, color: "text-blue-500" },
          { label: "Storage Used", value: formatSize(totalSize), icon: HardDrive, color: "text-amber-500" },
          { label: "Apps Scripts", value: MOCK_SCRIPTS.length, icon: Code2, color: "text-violet-500" },
        ].map(stat => (
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

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="files">📁 Files & Folders</TabsTrigger>
          <TabsTrigger value="scripts">⚡ Apps Scripts</TabsTrigger>
          <TabsTrigger value="integrations">🔗 Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          {/* Breadcrumb + Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-[#5D7086]">
              {breadcrumb.map((folder, i) => (
                <span key={folder.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <button onClick={() => setCurrentFolder(folder.id)}
                    className={`hover:text-[#138A73] ${i === breadcrumb.length - 1 ? "font-semibold text-[#1B355E]" : ""}`}>
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-[#8A9BAE]" />
                <Input placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 w-64 pl-8 text-sm" />
              </div>
              <div className="flex rounded-lg border border-[#D9E4E1] p-0.5">
                <button onClick={() => setViewMode("grid")} className={`rounded p-1 ${viewMode === "grid" ? "bg-[#138A73] text-white" : "text-[#5D7086]"}`}><Grid3X3 className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("list")} className={`rounded p-1 ${viewMode === "list" ? "bg-[#138A73] text-white" : "text-[#5D7086]"}`}><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Folders */}
          {currentFolders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8A9BAE]">Folders ({currentFolders.length})</p>
              <div className={viewMode === "grid" ? "grid gap-3 md:grid-cols-3 lg:grid-cols-4" : "space-y-2"}>
                {currentFolders.map(folder => {
                  const FolderIcon = folder.icon;
                  const childCount = MOCK_FOLDERS.filter(f => f.parentId === folder.id).length + MOCK_FILES.filter(f => f.folder === folder.id).length;
                  return (
                    <div key={folder.id}
                      className={`group cursor-pointer rounded-xl border border-[#E7F4F0] bg-white p-4 transition-all hover:border-[#138A73] hover:shadow-md ${viewMode === "list" ? "flex items-center gap-4" : ""}`}
                      onClick={() => setCurrentFolder(folder.id)}>
                      <div className={`rounded-lg p-2 ${viewMode === "list" ? "" : "mb-3 inline-block"}`} style={{ backgroundColor: `${folder.color}15` }}>
                        <FolderIcon className={`h-5 w-5 ${folder.color}`} />
                      </div>
                      <div className={viewMode === "list" ? "flex-1" : ""}>
                        <p className="font-medium text-[#1B355E]">{folder.name}</p>
                        <p className="text-xs text-[#8A9BAE]">{childCount} items</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files */}
          {currentFiles.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8A9BAE]">Files ({currentFiles.length})</p>
              {viewMode === "grid" ? (
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {currentFiles.map(file => (
                    <Card key={file.id} className="msap-card-hover group cursor-pointer transition-all hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                          {getFileIcon(file.type)}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1 hover:bg-gray-100"><Eye className="h-3 w-3 text-[#5D7086]" /></button>
                            <button className="rounded p-1 hover:bg-gray-100"><Download className="h-3 w-3 text-[#5D7086]" /></button>
                            <button className="rounded p-1 hover:bg-gray-100"><Share2 className="h-3 w-3 text-[#5D7086]" /></button>
                          </div>
                        </div>
                        <p className="truncate text-sm font-medium text-[#1B355E]">{file.name}</p>
                        <p className="mt-1 text-xs text-[#8A9BAE]">{formatSize(file.size)} • {file.date}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E7F4F0] bg-[#F6F9F8]">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[#1B355E]">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[#1B355E]">Size</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[#1B355E]">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[#1B355E]">Modified</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-[#1B355E]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentFiles.map(file => (
                          <tr key={file.id} className="border-b border-[#E7F4F0] hover:bg-[#F6F9F8]">
                            <td className="flex items-center gap-2 px-4 py-2">
                              {getFileIcon(file.type)}
                              <span className="text-[#1B355E]">{file.name}</span>
                            </td>
                            <td className="px-4 py-2 text-[#5D7086]">{formatSize(file.size)}</td>
                            <td className="px-4 py-2"><Badge variant="outline" className="text-[10px]">{file.type.toUpperCase()}</Badge></td>
                            <td className="px-4 py-2 text-[#5D7086]">{file.date}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button className="rounded p-1 hover:bg-gray-100"><Eye className="h-3.5 w-3.5 text-[#5D7086]" /></button>
                                <button className="rounded p-1 hover:bg-gray-100"><Download className="h-3.5 w-3.5 text-[#5D7086]" /></button>
                                <button className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {currentFolders.length === 0 && currentFiles.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <FolderOpen className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                <p className="text-lg font-medium text-[#1B355E]">Empty Folder</p>
                <p className="text-sm text-[#5D7086]">Upload files or create a new folder</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scripts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1B355E]">Apps Script Projects</h2>
            <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setShowScriptEditor(true)}>
              <Plus className="mr-1 h-3 w-3" /> New Script
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MOCK_SCRIPTS.map(script => (
              <Card key={script.id} className="msap-card-hover cursor-pointer transition-all hover:shadow-md"
                onClick={() => { setSelectedScript(script.id); setShowScriptEditor(true); }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-indigo-50 p-2"><Code2 className="h-4 w-4 text-indigo-600" /></div>
                      <div>
                        <CardTitle className="text-base text-[#1B355E]">{script.name}</CardTitle>
                        <CardDescription className="mt-0.5">{script.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={script.status === "deployed" ? "default" : "secondary"}
                      className={script.status === "deployed" ? "bg-green-100 text-green-700" : ""}>
                      {script.status === "deployed" ? <><CheckCircle className="mr-1 h-3 w-3" /> Deployed</> : <><Clock className="mr-1 h-3 w-3" /> Draft</>}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); toast.success("Script deployed!"); }}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); }}>
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {script.lastRun && (
                    <p className="mt-2 text-[10px] text-[#8A9BAE]">
                      Last run: {new Date(script.lastRun).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Connected Services</CardTitle>
              <CardDescription>Google Drive API integrations and Apps Script connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "Google Drive API", status: "connected", description: "Full Drive access for file management", icon: Cloud },
                { name: "Google Sheets API", status: "connected", description: "Bulk data editing in spreadsheet format", icon: FileText },
                { name: "Apps Script Runtime", status: "connected", description: "Server-side script execution", icon: Code2 },
                { name: "Google Calendar", status: "not_connected", description: "Sync events with Google Calendar", icon: Clock },
                { name: "Gmail Integration", status: "not_connected", description: "Send emails through Gmail", icon: FileText },
              ].map(integration => (
                <div key={integration.name} className="flex items-center justify-between rounded-xl border border-[#E7F4F0] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#F6F9F8] p-2"><integration.icon className="h-5 w-5 text-[#138A73]" /></div>
                    <div>
                      <p className="font-medium text-[#1B355E]">{integration.name}</p>
                      <p className="text-xs text-[#5D7086]">{integration.description}</p>
                    </div>
                  </div>
                  <Badge variant={integration.status === "connected" ? "default" : "outline"}
                    className={integration.status === "connected" ? "bg-green-100 text-green-700" : ""}>
                    {integration.status === "connected" ? "✓ Connected" : "Connect"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>Drag and drop or click to select files. Supports PDF, DOCX, XLSX, PPTX, images, and more.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border-2 border-dashed border-[#D9E4E1] p-12 text-center">
            <Upload className="mx-auto mb-3 h-10 w-10 text-[#8A9BAE]" />
            <p className="text-sm font-medium text-[#1B355E]">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-[#5D7086]">PDF, DOCX, XLSX, PPTX, PNG, JPG, ZIP (max 100MB)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("Files uploaded!"); setShowUploadDialog(false); }}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input placeholder="Folder name" className="h-9" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>Cancel</Button>
            <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("Folder created!"); setShowNewFolderDialog(false); }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Editor Dialog */}
      <Dialog open={showScriptEditor} onOpenChange={setShowScriptEditor}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Apps Script Editor</DialogTitle>
            <DialogDescription>Write and deploy Google Apps Script for portal automation</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <div className="rounded-lg bg-[#1a1a2e] p-4 font-mono text-sm text-green-400 overflow-auto max-h-[400px]">
              <pre className="whitespace-pre-wrap">{`/**
 * MSAP Member Data Sync
 * Syncs member data between Google Sheets and the portal
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MSAP Tools')
    .addItem('Sync to Portal', 'syncToPortal')
    .addItem('Import from Portal', 'importFromPortal')
    .addToUi();
}

function syncToPortal() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  Logger.log('Syncing ' + rows.length + ' rows...');
  // API call to MSAP portal
  const response = UrlFetchApp.fetch(
    '${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/trpc/member.bulkUpdate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ rows, headers })
    }
  );

  SpreadsheetApp.getUi().alert(
    'Synced ' + rows.length + ' records!'
  );
}

function importFromPortal() {
  Logger.log('Importing from MSAP Portal...');
  // Fetch from portal API
  const response = UrlFetchApp.fetch(
    '${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/trpc/member.listAll'
  );
  const data = JSON.parse(response.getContentText());

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getActiveSheet();
  sheet.clearContents();
  sheet.appendRow(Object.keys(data[0]));
  data.forEach(row => sheet.appendRow(Object.values(row)));

  SpreadsheetApp.getUi().alert('Import complete!');
}

function generateReport() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getActiveSheet();
  const data = sheet.getDataRange().getValues();
  // Generate analytics...
  Logger.log('Report generated for ' + data.length + ' records');
}`}</pre>
            </div>
          </div>
          <DialogFooter className="flex-row">
            <Button variant="outline" onClick={() => setShowScriptEditor(false)}>Close</Button>
            <Button variant="outline" onClick={() => toast.success("Script saved!")}>
              <Save className="mr-1 h-3 w-3" /> Save
            </Button>
            <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("Script deployed successfully!"); setShowScriptEditor(false); }}>
              <Play className="mr-1 h-3 w-3" /> Deploy & Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getBreadcrumb(folderId: string): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  let current = MOCK_FOLDERS.find(f => f.id === folderId);
  while (current) {
    result.unshift({ id: current.id, name: current.name });
    current = current.parentId ? MOCK_FOLDERS.find(f => f.id === current!.parentId) : undefined;
  }
  return result;
}

function Save(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  );
}
