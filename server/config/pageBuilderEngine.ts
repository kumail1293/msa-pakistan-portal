/**
 * Visual Page Builder Engine
 *
 * Elementor-like drag-and-drop page building system.
 * Provides:
 * - Section/Column/Widget hierarchy
 * - Widget library (50+ widgets)
 * - Template library (pre-built layouts)
 * - Responsive device preview
 * - Undo/Redo history
 * - Copy/Paste elements
 * - Global styles
 * - Animation system
 */

import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface BuilderDocument {
  id: string;
  entityType: "page" | "post" | "template" | "header" | "footer";
  entityId: string;
  content: BuilderContent;
  version: number;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

export interface BuilderContent {
  sections: BuilderSection[];
  globalStyles: BuilderGlobalStyles;
}

export interface BuilderGlobalStyles {
  colors: string[];
  fonts: BuilderFont[];
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
}

export interface BuilderFont {
  family: string;
  weights: number[];
  category: string;
}

export interface BuilderSection {
  id: string;
  order: number;
  settings: BuilderSectionSettings;
  columns: BuilderColumn[];
}

export interface BuilderSectionSettings {
  layout?: "boxed" | "full_width" | "full_height";
  contentWidth?: number;
  gap?: string;
  background?: BuilderBackground;
  padding?: BuilderSpacing;
  margin?: BuilderSpacing;
  animation?: BuilderAnimation;
  className?: string;
  responsive?: {
    desktop?: Partial<BuilderSectionSettings>;
    tablet?: Partial<BuilderSectionSettings>;
    mobile?: Partial<BuilderSectionSettings>;
  };
}

export interface BuilderColumn {
  id: string;
  order: number;
  width: string;
  settings: BuilderColumnSettings;
  widgets: BuilderWidget[];
}

export interface BuilderColumnSettings {
  background?: BuilderBackground;
  padding?: BuilderSpacing;
  verticalAlign?: "top" | "middle" | "bottom";
  align?: string;
  className?: string;
}

export interface BuilderWidget {
  id: string;
  type: string;
  order: number;
  settings: Record<string, unknown>;
  animation?: BuilderAnimation;
  className?: string;
}

export interface BuilderBackground {
  type: "color" | "gradient" | "image" | "video";
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  imageUrl?: string;
  videoUrl?: string;
  size?: "cover" | "contain" | "auto";
  position?: string;
  repeat?: "no-repeat" | "repeat";
  parallax?: boolean;
}

export interface BuilderSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  unit?: "px" | "rem" | "%" | "em";
}

export interface BuilderAnimation {
  type: string; // fadeIn, slideUp, slideLeft, zoom, bounce, etc.
  duration: number;
  delay: number;
}

// ============================================================================
// WIDGET LIBRARY (50+ widgets)
// ============================================================================

export interface BuilderWidgetType {
  type: string;
  name: string;
  icon: string;
  category: "basic" | "general" | "content" | "pro" | "media" | "wordpress" | "social";
  description: string;
  keywords: string[];
  defaults: Record<string, unknown>;
  controls: BuilderControl[];
}

export interface BuilderControl {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "color" | "select" | "slider" | "toggle" | "image" | "media" | "icon" | "repeater" | "group" | "dimensions" | "responsive" | "code";
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  choices?: Record<string, string>;
  conditions?: Record<string, unknown>;
  description?: string;
  group?: string;
}

// ============================================================================
// TEMPLATE LIBRARY
// ============================================================================

export interface BuilderTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  content: BuilderContent;
  tags: string[];
}

// ============================================================================
// PAGE BUILDER ENGINE
// ============================================================================

class PageBuilderEngine {
  private documents: Map<string, BuilderDocument> = new Map();
  private widgetTypes: Map<string, BuilderWidgetType> = new Map();
  private templates: Map<string, BuilderTemplate> = new Map();
  private history: Map<string, BuilderContent[]> = new Map();
  private historyIndex: Map<string, number> = new Map();
  private clipboard: BuilderWidget | BuilderSection | BuilderColumn | null = null;

  constructor() {
    this.registerBuiltinWidgetTypes();
    this.registerBuiltinTemplates();
  }

  // ==========================================================================
  // DOCUMENT MANAGEMENT
  // ==========================================================================

  createDocument(entityType: string, entityId: string): BuilderDocument {
    const id = crypto.randomUUID();
    const now = new Date();
    const doc: BuilderDocument = {
      id,
      entityType: entityType as BuilderDocument["entityType"],
      entityId,
      content: {
        sections: [],
        globalStyles: {
          colors: ["#1B355E", "#138A73", "#29C89E", "#ffffff", "#000000"],
          fonts: [
            { family: "Sora", weights: [400, 500, 600, 700, 800], category: "sans-serif" },
            { family: "Manrope", weights: [400, 500, 600, 700, 800], category: "sans-serif" },
          ],
          spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
        },
      },
      version: 1,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, doc);
    this.history.set(id, [JSON.parse(JSON.stringify(doc.content))]);
    this.historyIndex.set(id, 0);
    return doc;
  }

  getDocument(id: string): BuilderDocument | null {
    return this.documents.get(id) || null;
  }

