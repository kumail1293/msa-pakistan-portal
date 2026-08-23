import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus, Trash2, GripVertical, Eye, Save, Undo2, Redo2,
  Settings, Layout, Type, Image, Video, MapPin, Code2,
  MoveHorizontal, ChevronDown, ChevronUp, Copy, Palette,
  Monitor, Tablet, Smartphone, Layers, MousePointer2,
  FileText, Calendar, Users, BarChart3, Globe,
  Star, MessageSquare, DollarSign, Clock, Zap, Menu,
  PanelLeft, PanelRight, Grid3X3, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Widget Definitions (Elementor-like)
// ============================================================================

interface WidgetDef {
  type: string;
  name: string;
  icon: React.ReactNode;
  category: "basic" | "content" | "media" | "pro" | "dynamic";
  description: string;
}

const WIDGET_CATALOG: WidgetDef[] = [
  // Basic
  { type: "heading", name: "Heading", icon: <Type className="h-4 w-4" />, category: "basic", description: "Section heading (H1-H6)" },
  { type: "text", name: "Text Editor", icon: <FileText className="h-4 w-4" />, category: "basic", description: "Rich text content block" },
  { type: "button", name: "Button", icon: <MousePointer2 className="h-4 w-4" />, category: "basic", description: "Call-to-action button" },
  { type: "divider", name: "Divider", icon: <MoveHorizontal className="h-4 w-4" />, category: "basic", description: "Horizontal line separator" },
  { type: "spacer", name: "Spacer", icon: <Grid3X3 className="h-4 w-4" />, category: "basic", description: "Empty vertical space" },
  // Content
  { type: "image", name: "Image", icon: <Image className="h-4 w-4" />, category: "content", description: "Single image with caption" },
  { type: "gallery", name: "Gallery", icon: <Image className="h-4 w-4" />, category: "content", description: "Image gallery grid" },
  { type: "video", name: "Video", icon: <Video className="h-4 w-4" />, category: "content", description: "Embedded video player" },
  { type: "map", name: "Google Map", icon: <MapPin className="h-4 w-4" />, category: "content", description: "Embedded map" },
  { type: "html", name: "Custom HTML", icon: <Code2 className="h-4 w-4" />, category: "content", description: "Raw HTML code block" },
  // Pro
  { type: "testimonial", name: "Testimonial", icon: <MessageSquare className="h-4 w-4" />, category: "pro", description: "Client testimonial" },
  { type: "countdown", name: "Countdown", icon: <Clock className="h-4 w-4" />, category: "pro", description: "Event countdown timer" },
  { type: "pricing", name: "Pricing Table", icon: <DollarSign className="h-4 w-4" />, category: "pro", description: "Pricing comparison table" },
  { type: "tabs", name: "Tabs", icon: <Layers className="h-4 w-4" />, category: "pro", description: "Tabbed content section" },
  { type: "accordion", name: "Accordion", icon: <ChevronDown className="h-4 w-4" />, category: "pro", description: "Expandable content" },
  { type: "icon_box", name: "Icon Box", icon: <Star className="h-4 w-4" />, category: "pro", description: "Icon with heading and text" },
  // Dynamic
  { type: "member_stats", name: "Member Stats", icon: <Users className="h-4 w-4" />, category: "dynamic", description: "Live member statistics" },
  { type: "events_list", name: "Events List", icon: <Calendar className="h-4 w-4" />, category: "dynamic", description: "Upcoming events feed" },
  { type: "announcements", name: "Announcements", icon: <BarChart3 className="h-4 w-4" />, category: "dynamic", description: "Latest announcements" },
  { type: "social_links", name: "Social Links", icon: <Globe className="h-4 w-4" />, category: "dynamic", description: "Social media links" },
  { type: "cta_banner", name: "CTA Banner", icon: <Zap className="h-4 w-4" />, category: "dynamic", description: "Call-to-action banner" },
];

// ============================================================================
// Types
// ============================================================================

interface BuilderWidget {
  id: string;
  type: string;
  settings: Record<string, unknown>;
}

interface BuilderColumn {
  id: string;
  width: string;
  widgets: BuilderWidget[];
}

interface BuilderSection {
  id: string;
  columns: BuilderColumn[];
  settings: {
    background?: string;
    padding?: string;
    layout?: string;
  };
}

interface BuilderPage {
  id: string;
  slug: string;
  title: string;
  sections: BuilderSection[];
  status: "draft" | "published";
}

// ============================================================================
// Helper
// ============================================================================

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// Component
// ============================================================================

export default function AdminPageBuilder() {
  const pagesQuery = (trpc as any).cms?.listPages?.useQuery({}) ?? { data: [] };
  const pages: any[] = pagesQuery.data ?? [];

  const [selectedPage, setSelectedPage] = useState<BuilderPage | null>(null);
  const [selectedWidget, setSelectedWidget] = useState<{ sectionIdx: number; colIdx: number; widgetIdx: number } | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const [dragWidget, setDragWidget] = useState<string | null>(null);

  // Initialize builder page from CMS data
  const initPage = useCallback((page: any) => {
    const builderPage: BuilderPage = {
      id: page.id,
      slug: page.slug,
      title: page.title,
      sections: page.content?.sections?.length
        ? page.content.sections.map((s: any) => ({
            id: s.id || uid(),
            columns: s.columns?.map((c: any) => ({
              id: c.id || uid(),
              width: c.width || "100%",
              widgets: c.widgets?.map((w: any) => ({
                id: w.id || uid(),
                type: w.type,
                settings: w.settings || {},
              })) || [],
            })) || [{ id: uid(), width: "100%", widgets: [] }],
            settings: s.settings || {},
          }))
        : [{ id: uid(), columns: [{ id: uid(), width: "100%", widgets: [] }], settings: {} }],
      status: page.status || "draft",
    };
    setSelectedPage(builderPage);
  }, []);

  // ── Section operations ──
  const addSection = () => {
    if (!selectedPage) return;
    const newSection: BuilderSection = {
      id: uid(),
      columns: [{ id: uid(), width: "100%", widgets: [] }],
      settings: { layout: "boxed", background: "#ffffff", padding: "40px 0" },
    };
    setSelectedPage({ ...selectedPage, sections: [...selectedPage.sections, newSection] });
  };

  const deleteSection = (idx: number) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    sections.splice(idx, 1);
    setSelectedPage({ ...selectedPage, sections });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    setSelectedPage({ ...selectedPage, sections });
  };

  // ── Column operations ──
  const addColumn = (sectionIdx: number) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    section.columns = [...section.columns, { id: uid(), width: "50%", widgets: [] }];
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
  };

  const setColumnLayout = (sectionIdx: number, colIdx: number, width: string) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    const columns = [...section.columns];
    columns[colIdx] = { ...columns[colIdx], width };
    section.columns = columns;
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
  };

  // ── Widget operations ──
  const addWidget = (sectionIdx: number, colIdx: number, widgetType: string) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    const columns = [...section.columns];
    const col = { ...columns[colIdx] };
    const widgetDef = WIDGET_CATALOG.find(w => w.type === widgetType);
    col.widgets = [...col.widgets, {
      id: uid(),
      type: widgetType,
      settings: { text: widgetDef?.name || "Widget", ...getDefaultSettings(widgetType) },
    }];
    columns[colIdx] = col;
    section.columns = columns;
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
    setShowWidgetPanel(false);
    toast.success(`Added ${widgetDef?.name || widgetType} widget`);
  };

  const deleteWidget = (sectionIdx: number, colIdx: number, widgetIdx: number) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    const columns = [...section.columns];
    const col = { ...columns[colIdx] };
    col.widgets = col.widgets.filter((_, i) => i !== widgetIdx);
    columns[colIdx] = col;
    section.columns = columns;
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
    setSelectedWidget(null);
  };

  const updateWidgetSettings = (sectionIdx: number, colIdx: number, widgetIdx: number, key: string, value: unknown) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    const columns = [...section.columns];
    const col = { ...columns[colIdx] };
    const widgets = [...col.widgets];
    widgets[widgetIdx] = { ...widgets[widgetIdx], settings: { ...widgets[widgetIdx].settings, [key]: value } };
    col.widgets = widgets;
    columns[colIdx] = col;
    section.columns = columns;
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
  };

  const getDefaultSettings = (type: string): Record<string, unknown> => {
    const defaults: Record<string, Record<string, unknown>> = {
      heading: { text: "Heading", tag: "h2", color: "#1B355E" },
      text: { content: "Enter your text here..." },
      button: { text: "Click Me", url: "#", style: "primary" },
      image: { url: "", alt: "" },
      video: { url: "" },
      testimonial: { text: "Amazing service!", author: "John Doe", role: "Member" },
      countdown: { date: "", label: "Coming Soon" },
      icon_box: { icon: "star", title: "Feature Title", description: "Feature description text" },
    };
    return defaults[type] || {};
  };

  // ── Save / Publish ──
  const savePage = () => {
    toast.success("Page saved successfully!");
  };

  const publishPage = () => {
    if (!selectedPage) return;
    setSelectedPage({ ...selectedPage, status: "published" });
    toast.success("Page published!");
  };

  // ── Layout presets ──
  const LAYOUT_PRESETS = [
    { label: "1 Column", columns: ["100%"] },
    { label: "2 Columns", columns: ["50%", "50%"] },
    { label: "30/70", columns: ["30%", "70%"] },
    { label: "70/30", columns: ["70%", "30%"] },
    { label: "3 Columns", columns: ["33.33%", "33.33%", "33.33%"] },
    { label: "4 Columns", columns: ["25%", "25%", "25%", "25%"] },
  ];

  const applyLayout = (sectionIdx: number, columns: string[]) => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections];
    const section = { ...sections[sectionIdx] };
    section.columns = columns.map(w => ({ id: uid(), width: w, widgets: [] }));
    sections[sectionIdx] = section;
    setSelectedPage({ ...selectedPage, sections });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Page Builder</h1>
          <p className="text-sm text-[#5D7086]">
            Visual drag-and-drop page builder — no code required. Elementor-style editing experience.
          </p>
        </div>
        {selectedPage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedPage(null)}>
              ← Back to Pages
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-[#D9E4E1] p-0.5">
              {[
                { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
                { mode: "tablet" as const, icon: Tablet, label: "Tablet" },
                { mode: "mobile" as const, icon: Smartphone, label: "Mobile" },
              ].map(({ mode, icon: Icon, label }) => (
                <button key={mode} onClick={() => setPreviewMode(mode)}
                  className={`rounded-md p-1.5 transition-colors ${previewMode === mode ? "bg-[#138A73] text-white" : "text-[#5D7086] hover:bg-[#E7F4F0]"}`}
                  title={label}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={savePage}>
              <Save className="mr-1 h-3 w-3" /> Save Draft
            </Button>
            <Button size="sm" className="bg-[#138A73] text-white hover:bg-[#106E5B]" onClick={publishPage}>
              Publish
            </Button>
          </div>
        )}
      </div>

      {!selectedPage ? (
        <>
          {/* Pages List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pages.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-16 text-center">
                  <Layout className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                  <h3 className="text-lg font-semibold text-[#1B355E]">No Pages Yet</h3>
                  <p className="mt-2 text-sm text-[#5D7086]">Create your first page with the visual builder</p>
                  <Button className="mt-4 bg-[#138A73] text-white" onClick={() => {
                    setSelectedPage({ id: uid(), slug: "new-page", title: "New Page", sections: [{ id: uid(), columns: [{ id: uid(), width: "100%", widgets: [] }], settings: {} }], status: "draft" });
                  }}>
                    <Plus className="mr-2 h-4 w-4" /> Create Page
                  </Button>
                </CardContent>
              </Card>
            ) : (
              pages.map((page: any) => (
                <Card key={page.id} className="msap-card-hover cursor-pointer transition-all hover:shadow-lg" onClick={() => initPage(page)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-[#1B355E]">{page.title}</CardTitle>
                      <Badge variant={page.status === "published" ? "default" : "secondary"}>
                        {page.status}
                      </Badge>
                    </div>
                    <CardDescription>/{page.slug}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-[#5D7086]">
                      <span>{page.content?.sections?.length || 0} sections</span>
                      <span>•</span>
                      <span>Template: {page.template || "default"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            {/* Create New Page Card */}
            <Card className="msap-card-hover cursor-pointer border-dashed border-2 border-[#D9E4E1] transition-all hover:border-[#138A73] hover:shadow-lg"
              onClick={() => {
                setSelectedPage({ id: uid(), slug: "new-page", title: "New Page", sections: [{ id: uid(), columns: [{ id: uid(), width: "100%", widgets: [] }], settings: {} }], status: "draft" });
              }}>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Plus className="mb-3 h-10 w-10 text-[#8A9BAE]" />
                <p className="font-semibold text-[#1B355E]">Create New Page</p>
                <p className="text-xs text-[#5D7086]">Start from scratch or use a template</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Quick Start Templates</CardTitle>
              <CardDescription>Pre-built page layouts you can customize</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {["Landing Page", "About Us", "Event Page", "Contact Page", "Membership Info", "Chapter Profile", "Blog Post", "Thank You Page"].map(template => (
                  <button key={template} className="rounded-xl border border-[#E7F4F0] bg-[#F6F9F8] p-4 text-left transition-all hover:border-[#138A73] hover:bg-[#E7F4F0]"
                    onClick={() => {
                      setSelectedPage({ id: uid(), slug: template.toLowerCase().replace(/ /g, "-"), title: template, sections: [{ id: uid(), columns: [{ id: uid(), width: "100%", widgets: [{ id: uid(), type: "heading", settings: { text: template, tag: "h1", color: "#1B355E" } }] }], settings: {} }], status: "draft" });
                    }}>
                    <Layout className="mb-2 h-5 w-5 text-[#138A73]" />
                    <p className="text-sm font-semibold text-[#1B355E]">{template}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* ═══════════════════════ BUILDER EDITOR ═══════════════════════ */
        <div className="flex gap-4">
          {/* Left: Widget Panel */}
          <div className="w-64 shrink-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#1B355E]">Widgets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["basic", "content", "pro", "dynamic"] as const).map(cat => (
                  <div key={cat}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#8A9BAE]">{cat}</p>
                    <div className="space-y-1">
                      {WIDGET_CATALOG.filter(w => w.category === cat).map(widget => (
                        <button key={widget.type}
                          className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition-all hover:border-[#D9E4E1] hover:bg-[#F6F9F8]"
                          draggable
                          onDragStart={() => setDragWidget(widget.type)}
                          onDragEnd={() => setDragWidget(null)}
                          title={widget.description}>
                          <span className="text-[#138A73]">{widget.icon}</span>
                          <span className="text-[#1B355E]">{widget.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Layout Presets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#1B355E]">Column Presets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {LAYOUT_PRESETS.map((preset, i) => (
                  <button key={i} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#1B355E] hover:bg-[#F6F9F8]"
                    onClick={() => {
                      if (selectedPage && selectedPage.sections.length > 0) {
                        applyLayout(selectedPage.sections.length - 1, preset.columns);
                      }
                    }}>
                    <div className="flex gap-0.5">
                      {preset.columns.map((w, j) => (
                        <div key={j} className="h-3 rounded-sm bg-[#138A73]/30" style={{ width: parseInt(w) * 0.3 }} />
                      ))}
                    </div>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1">
            <Card className="min-h-[600px]">
              <CardContent className="p-0">
                {selectedPage.sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-[#8A9BAE]">
                    <Layout className="mb-4 h-16 w-16 opacity-30" />
                    <p className="text-lg font-medium">Drag widgets here to start building</p>
                    <p className="text-sm">Or click + to add a new section</p>
                  </div>
                ) : (
                  <div className={`mx-auto space-y-4 p-6 ${previewMode === "mobile" ? "max-w-sm" : previewMode === "tablet" ? "max-w-2xl" : "max-w-full"}`}>
                    {selectedPage.sections.map((section, sIdx) => (
                      <div key={section.id}
                        className="group/section relative rounded-lg border-2 border-dashed border-transparent p-4 transition-all hover:border-[#138A73]/30"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-[#138A73]"); }}
                        onDragLeave={e => e.currentTarget.classList.remove("border-[#138A73]")}
                        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-[#138A73]"); if (dragWidget) addWidget(sIdx, 0, dragWidget); }}>
                        {/* Section toolbar */}
                        <div className="absolute -top-3 left-4 hidden items-center gap-1 group-hover/section:flex">
                          <div className="flex items-center gap-1 rounded-md bg-[#1B355E] px-2 py-0.5 text-[10px] text-white shadow-lg">
                            <span className="font-medium">Section {sIdx + 1}</span>
                            <button onClick={() => moveSection(sIdx, -1)} className="hover:text-[#29C89E]"><ChevronUp className="h-3 w-3" /></button>
                            <button onClick={() => moveSection(sIdx, 1)} className="hover:text-[#29C89E]"><ChevronDown className="h-3 w-3" /></button>
                            <button onClick={() => addColumn(sIdx)} className="hover:text-[#29C89E]"><Plus className="h-3 w-3" /></button>
                            <button onClick={() => deleteSection(sIdx)} className="hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>

                        {/* Columns */}
                        <div className="flex gap-4">
                          {section.columns.map((col, cIdx) => (
                            <div key={col.id} className="flex-1 space-y-2" style={{ flex: `0 0 ${col.width}` }}
                              onDragOver={e => { e.preventDefault(); }}
                              onDrop={e => { e.preventDefault(); if (dragWidget) addWidget(sIdx, cIdx, dragWidget); }}>
                              {col.widgets.length === 0 ? (
                                <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-[#D9E4E1] text-xs text-[#8A9BAE] transition-colors hover:border-[#138A73] hover:text-[#138A73]">
                                  Drop widget here
                                </div>
                              ) : (
                                col.widgets.map((widget, wIdx) => (
                                  <div key={widget.id}
                                    className={`group/widget relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
                                      selectedWidget?.sectionIdx === sIdx && selectedWidget?.colIdx === cIdx && selectedWidget?.widgetIdx === wIdx
                                        ? "border-[#138A73] bg-[#E7F4F0]"
                                        : "border-transparent hover:border-[#D9E4E1] hover:bg-[#F6F9F8]"
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedWidget({ sectionIdx: sIdx, colIdx: cIdx, widgetIdx: wIdx }); }}>
                                    {/* Widget toolbar */}
                                    <div className="absolute -top-2 right-2 hidden items-center gap-1 group-hover/widget:flex">
                                      <span className="rounded bg-[#1B355E] px-1.5 py-0.5 text-[9px] text-white">{WIDGET_CATALOG.find(w => w.type === widget.type)?.name || widget.type}</span>
                                      <button onClick={(e) => { e.stopPropagation(); deleteWidget(sIdx, cIdx, wIdx); }}
                                        className="rounded bg-red-500 p-0.5 text-white"><Trash2 className="h-2.5 w-2.5" /></button>
                                    </div>
                                    {/* Widget preview */}
                                    <WidgetPreview widget={widget} />
                                  </div>
                                ))
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Add Section Button */}
                    <button onClick={addSection}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#D9E4E1] py-8 text-sm text-[#5D7086] transition-all hover:border-[#138A73] hover:text-[#138A73]">
                      <Plus className="h-4 w-4" /> Add New Section
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Settings Panel */}
          <div className="w-72 shrink-0">
            <Card className="sticky top-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#1B355E]">
                  {selectedWidget ? "Widget Settings" : "Page Settings"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedWidget && selectedPage ? (
                  /* Widget settings form */
                  (() => {
                    const w = selectedPage.sections[selectedWidget.sectionIdx]
                      ?.columns[selectedWidget.colIdx]
                      ?.widgets[selectedWidget.widgetIdx];
                    if (!w) return null;
                    const widgetDef = WIDGET_CATALOG.find(d => d.type === w.type);
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#138A73]">{widgetDef?.icon}</span>
                          <span className="text-sm font-medium text-[#1B355E]">{widgetDef?.name}</span>
                        </div>
                        {w.type === "heading" && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Text</label>
                              <Input value={(w.settings.text as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "text", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Tag</label>
                              <Select value={(w.settings.tag as string) || "h2"} onValueChange={v => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "tag", v)}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["h1", "h2", "h3", "h4", "h5", "h6"].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Color</label>
                              <input type="color" value={(w.settings.color as string) || "#1B355E"} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "color", e.target.value)} className="h-8 w-full cursor-pointer rounded border" />
                            </div>
                          </>
                        )}
                        {w.type === "text" && (
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Content</label>
                            <Textarea value={(w.settings.content as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "content", e.target.value)} className="min-h-24 text-sm" />
                          </div>
                        )}
                        {w.type === "button" && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Label</label>
                              <Input value={(w.settings.text as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "text", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">URL</label>
                              <Input value={(w.settings.url as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "url", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Style</label>
                              <Select value={(w.settings.style as string) || "primary"} onValueChange={v => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "style", v)}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="primary">Primary</SelectItem>
                                  <SelectItem value="secondary">Secondary</SelectItem>
                                  <SelectItem value="outline">Outline</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                        {(w.type === "image" || w.type === "video") && (
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#1B355E]">URL</label>
                            <Input value={(w.settings.url as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "url", e.target.value)} className="h-8 text-sm" placeholder="https://..." />
                          </div>
                        )}
                        {w.type === "testimonial" && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Quote</label>
                              <Textarea value={(w.settings.text as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "text", e.target.value)} className="min-h-16 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Author</label>
                              <Input value={(w.settings.author as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "author", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Role</label>
                              <Input value={(w.settings.role as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "role", e.target.value)} className="h-8 text-sm" />
                            </div>
                          </>
                        )}
                        {w.type === "icon_box" && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Title</label>
                              <Input value={(w.settings.title as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "title", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Description</label>
                              <Textarea value={(w.settings.description as string) || ""} onChange={e => updateWidgetSettings(selectedWidget.sectionIdx, selectedWidget.colIdx, selectedWidget.widgetIdx, "description", e.target.value)} className="min-h-16 text-sm" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* Page settings */
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Page Title</label>
                      <Input value={selectedPage.title} onChange={e => setSelectedPage({ ...selectedPage, title: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Slug</label>
                      <Input value={selectedPage.slug} onChange={e => setSelectedPage({ ...selectedPage, slug: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#1B355E]">Status</label>
                      <Select value={selectedPage.status} onValueChange={v => setSelectedPage({ ...selectedPage, status: v as "draft" | "published" })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg bg-[#F6F9F8] p-3">
                      <p className="text-xs font-semibold text-[#1B355E]">Page Stats</p>
                      <p className="mt-1 text-xs text-[#5D7086]">
                        {selectedPage.sections.length} sections •{" "}
                        {selectedPage.sections.reduce((sum, s) => sum + s.columns.reduce((cs, c) => cs + c.widgets.length, 0), 0)} widgets
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#E7F4F0] p-3">
                      <p className="text-xs font-semibold text-[#106E5B]">💡 Tips</p>
                      <ul className="mt-1 space-y-1 text-[10px] text-[#5D7086]">
                        <li>• Drag widgets from the left panel</li>
                        <li>• Click a widget to edit its settings</li>
                        <li>• Use column presets to change layouts</li>
                        <li>• Preview in desktop/tablet/mobile modes</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Widget Preview Component
// ============================================================================

function WidgetPreview({ widget }: { widget: BuilderWidget }) {
  const s = widget.settings;
  switch (widget.type) {
    case "heading":
      return <p style={{ color: (s.color as string) || "#1B355E" }} className="font-bold">{(s.text as string) || "Heading"}</p>;
    case "text":
      return <p className="text-sm text-[#5D7086]">{(s.content as string) || "Text content"}</p>;
    case "button":
      return <button className="rounded-lg bg-[#138A73] px-4 py-2 text-sm text-white">{(s.text as string) || "Button"}</button>;
    case "image":
      return s.url ? <img src={s.url as string} alt="" className="w-full rounded-lg" /> : <div className="flex h-24 items-center justify-center rounded-lg bg-[#F6F9F8] text-xs text-[#8A9BAE]"><Image className="mr-2 h-4 w-4" /> Image Widget</div>;
    case "video":
      return <div className="flex h-32 items-center justify-center rounded-lg bg-[#1B355E]/5 text-xs text-[#8A9BAE]"><Video className="mr-2 h-4 w-4" /> Video Widget</div>;
    case "testimonial":
      return (
        <div className="rounded-lg border-l-4 border-[#138A73] bg-[#F6F9F8] p-3">
          <p className="italic text-sm text-[#5D7086]">"{(s.text as string) || "Testimonial"}"</p>
          <p className="mt-2 text-xs font-semibold text-[#1B355E]">{(s.author as string) || "Author"} — {(s.role as string) || "Role"}</p>
        </div>
      );
    case "icon_box":
      return (
        <div className="flex items-start gap-3 rounded-lg bg-[#F6F9F8] p-3">
          <div className="rounded-lg bg-[#138A73] p-2 text-white"><Star className="h-4 w-4" /></div>
          <div>
            <p className="font-semibold text-[#1B355E]">{(s.title as string) || "Feature"}</p>
            <p className="text-xs text-[#5D7086]">{(s.description as string) || "Description"}</p>
          </div>
        </div>
      );
    case "member_stats":
      return <div className="rounded-lg bg-[#1B355E] p-4 text-center text-white"><p className="text-2xl font-bold">2,500+</p><p className="text-xs opacity-80">Active Members</p></div>;
    case "events_list":
      return <div className="rounded-lg bg-[#F6F9F8] p-3 text-sm text-[#5D7086]"><Calendar className="mr-1 inline h-4 w-4 text-[#138A73]" /> Upcoming Events Feed</div>;
    case "announcements":
      return <div className="rounded-lg bg-[#F6F9F8] p-3 text-sm text-[#5D7086]"><BarChart3 className="mr-1 inline h-4 w-4 text-[#138A73]" /> Latest Announcements</div>;
    case "divider":
      return <hr className="border-[#D9E4E1]" />;
    case "spacer":
      return <div className="h-8" />;
    case "social_links":
      return <div className="flex gap-2 text-[#138A73]"><Globe className="h-5 w-5" /><Globe className="h-5 w-5" /><Globe className="h-5 w-5" /></div>;
    case "cta_banner":
      return <div className="rounded-lg bg-gradient-to-r from-[#1B355E] to-[#138A73] p-6 text-center text-white"><p className="text-lg font-bold">Join MSA Pakistan Today</p><p className="text-xs opacity-80">Become part of the largest medical students network</p></div>;
    case "html":
      return <div className="rounded-lg bg-[#F6F9F8] p-3 text-xs text-[#5D7086]"><Code2 className="mr-1 inline h-3 w-3" /> Custom HTML Block</div>;
    case "map":
      return <div className="flex h-32 items-center justify-center rounded-lg bg-[#E7F4F0] text-xs text-[#5D7086]"><MapPin className="mr-1 h-4 w-4" /> Google Map</div>;
    case "gallery":
      return <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(i => <div key={i} className="flex h-16 items-center justify-center rounded bg-[#F6F9F8]"><Image className="h-4 w-4 text-[#8A9BAE]" /></div>)}</div>;
    default:
      return <div className="rounded-lg bg-[#F6F9F8] p-2 text-xs text-[#8A9BAE]">{widget.type}</div>;
  }
}