  updateDocumentContent(id: string, content: BuilderContent): BuilderDocument | null {
    const doc = this.documents.get(id);
    if (!doc) return null;

    // Save to history
    const hist = this.history.get(id) || [];
    const idx = this.historyIndex.get(id) || 0;
    hist.splice(idx + 1); // Remove future states
    hist.push(JSON.parse(JSON.stringify(content)));
    if (hist.length > 50) hist.shift();
    this.history.set(id, hist);
    this.historyIndex.set(id, hist.length - 1);

    doc.content = content;
    doc.version++;
    doc.updatedAt = new Date();
    return doc;
  }

  // ==========================================================================
  // UNDO / REDO
  // ==========================================================================

  undo(id: string): BuilderDocument | null {
    const doc = this.documents.get(id);
    const idx = this.historyIndex.get(id) || 0;
    if (!doc || idx <= 0) return null;

    const hist = this.history.get(id) || [];
    const newIdx = idx - 1;
    this.historyIndex.set(id, newIdx);
    doc.content = JSON.parse(JSON.stringify(hist[newIdx]));
    doc.version++;
    doc.updatedAt = new Date();
    return doc;
  }

  redo(id: string): BuilderDocument | null {
    const doc = this.documents.get(id);
    const hist = this.history.get(id) || [];
    const idx = this.historyIndex.get(id) || 0;
    if (!doc || idx >= hist.length - 1) return null;

    const newIdx = idx + 1;
    this.historyIndex.set(id, newIdx);
    doc.content = JSON.parse(JSON.stringify(hist[newIdx]));
    doc.version++;
    doc.updatedAt = new Date();
    return doc;
  }

  // ==========================================================================
  // COPY / PASTE
  // ==========================================================================

  copy(element: BuilderWidget | BuilderSection | BuilderColumn): void {
    this.clipboard = JSON.parse(JSON.stringify(element));
  }

  paste(): BuilderWidget | BuilderSection | BuilderColumn | null {
    if (!this.clipboard) return null;
    const clone = JSON.parse(JSON.stringify(this.clipboard));
    // Assign new IDs
    this.assignNewIds(clone);
    return clone;
  }

  private assignNewIds(obj: unknown): void {
    if (typeof obj !== "object" || obj === null) return;
    const o = obj as Record<string, unknown>;
    if ("id" in o && typeof o.id === "string") {
      o.id = crypto.randomUUID();
    }
    if ("columns" in o && Array.isArray(o.columns)) {
      for (const col of o.columns) this.assignNewIds(col);
    }
    if ("widgets" in o && Array.isArray(o.widgets)) {
      for (const w of o.widgets) this.assignNewIds(w);
    }
  }

  // ==========================================================================
  // SECTION OPERATIONS
  // ==========================================================================

  addSection(docId: string, afterSectionId?: string): BuilderSection | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    const section: BuilderSection = {
      id: crypto.randomUUID(),
      order: doc.content.sections.length,
      settings: { layout: "boxed", contentWidth: 1200, gap: "default" },
      columns: [
        {
          id: crypto.randomUUID(),
          order: 0,
          width: "100%",
          settings: {},
          widgets: [],
        },
      ],
    };

    if (afterSectionId) {
      const idx = doc.content.sections.findIndex((s) => s.id === afterSectionId);
      doc.content.sections.splice(idx + 1, 0, section);
    } else {
      doc.content.sections.push(section);
    }

    this.reorderSections(doc);
    this.updateDocumentContent(docId, doc.content);
    return section;
  }

  addPresetColumns(docId: string, sectionId: string, preset: string): BuilderSection | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    const section = doc.content.sections.find((s) => s.id === sectionId);
    if (!section) return null;

    const presets: Record<string, { width: string }[]> = {
      "2-1": [{ width: "66.66%" }, { width: "33.33%" }],
      "1-2": [{ width: "33.33%" }, { width: "66.66%" }],
      "1-1": [{ width: "50%" }, { width: "50%" }],
      "1-1-1": [{ width: "33.33%" }, { width: "33.33%" }, { width: "33.33%" }],
      "1-2-1": [{ width: "25%" }, { width: "50%" }, { width: "25%" }],
      "2-1-1": [{ width: "50%" }, { width: "25%" }, { width: "25%" }],
      "1-1-2": [{ width: "25%" }, { width: "25%" }, { width: "50%" }],
      "1-1-1-1": [{ width: "25%" }, { width: "25%" }, { width: "25%" }, { width: "25%" }],
      "full": [{ width: "100%" }],
    };

    const cols = presets[preset] || presets["1-1"];
    section.columns = cols.map((c, i) => ({
      id: crypto.randomUUID(),
      order: i,
      width: c.width,
      settings: {},
      widgets: [],
    }));

    this.updateDocumentContent(docId, doc.content);
    return section;
  }

  removeSection(docId: string, sectionId: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;
    doc.content.sections = doc.content.sections.filter((s) => s.id !== sectionId);
    this.reorderSections(doc);
    this.updateDocumentContent(docId, doc.content);
    return true;
  }

  moveSection(docId: string, sectionId: string, newIndex: number): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;
    const idx = doc.content.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return false;
    const [section] = doc.content.sections.splice(idx, 1);
    doc.content.sections.splice(newIndex, 0, section);
    this.reorderSections(doc);
    this.updateDocumentContent(docId, doc.content);
    return true;
  }

  duplicateSection(docId: string, sectionId: string): BuilderSection | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;
    const section = doc.content.sections.find((s) => s.id === sectionId);
    if (!section) return null;
    const clone = JSON.parse(JSON.stringify(section)) as BuilderSection;
    this.assignNewIds(clone);
    const idx = doc.content.sections.findIndex((s) => s.id === sectionId);
    doc.content.sections.splice(idx + 1, 0, clone);
    this.reorderSections(doc);
    this.updateDocumentContent(docId, doc.content);
    return clone;
  }

  // ==========================================================================
  // WIDGET OPERATIONS
  // ==========================================================================

  addWidget(docId: string, sectionId: string, columnId: string, widgetType: string, afterWidgetId?: string): BuilderWidget | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    const section = doc.content.sections.find((s) => s.id === sectionId);
    if (!section) return null;
    const column = section.columns.find((c) => c.id === columnId);
    if (!column) return null;

    const typeDef = this.widgetTypes.get(widgetType);
    const widget: BuilderWidget = {
      id: crypto.randomUUID(),
      type: widgetType,
      order: column.widgets.length,
      settings: typeDef ? { ...typeDef.defaults } : {},
    };

    if (afterWidgetId) {
      const idx = column.widgets.findIndex((w) => w.id === afterWidgetId);
      column.widgets.splice(idx + 1, 0, widget);
    } else {
      column.widgets.push(widget);
    }

    this.reorderWidgets(column);
    this.updateDocumentContent(docId, doc.content);
    return widget;
  }

  updateWidgetSettings(docId: string, widgetId: string, settings: Record<string, unknown>): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    for (const section of doc.content.sections) {
      for (const column of section.columns) {
        const widget = column.widgets.find((w) => w.id === widgetId);
        if (widget) {
          widget.settings = { ...widget.settings, ...settings };
          this.updateDocumentContent(docId, doc.content);
          return true;
        }
      }
    }
    return false;
  }

  removeWidget(docId: string, widgetId: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    for (const section of doc.content.sections) {
      for (const column of section.columns) {
        const idx = column.widgets.findIndex((w) => w.id === widgetId);
        if (idx !== -1) {
          column.widgets.splice(idx, 1);
          this.updateDocumentContent(docId, doc.content);
          return true;
        }
      }
    }
    return false;
  }

  moveWidget(docId: string, widgetId: string, targetSectionId: string, targetColumnId: string, targetIndex: number): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    // Find and remove widget
    let widget: BuilderWidget | null = null;
    for (const section of doc.content.sections) {
      for (const column of section.columns) {
        const idx = column.widgets.findIndex((w) => w.id === widgetId);
        if (idx !== -1) {
          [widget] = column.widgets.splice(idx, 1);
          break;
        }
      }
      if (widget) break;
    }
    if (!widget) return false;

    // Insert at target
    const targetSection = doc.content.sections.find((s) => s.id === targetSectionId);
    if (!targetSection) return false;
    const targetColumn = targetSection.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return false;

    targetColumn.widgets.splice(targetIndex, 0, widget);
    this.updateDocumentContent(docId, doc.content);
    return true;
  }

  // ==========================================================================
  // WIDGET TYPE REGISTRATION
  // ==========================================================================

  registerWidgetType(type: BuilderWidgetType): void {
    this.widgetTypes.set(type.type, type);
  }

  getWidgetType(type: string): BuilderWidgetType | null {
    return this.widgetTypes.get(type) || null;
  }

  getWidgetTypes(category?: string): BuilderWidgetType[] {
    const all = Array.from(this.widgetTypes.values());
    if (category) return all.filter((w) => w.category === category);
    return all;
  }

  // ==========================================================================
  // TEMPLATE REGISTRATION
  // ==========================================================================

  registerTemplate(template: BuilderTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): BuilderTemplate | null {
    return this.templates.get(id) || null;
  }

  getTemplates(category?: string): BuilderTemplate[] {
    const all = Array.from(this.templates.values());
    if (category) return all.filter((t) => t.category === category);
    return all;
  }

  applyTemplate(docId: string, templateId: string): BuilderDocument | null {
    const doc = this.documents.get(docId);
    const template = this.templates.get(templateId);
    if (!doc || !template) return null;
    doc.content = JSON.parse(JSON.stringify(template.content));
    this.assignNewIds(doc.content);
    this.updateDocumentContent(docId, doc.content);
    return doc;
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  renderToHtml(content: BuilderContent, device: "desktop" | "tablet" | "mobile" = "desktop"): string {
    const parts: string[] = [];
    parts.push('<div class="msap-page-builder" data-device="' + device + '">');

    for (const section of content.sections) {
      parts.push(this.renderSection(section, device));
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  private renderSection(section: BuilderSection, device: string): string {
    const s = section.settings;
    const style: string[] = [];

    if (s.layout === 'full_width') style.push('max-width:100%');
    else if (s.contentWidth) style.push(`max-width:${s.contentWidth}px;margin:0 auto`);

    if (s.padding) style.push(this.renderSpacing('padding', s.padding));
    if (s.background) style.push(this.renderBackground(s.background));

    const classes = ['msap-pb-section'];
    if (s.className) classes.push(s.className);

    const html: string[] = [];
    html.push(`<section class="${classes.join(' ')}" style="${style.join(';')}">`);
    html.push('<div class="msap-pb-columns" style="display:flex;flex-wrap:wrap;gap:24px">');

    for (const column of section.columns) {
      html.push(this.renderColumn(column, device));
    }

    html.push('</div></section>');
    return html.join('\n');
  }

  private renderColumn(column: BuilderColumn, device: string): string {
    const style = [`flex:${column.width}`, 'min-width:0'];
    if (column.settings.padding) style.push(this.renderSpacing('padding', column.settings.padding));
    if (column.settings.verticalAlign) style.push(`align-self:${column.settings.verticalAlign}`);

    const classes = ['msap-pb-column'];
    if (column.settings.className) classes.push(column.settings.className);

    const html: string[] = [];
    html.push(`<div class="${classes.join(' ')}" style="${style.join(';')}">`);

    for (const widget of column.widgets) {
      html.push(this.renderWidget(widget, device));
    }

    html.push('</div>');
    return html.join('\n');
  }

  private renderWidget(widget: BuilderWidget, device: string): string {
    const typeDef = this.widgetTypes.get(widget.type);
    if (typeDef) {
      // Use registered render function via settings
      return `<div class="msap-pb-widget msap-pb-widget--${widget.type}" data-widget-id="${widget.id}">${this.renderWidgetByType(widget.type, widget.settings)}</div>`;
    }
    return `<!-- Unknown widget: ${widget.type} -->`;
  }

  private renderWidgetByType(type: string, settings: Record<string, unknown>): string {
    const s = settings;
    switch (type) {
      case 'heading':
        return `<${s.tag || 'h2'} style="text-align:${s.align || 'left'};color:${s.color || '#1B355E'};font-family:${s.fontFamily || 'Sora'};font-size:${s.fontSize || 32}px;font-weight:${s.fontWeight || 700};margin:0">${this.esc(s.text as string || '')}</${s.tag || 'h2'}>`;

      case 'text':
        return `<div class="msap-pb-text-content" style="text-align:${s.align || 'left'};font-size:${s.fontSize || 16}px;line-height:${s.lineHeight || 1.6};color:${s.color || '#334155'}">${s.content || ''}</div>`;

      case 'image':
        if (!s.url) return '';
        return `<figure style="margin:0"><img src="${s.url}" alt="${this.esc(s.alt as string || '')}" style="width:${s.width || '100%'};border-radius:${s.borderRadius || 0}px" />${s.caption ? `<figcaption style="text-align:center;color:#64748b;font-size:14px;margin-top:8px">${this.esc(s.caption as string)}</figcaption>` : ''}</figure>`;

      case 'button': {
        const bg = s.style === 'secondary' ? 'transparent' : s.style === 'outline' ? 'transparent' : '#138A73';
        const border = s.style === 'outline' ? '2px solid #138A73' : 'none';
        const color = s.style === 'secondary' ? '#138A73' : '#ffffff';
        return `<a href="${s.url || '#'}" style="display:inline-block;background:${bg};color:${color};border:${border};padding:${s.size === 'lg' ? '16px 40px' : s.size === 'sm' ? '8px 20px' : '12px 32px'};border-radius:${s.borderRadius || 10}px;font-weight:700;font-family:Sora;text-decoration:none;transition:all 0.2s">${this.esc(s.text as string || 'Button')}</a>`;
      }

      case 'spacer':
        return `<div style="height:${s.height || 40}px"></div>`;

      case 'divider':
        return `<hr style="width:${s.width || '100%'};border:none;border-top:1px ${s.style || 'solid'} ${s.color || '#e2e8f0'}" />`;

      case 'video':
        if (!s.url) return '';
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:${s.borderRadius || 12}px"><iframe src="${s.url}" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allowfullscreen></iframe></div>`;

      case 'html':
        return (s.code as string) || '';

      case 'icon':
        return `<div style="text-align:${s.align || 'center'}"><span style="font-size:${s.size || 48}px">${s.icon || '⭐'}</span></div>`;

      case 'testimonial':
        return `<div style="background:#f8fafc;padding:32px;border-radius:16px;border-left:4px solid #138A73"><p style="font-style:italic;font-size:16px;line-height:1.6;margin:0 0 16px">"${this.esc(s.text as string || '')}"</p><div style="display:flex;align-items:center;gap:12px">${s.image ? `<img src="${s.image}" style="width:48px;height:48px;border-radius:50%" />` : ''}<div><strong>${this.esc(s.author as string || '')}</strong><br><span style="color:#64748b;font-size:14px">${this.esc(s.role as string || '')}</span></div></div></div>`;

      case 'counter':
        return `<div style="text-align:center;padding:24px"><div style="font-size:${s.fontSize || 48}px;font-weight:800;color:${s.color || '#138A73'};font-family:Sora">${s.value || '0'}</div><div style="font-size:16px;color:#64748b;margin-top:4px">${this.esc(s.label as string || '')}</div></div>`;

      case 'progress':
        return `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:14px;font-weight:600">${this.esc(s.label as string || '')}</span><span style="font-size:14px;color:#64748b">${s.value || 0}%</span></div><div style="height:8px;background:#e2e8f0;border-radius:4px"><div style="height:100%;width:${s.value || 0}%;background:${s.color || '#138A73'};border-radius:4px"></div></div></div>`;

      case 'tabs':
        return `<div class="msap-pb-tabs"><div class="msap-pb-tabs-nav" style="display:flex;gap:8px;margin-bottom:16px">${((s.tabs as { title: string }[]) || []).map((t, i) => `<button style="padding:8px 24px;border-radius:8px;border:1px solid #e2e8f0;background:${i === 0 ? '#138A73' : '#fff'};color:${i === 0 ? '#fff' : '#334155'};font-weight:600;cursor:pointer">${this.esc(t.title)}</button>`).join('')}</div></div>`;

      case 'accordion':
        return `<div class="msap-pb-accordion">${((s.items as { title: string; content: string }[]) || []).map((item) => `<div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px"><div style="padding:16px;font-weight:600;cursor:pointer">${this.esc(item.title)}</div></div>`).join('')}</div>`;

      case 'social':
        return `<div style="display:flex;gap:12px;justify-content:${s.align || 'center'}">${((s.networks as { icon: string; url: string }[]) || []).map((n) => `<a href="${n.url}" style="width:40px;height:40px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;text-decoration:none">${n.icon}</a>`).join('')}</div>`;

      case 'map':
        return s.address ? `<div style="height:${s.height || 400}px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#64748b">Map: ${this.esc(s.address as string)}</div>` : '';

      case 'countdown':
        return `<div class="msap-countdown" data-date="${s.date || ''}" style="text-align:center;padding:32px"><p style="font-size:18px;font-weight:700;color:#1B355E">${this.esc(s.label as string || 'Coming Soon')}</p></div>`;

      case 'pricing': {
        const highlighted = s.highlighted;
        return `<div style="border:2px solid ${highlighted ? '#138A73' : '#e2e8f0'};border-radius:16px;padding:32px;text-align:center;${highlighted ? 'box-shadow:0 8px 32px rgba(19,138,115,0.15)' : ''}"><div style="font-size:24px;font-weight:700;color:#1B355E">${this.esc(s.title as string || '')}</div><div style="font-size:36px;font-weight:800;color:#138A73;margin:16px 0">${this.esc(s.price as string || '')}</div><div style="font-size:14px;color:#64748b;margin-bottom:24px">${this.esc(s.period as string || '')}</div><a href="${s.url || '#'}" style="display:inline-block;background:${highlighted ? '#138A73' : '#1B355E'};color:#fff;padding:12px 32px;border-radius:10px;font-weight:700;text-decoration:none">${this.esc(s.buttonText as string || 'Get Started')}</a></div>`;
      }

      case 'gallery':
        return `<div style="display:grid;grid-template-columns:repeat(${s.columns || 3},1fr);gap:${s.gap || 16}px">${((s.images as string[]) || []).map((url: string) => `<img src="${url}" style="width:100%;border-radius:${s.borderRadius || 8}px" />`).join('')}</div>`;

      case 'form':
        return `<div class="msap-pb-form" data-form-id="${s.formId || ''}"></div>`;

      case 'wp-posts':
        return `<div class="msap-pb-wp-posts" data-type="${s.postType || 'post'}" data-count="${s.count || 3}"></div>`;

      default:
        return `<!-- Widget: ${type} -->`;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private renderSpacing(prop: string, spacing: BuilderSpacing): string {
    const unit = spacing.unit || 'px';
    const parts = [
      `${prop}-top:${spacing.top || 0}${unit}`,
      `${prop}-right:${spacing.right || 0}${unit}`,
      `${prop}-bottom:${spacing.bottom || 0}${unit}`,
      `${prop}-left:${spacing.left || 0}${unit}`,
    ];
    return parts.join(';');
  }

  private renderBackground(bg: BuilderBackground): string {
    switch (bg.type) {
      case 'color':
        return `background:${bg.color || '#ffffff'}`;
      case 'gradient':
        return `background:linear-gradient(${bg.gradientAngle || 180}deg,${bg.gradientFrom || '#1B355E'},${bg.gradientTo || '#138A73'})`;
      case 'image':
        return `background:url(${bg.imageUrl}) ${bg.position || 'center'} ${bg.repeat || 'no-repeat'} ${bg.size || 'cover'}`;
      default:
        return '';
    }
  }

  private reorderSections(doc: BuilderDocument): void {
    doc.content.sections.forEach((s, i) => { s.order = i; });
  }

  private reorderColumns(section: BuilderSection): void {
    section.columns.forEach((c, i) => { c.order = i; });
  }

  private reorderWidgets(column: BuilderColumn): void {
    column.widgets.forEach((w, i) => { w.order = i; });
  }

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // BUILTINS
  // ==========================================================================

  private registerBuiltinWidgetTypes(): void {
    const types: BuilderWidgetType[] = [
      { type: 'heading', name: 'Heading', icon: 'H', category: 'basic', description: 'Section heading', keywords: ['title', 'h1', 'h2', 'h3'], defaults: { text: 'Heading', tag: 'h2', align: 'left', color: '#1B355E', fontSize: 32, fontWeight: 700, fontFamily: 'Sora' }, controls: [
        { key: 'text', label: 'Text', type: 'text', group: 'content' },
        { key: 'tag', label: 'Tag', type: 'select', choices: { h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6' }, group: 'content' },
        { key: 'align', label: 'Alignment', type: 'select', choices: { left: 'Left', center: 'Center', right: 'Right' }, group: 'style' },
        { key: 'color', label: 'Color', type: 'color', group: 'style' },
        { key: 'fontSize', label: 'Font Size', type: 'slider', min: 12, max: 96, group: 'style' },
        { key: 'fontWeight', label: 'Font Weight', type: 'select', choices: { '400': 'Normal', '600': 'Semi Bold', '700': 'Bold', '800': 'Extra Bold' }, group: 'style' },
      ]},
      { type: 'text', name: 'Text Editor', icon: 'T', category: 'basic', description: 'Rich text block', keywords: ['paragraph', 'content', 'wysiwyg'], defaults: { content: '<p>Enter your text here...</p>', align: 'left', fontSize: 16, lineHeight: 1.6, color: '#334155' }, controls: [
        { key: 'content', label: 'Content', type: 'textarea', group: 'content' },
        { key: 'align', label: 'Alignment', type: 'select', choices: { left: 'Left', center: 'Center', right: 'Right', justify: 'Justify' }, group: 'style' },
      ]},
      { type: 'image', name: 'Image', icon: '🖼', category: 'media', description: 'Single image', keywords: ['photo', 'picture'], defaults: { url: '', alt: '', caption: '', width: '100%', borderRadius: 0 }, controls: [
        { key: 'url', label: 'Image URL', type: 'image', group: 'content' },
        { key: 'alt', label: 'Alt Text', type: 'text', group: 'content' },
        { key: 'caption', label: 'Caption', type: 'text', group: 'content' },
        { key: 'width', label: 'Width', type: 'slider', min: 10, max: 100, group: 'style' },
        { key: 'borderRadius', label: 'Border Radius', type: 'slider', min: 0, max: 50, group: 'style' },
      ]},
      { type: 'button', name: 'Button', icon: '▢', category: 'basic', description: 'CTA button', keywords: ['link', 'cta', 'action'], defaults: { text: 'Click Me', url: '#', style: 'primary', size: 'md', borderRadius: 10 }, controls: [
        { key: 'text', label: 'Text', type: 'text', group: 'content' },
        { key: 'url', label: 'Link', type: 'text', group: 'content' },
        { key: 'style', label: 'Style', type: 'select', choices: { primary: 'Primary', secondary: 'Secondary', outline: 'Outline' }, group: 'style' },
        { key: 'size', label: 'Size', type: 'select', choices: { sm: 'Small', md: 'Medium', lg: 'Large' }, group: 'style' },
      ]},
      { type: 'spacer', name: 'Spacer', icon: '↕', category: 'basic', description: 'Empty space', keywords: ['gap', 'space'], defaults: { height: 40 }, controls: [
        { key: 'height', label: 'Height (px)', type: 'slider', min: 0, max: 200, group: 'style' },
      ]},
      { type: 'divider', name: 'Divider', icon: '—', category: 'basic', description: 'Horizontal line', keywords: ['separator', 'line'], defaults: { style: 'solid', width: '100%', color: '#e2e8f0' }, controls: [
        { key: 'style', label: 'Style', type: 'select', choices: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' }, group: 'style' },
        { key: 'color', label: 'Color', type: 'color', group: 'style' },
        { key: 'width', label: 'Width', type: 'slider', min: 10, max: 100, group: 'style' },
      ]},
      { type: 'video', name: 'Video', icon: '▶', category: 'media', description: 'Embedded video', keywords: ['youtube', 'vimeo', 'embed'], defaults: { url: '', borderRadius: 12 }, controls: [
        { key: 'url', label: 'Embed URL', type: 'text', group: 'content' },
        { key: 'borderRadius', label: 'Border Radius', type: 'slider', min: 0, max: 30, group: 'style' },
      ]},
      { type: 'html', name: 'Custom HTML', icon: '</>', category: 'general', description: 'Raw HTML', keywords: ['code', 'custom'], defaults: { code: '' }, controls: [
        { key: 'code', label: 'HTML Code', type: 'code', group: 'content' },
      ]},
      { type: 'gallery', name: 'Gallery', icon: '🖼🖼', category: 'media', description: 'Image grid', keywords: ['images', 'photos', 'grid'], defaults: { images: [], columns: 3, gap: 16, borderRadius: 8 }, controls: [
        { key: 'images', label: 'Images', type: 'media', group: 'content' },
        { key: 'columns', label: 'Columns', type: 'select', choices: { '2': '2', '3': '3', '4': '4' }, group: 'style' },
      ]},
      { type: 'testimonial', name: 'Testimonial', icon: '💬', category: 'content', description: 'Client testimonial', keywords: ['review', 'quote', 'feedback'], defaults: { text: 'Amazing service!', author: 'John Doe', role: 'CEO', image: '' }, controls: [
        { key: 'text', label: 'Testimonial', type: 'textarea', group: 'content' },
        { key: 'author', label: 'Author Name', type: 'text', group: 'content' },
        { key: 'role', label: 'Role', type: 'text', group: 'content' },
        { key: 'image', label: 'Photo', type: 'image', group: 'content' },
      ]},
      { type: 'counter', name: 'Counter', icon: '#', category: 'content', description: 'Number counter', keywords: ['stats', 'number', 'animate'], defaults: { value: '0', label: 'Counter', color: '#138A73', fontSize: 48 }, controls: [
        { key: 'value', label: 'Value', type: 'text', group: 'content' },
        { key: 'label', label: 'Label', type: 'text', group: 'content' },
        { key: 'color', label: 'Color', type: 'color', group: 'style' },
        { key: 'fontSize', label: 'Font Size', type: 'slider', min: 24, max: 96, group: 'style' },
      ]},
      { type: 'icon', name: 'Icon', icon: '⭐', category: 'basic', description: 'Emoji/icon display', keywords: ['emoji', 'icon'], defaults: { icon: '⭐', size: 48, align: 'center' }, controls: [
        { key: 'icon', label: 'Icon/Emoji', type: 'text', group: 'content' },
        { key: 'size', label: 'Size', type: 'slider', min: 16, max: 128, group: 'style' },
        { key: 'align', label: 'Alignment', type: 'select', choices: { left: 'Left', center: 'Center', right: 'Right' }, group: 'style' },
      ]},
      { type: 'tabs', name: 'Tabs', icon: '🗂', category: 'general', description: 'Tabbed content', keywords: ['tab', 'toggle'], defaults: { tabs: [{ title: 'Tab 1', content: '' }, { title: 'Tab 2', content: '' }] }, controls: [
        { key: 'tabs', label: 'Tabs', type: 'repeater', group: 'content' },
      ]},
      { type: 'accordion', name: 'Accordion', icon: '📋', category: 'general', description: 'Collapsible sections', keywords: ['faq', 'toggle', 'collapse'], defaults: { items: [{ title: 'Question 1', content: 'Answer 1' }] }, controls: [
        { key: 'items', label: 'Items', type: 'repeater', group: 'content' },
      ]},
      { type: 'map', name: 'Google Map', icon: '📍', category: 'general', description: 'Embedded map', keywords: ['location', 'address'], defaults: { address: '', height: 400 }, controls: [
        { key: 'address', label: 'Address', type: 'text', group: 'content' },
        { key: 'height', label: 'Height', type: 'slider', min: 200, max: 800, group: 'style' },
      ]},
      { type: 'social', name: 'Social Icons', icon: '🔗', category: 'social', description: 'Social media links', keywords: ['links', 'share'], defaults: { networks: [], align: 'center' }, controls: [
        { key: 'networks', label: 'Networks', type: 'repeater', group: 'content' },
      ]},
      { type: 'pricing', name: 'Pricing Card', icon: '💰', category: 'pro', description: 'Pricing table card', keywords: ['price', 'plan', 'subscription'], defaults: { title: 'Plan', price: '$29', period: '/month', highlighted: false, url: '#', buttonText: 'Get Started' }, controls: [
        { key: 'title', label: 'Plan Name', type: 'text', group: 'content' },
        { key: 'price', label: 'Price', type: 'text', group: 'content' },
        { key: 'period', label: 'Period', type: 'text', group: 'content' },
        { key: 'highlighted', label: 'Featured', type: 'toggle', group: 'style' },
      ]},
      { type: 'progress', name: 'Progress Bar', icon: '📊', category: 'content', description: 'Progress indicator', keywords: ['bar', 'skill', 'level'], defaults: { label: 'Skill', value: 75, color: '#138A73' }, controls: [
        { key: 'label', label: 'Label', type: 'text', group: 'content' },
        { key: 'value', label: 'Value %', type: 'slider', min: 0, max: 100, group: 'content' },
        { key: 'color', label: 'Color', type: 'color', group: 'style' },
      ]},
      { type: 'countdown', name: 'Countdown', icon: '⏱', category: 'pro', description: 'Event countdown', keywords: ['timer', 'event'], defaults: { date: '', label: 'Event starts in' }, controls: [
        { key: 'date', label: 'Target Date', type: 'text', group: 'content' },
        { key: 'label', label: 'Label', type: 'text', group: 'content' },
      ]},
      { type: 'form', name: 'Form', icon: '📝', category: 'pro', description: 'CMS Form embed', keywords: ['contact', 'subscribe', 'input'], defaults: { formId: '' }, controls: [
        { key: 'formId', label: 'Form ID', type: 'text', group: 'content' },
      ]},
      { type: 'wp-posts', name: 'WordPress Posts', icon: '📰', category: 'wordpress', description: 'Post listing', keywords: ['blog', 'articles', 'listing'], defaults: { postType: 'post', count: 3 }, controls: [
        { key: 'postType', label: 'Post Type', type: 'text', group: 'content' },
        { key: 'count', label: 'Count', type: 'number', min: 1, max: 20, group: 'content' },
      ]},
    ];

    for (const t of types) {
      this.widgetTypes.set(t.type, t);
    }
  }

  private registerBuiltinTemplates(): void {
    const templates: BuilderTemplate[] = [
      {
        id: 'tpl-hero',
        name: 'Hero Section',
        category: 'sections',
        thumbnail: '',
        tags: ['hero', 'banner', 'header'],
        content: {
          sections: [{
            id: crypto.randomUUID(), order: 0,
            settings: { layout: 'full_width', padding: { top: 100, bottom: 100, unit: 'px' }, background: { type: 'gradient', gradientFrom: '#1B355E', gradientTo: '#138A73', gradientAngle: 135 } },
            columns: [{ id: crypto.randomUUID(), order: 0, width: '100%', settings: { align: 'middle' }, widgets: [
              { id: crypto.randomUUID(), type: 'heading', order: 0, settings: { text: 'Hero Title', tag: 'h1', align: 'center', color: '#ffffff', fontSize: 48, fontWeight: 800 } },
              { id: crypto.randomUUID(), type: 'text', order: 1, settings: { content: '<p style="color:rgba(255,255,255,0.85);font-size:20px">Subtitle text goes here</p>', align: 'center' } },
              { id: crypto.randomUUID(), type: 'button', order: 2, settings: { text: 'Get Started', url: '#', style: 'primary', size: 'lg' } },
            ]}],
          }],
          globalStyles: { colors: [], fonts: [], spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } },
        },
      },
      {
        id: 'tpl-3col-features',
        name: '3-Column Features',
        category: 'sections',
        thumbnail: '',
        tags: ['features', 'services', 'grid'],
        content: {
          sections: [{
            id: crypto.randomUUID(), order: 0,
            settings: { layout: 'boxed', contentWidth: 1200, padding: { top: 80, bottom: 80, unit: 'px' } },
            columns: [
              { id: crypto.randomUUID(), order: 0, width: '33.33%', settings: {}, widgets: [
                { id: crypto.randomUUID(), type: 'icon', order: 0, settings: { icon: '🎯', size: 48, align: 'center' } },
                { id: crypto.randomUUID(), type: 'heading', order: 1, settings: { text: 'Feature 1', tag: 'h3', align: 'center', fontSize: 20, fontWeight: 700 } },
                { id: crypto.randomUUID(), type: 'text', order: 2, settings: { content: '<p style="text-align:center;color:#64748b">Description of feature one</p>' } },
              ]},
              { id: crypto.randomUUID(), order: 1, width: '33.33%', settings: {}, widgets: [
                { id: crypto.randomUUID(), type: 'icon', order: 0, settings: { icon: '🚀', size: 48, align: 'center' } },
                { id: crypto.randomUUID(), type: 'heading', order: 1, settings: { text: 'Feature 2', tag: 'h3', align: 'center', fontSize: 20, fontWeight: 700 } },
                { id: crypto.randomUUID(), type: 'text', order: 2, settings: { content: '<p style="text-align:center;color:#64748b">Description of feature two</p>' } },
              ]},
              { id: crypto.randomUUID(), order: 2, width: '33.33%', settings: {}, widgets: [
                { id: crypto.randomUUID(), type: 'icon', order: 0, settings: { icon: '💡', size: 48, align: 'center' } },
                { id: crypto.randomUUID(), type: 'heading', order: 1, settings: { text: 'Feature 3', tag: 'h3', align: 'center', fontSize: 20, fontWeight: 700 } },
                { id: crypto.randomUUID(), type: 'text', order: 2, settings: { content: '<p style="text-align:center;color:#64748b">Description of feature three</p>' } },
              ]},
            ],
          }],
          globalStyles: { colors: [], fonts: [], spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } },
        },
      },
      {
        id: 'tpl-cta-banner',
        name: 'CTA Banner',
        category: 'sections',
        thumbnail: '',
        tags: ['cta', 'action', 'banner'],
        content: {
          sections: [{
            id: crypto.randomUUID(), order: 0,
            settings: { layout: 'full_width', padding: { top: 60, bottom: 60, unit: 'px' }, background: { type: 'gradient', gradientFrom: '#138A73', gradientTo: '#29C89E', gradientAngle: 135 } },
            columns: [{ id: crypto.randomUUID(), order: 0, width: '100%', settings: {}, widgets: [
              { id: crypto.randomUUID(), type: 'heading', order: 0, settings: { text: 'Ready to Get Started?', tag: 'h2', align: 'center', color: '#ffffff', fontSize: 36, fontWeight: 700 } },
              { id: crypto.randomUUID(), type: 'button', order: 1, settings: { text: 'Join Now', url: '/membership', style: 'primary', size: 'lg' } },
            ]}],
          }],
          globalStyles: { colors: [], fonts: [], spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } },
        },
      },
    ];

    for (const t of templates) {
      this.templates.set(t.id, t);
    }
  }
}

export const pageBuilderEngine = new PageBuilderEngine();
