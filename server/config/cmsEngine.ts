/**
 * CMS Core Engine
 *
 * Full content management system: pages, posts, media, menus, widgets,
 * themes, plugins, forms, revisions, redirects, SEO, custom post types.
 *
 * Architecture:
 * - Every entity is stored in-memory (same pattern as other engines)
 * - Supports full CRUD, revision history, slug resolution
 * - WordPress-compatible hook/filter system
 * - Theme-aware rendering pipeline
 */

import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: PageBuilderContent | null;
  contentHtml: string | null;
  excerpt: string | null;
  template: string;
  status: "draft" | "published" | "archived" | "trashed";
  authorId: string | null;
  parentId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  schema: Record<string, unknown> | null;
  customFields: Record<string, unknown>;
  templateData: Record<string, unknown>;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CmsPost {
  id: string;
  slug: string;
  title: string;
  content: PageBuilderContent | null;
  contentHtml: string | null;
  excerpt: string | null;
  featuredImage: string | null;
  status: "draft" | "published" | "archived" | "trashed";
  authorId: string | null;
  postType: string;
  metaTitle: string | null;
  metaDescription: string | null;
  customFields: Record<string, unknown>;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageBuilderContent {
  /** Array of sections (rows), each containing columns and widgets */
  sections: PageBuilderSection[];
  /** Global settings: colors, fonts, spacing */
  globalSettings?: Record<string, unknown>;
}

export interface PageBuilderSection {
  id: string;
  type: "section" | "container";
  settings: Record<string, unknown>;
  columns: PageBuilderColumn[];
}

export interface PageBuilderColumn {
  id: string;
  width: string; // e.g., "50%", "33.33%"
  settings: Record<string, unknown>;
  widgets: PageBuilderWidget[];
}

export interface PageBuilderWidget {
  id: string;
  type: string; // heading, text, image, gallery, button, form, video, map, html, divider, spacer, columns, tabs, accordion, icon, social, testimonial, pricing, countdown, etc.
  settings: Record<string, unknown>;
}

export interface CmsMediaItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  caption: string | null;
  description: string | null;
  folder: string;
  tags: string[];
  uploadedBy: string | null;
  createdAt: Date;
}

export interface CmsMenuItem {
  id: string;
  label: string;
  url: string;
  target?: string;
  className?: string;
  children?: CmsMenuItem[];
}

export interface CmsMenu {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  items: CmsMenuItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CmsTheme {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  description: string | null;
  author: string | null;
  screenshot: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  customCss: string | null;
  headerHtml: string | null;
  footerHtml: string | null;
  templates: Record<string, { name: string; file: string }>;
  widgetAreas: string[];
  menus: string[];
  installedAt: Date;
  updatedAt: Date;
}

export interface CmsPlugin {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  description: string | null;
  author: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  hooks: { filters: Record<string, string[]>; actions: Record<string, string[]> };
  permissions: string[];
  dependencies: string[];
  installedAt: Date;
  updatedAt: Date;
}

export interface CmsRevision {
  id: string;
  entityType: string;
  entityId: string;
  content: unknown;
  authorId: string | null;
  summary: string | null;
  createdAt: Date;
}

export interface CmsRedirect {
  id: string;
  from: string;
  to: string;
  type: "301" | "302" | "307";
  isActive: boolean;
  hitCount: number;
  createdAt: Date;
}

export interface CmsForm {
  id: string;
  slug: string;
  title: string;
  fields: FormField[];
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  choices?: Record<string, string>;
  [key: string]: unknown;
}

export interface CmsFormSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CmsPostType {
  id: string;
  slug: string;
  name: string;
  plural: string;
  icon: string | null;
  supports: string[];
  fields: Record<string, unknown>[];
  taxonomies: string[];
  menuPosition: number;
  isPublic: boolean;
  hasArchive: boolean;
  createdAt: Date;
}

export interface CmsTaxonomy {
  id: string;
  slug: string;
  name: string;
  plural: string;
  postTypes: string[];
  hierarchical: boolean;
  createdAt: Date;
}

export interface CmsTerm {
  id: string;
  taxonomyId: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  count: number;
  createdAt: Date;
}

export interface CmsWidget {
  id: string;
  slug: string;
  name: string;
  type: string;
  content: Record<string, unknown>;
  sidebar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// HOOK / FILTER SYSTEM (WordPress-compatible)
// ============================================================================

export type HookCallback = (...args: unknown[]) => unknown;

class HookSystem {
  private filters: Map<string, HookCallback[]> = new Map();
  private actions: Map<string, HookCallback[]> = new Map();

  addFilter(hook: string, callback: HookCallback, priority = 10): void {
    if (!this.filters.has(hook)) this.filters.set(hook, []);
    this.filters.get(hook)!.push(callback);
    this.filters.get(hook)!.sort(() => priority - priority); // stable sort
  }

  applyFilters(hook: string, value: unknown, ...args: unknown[]): unknown {
    const callbacks = this.filters.get(hook) || [];
    let result = value;
    for (const cb of callbacks) {
      result = cb(result, ...args);
    }
    return result;
  }

  addAction(hook: string, callback: HookCallback): void {
    if (!this.actions.has(hook)) this.actions.set(hook, []);
    this.actions.get(hook)!.push(callback);
  }

  doAction(hook: string, ...args: unknown[]): void {
    const callbacks = this.actions.get(hook) || [];
    for (const cb of callbacks) {
      cb(...args);
    }
  }

  removeFilter(hook: string, callback: HookCallback): void {
    const callbacks = this.filters.get(hook) || [];
    this.filters.set(hook, callbacks.filter((cb) => cb !== callback));
  }

  removeAction(hook: string, callback: HookCallback): void {
    const callbacks = this.actions.get(hook) || [];
    this.actions.set(hook, callbacks.filter((cb) => cb !== callback));
  }
}

// ============================================================================
// SHORTCODE SYSTEM
// ============================================================================

export type ShortcodeCallback = (attrs: Record<string, string>, content: string | null) => string;

class ShortcodeSystem {
  private shortcodes: Map<string, ShortcodeCallback> = new Map();

  register(tag: string, callback: ShortcodeCallback): void {
    this.shortcodes.set(tag, callback);
  }

  unregister(tag: string): void {
    this.shortcodes.delete(tag);
  }

  /** Parse [tag attr="val"]content[/tag] and [tag attr="val"] */
  render(html: string): string {
    // Match [shortcode ...] and [shortcode ...]...[/shortcode]
    const regex = /\[([a-z_]+)(\s+[^\]]*?)?\](?:\[\/\1\])?/gi;
    return html.replace(regex, (match, tag: string, attrStr: string | undefined) => {
      const cb = this.shortcodes.get(tag.toLowerCase());
      if (!cb) return match;

      const attrs = this.parseAttributes(attrStr || "");
      // Check for closing tag content
      const closeRegex = new RegExp(`\\[${tag}\\s*[\\s\\S]*?\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
      const closeMatch = html.match(closeRegex);
      const content = closeMatch ? closeMatch[1] : null;

      return cb(attrs, content);
    });
  }

  private parseAttributes(str: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = /(\w+)=["']([^"']*)["']/g;
    let m;
    while ((m = regex.exec(str))) {
      attrs[m[1]] = m[2];
    }
    return attrs;
  }
}

// ============================================================================
// PAGE BUILDER WIDGET REGISTRY
// ============================================================================

export interface WidgetDefinition {
  type: string;
  name: string;
  icon: string;
  category: "basic" | "general" | "pro" | "wordpress";
  description: string;
  defaults: Record<string, unknown>;
  render: (settings: Record<string, unknown>) => string;
}

class WidgetRegistry {
  private widgets: Map<string, WidgetDefinition> = new Map();

  register(def: WidgetDefinition): void {
    this.widgets.set(def.type, def);
  }

  unregister(type: string): void {
    this.widgets.delete(type);
  }

  get(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  getByCategory(category: string): WidgetDefinition[] {
    return this.getAll().filter((w) => w.category === category);
  }
}

// ============================================================================
// CMS ENGINE
// ============================================================================

class CMSEngine {
  readonly hooks = new HookSystem();
  readonly shortcodes = new ShortcodeSystem();
  readonly widgets = new WidgetRegistry();

  // Content stores
  private pages: Map<string, CmsPage> = new Map();
  private posts: Map<string, CmsPost> = new Map();
  private media: Map<string, CmsMediaItem> = new Map();
  private menus: Map<string, CmsMenu> = new Map();
  private themes: Map<string, CmsTheme> = new Map();
  private plugins: Map<string, CmsPlugin> = new Map();
  private revisions: CmsRevision[] = [];
  private redirects: Map<string, CmsRedirect> = new Map();
  private forms: Map<string, CmsForm> = new Map();
  private formSubmissions: Map<string, CmsFormSubmission> = new Map();
  private postTypes: Map<string, CmsPostType> = new Map();
  private customPostData: Map<string, Map<string, Record<string, unknown>>> = new Map();
  private taxonomies: Map<string, CmsTaxonomy> = new Map();
  private terms: Map<string, CmsTerm> = new Map();
  private widgetsStore: Map<string, CmsWidget> = new Map();
  private fieldGroups: Map<string, { id: string; slug: string; name: string; fields: unknown[]; location: unknown[]; menuOrder: number }> = new Map();

  constructor() {
    this.registerBuiltinWidgets();
    this.registerBuiltinShortcodes();
    this.seedDefaults();
  }

  // ==========================================================================
  // PAGES
  // ==========================================================================

  createPage(data: Omit<CmsPage, "id" | "createdAt" | "updatedAt">): CmsPage {
    const id = crypto.randomUUID();
    const now = new Date();
    const page: CmsPage = { ...data, id, createdAt: now, updatedAt: now };
    this.pages.set(id, page);
    this.hooks.doAction("cms.page.created", page);
    return page;
  }

  updatePage(id: string, data: Partial<CmsPage>): CmsPage | null {
    const existing = this.pages.get(id);
    if (!existing) return null;
    this.saveRevision("page", id, existing);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.pages.set(id, updated);
    this.hooks.doAction("cms.page.updated", updated);
    return updated;
  }

  getPage(id: string): CmsPage | null {
    return this.pages.get(id) || null;
  }

  getPageBySlug(slug: string): CmsPage | null {
    for (const page of Array.from(this.pages.values())) {
      if (page.slug === slug) return page;
    }
    return null;
  }

  listPages(filters?: { status?: string; authorId?: string; parentId?: string }): CmsPage[] {
    let result = Array.from(this.pages.values());
    if (filters?.status) result = result.filter((p) => p.status === filters.status);
    if (filters?.authorId) result = result.filter((p) => p.authorId === filters.authorId);
    if (filters?.parentId) result = result.filter((p) => p.parentId === filters.parentId);
    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deletePage(id: string): boolean {
    const page = this.pages.get(id);
    if (!page) return false;
    this.saveRevision("page", id, page);
    this.pages.delete(id);
    this.hooks.doAction("cms.page.deleted", page);
    return true;
  }

  trashPage(id: string): CmsPage | null {
    return this.updatePage(id, { status: "trashed" });
  }

  restorePage(id: string): CmsPage | null {
    return this.updatePage(id, { status: "draft" });
  }

  // ==========================================================================
  // POSTS
  // ==========================================================================

  createPost(data: Omit<CmsPost, "id" | "createdAt" | "updatedAt">): CmsPost {
    const id = crypto.randomUUID();
    const now = new Date();
    const post: CmsPost = { ...data, id, createdAt: now, updatedAt: now };
    this.posts.set(id, post);
    this.hooks.doAction("cms.post.created", post);
    return post;
  }

  updatePost(id: string, data: Partial<CmsPost>): CmsPost | null {
    const existing = this.posts.get(id);
    if (!existing) return null;
    this.saveRevision("post", id, existing);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.posts.set(id, updated);
    return updated;
  }

  getPost(id: string): CmsPost | null {
    return this.posts.get(id) || null;
  }

  getPostBySlug(slug: string): CmsPost | null {
    for (const post of Array.from(this.posts.values())) {
      if (post.slug === slug) return post;
    }
    return null;
  }

  listPosts(filters?: { status?: string; postType?: string; authorId?: string }): CmsPost[] {
    let result = Array.from(this.posts.values());
    if (filters?.status) result = result.filter((p) => p.status === filters.status);
    if (filters?.postType) result = result.filter((p) => p.postType === filters.postType);
    if (filters?.authorId) result = result.filter((p) => p.authorId === filters.authorId);
    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deletePost(id: string): boolean {
    const post = this.posts.get(id);
    if (!post) return false;
    this.saveRevision("post", id, post);
    this.posts.delete(id);
    return true;
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  addMedia(data: Omit<CmsMediaItem, "id" | "createdAt">): CmsMediaItem {
    const id = crypto.randomUUID();
    const item: CmsMediaItem = { ...data, id, createdAt: new Date() };
    this.media.set(id, item);
    return item;
  }

  getMedia(id: string): CmsMediaItem | null {
    return this.media.get(id) || null;
  }

  listMedia(filters?: { folder?: string; mimeType?: string; tags?: string[] }): CmsMediaItem[] {
    let result = Array.from(this.media.values());
    if (filters?.folder) result = result.filter((m) => m.folder === filters.folder);
    if (filters?.mimeType) result = result.filter((m) => m.mimeType.startsWith(filters.mimeType!));
    if (filters?.tags?.length) result = result.filter((m) => filters.tags!.some((t) => m.tags.includes(t)));
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteMedia(id: string): boolean {
    return this.media.delete(id);
  }

  /** Get all unique media folders */
  getMediaFolders(): string[] {
    const folders = new Set<string>();
    for (const item of Array.from(this.media.values())) folders.add(item.folder);
    return Array.from(folders).sort();
  }

  // ==========================================================================
  // MENUS
  // ==========================================================================

  createMenu(data: Omit<CmsMenu, "id" | "createdAt" | "updatedAt">): CmsMenu {
    const id = crypto.randomUUID();
    const now = new Date();
    const menu: CmsMenu = { ...data, id, createdAt: now, updatedAt: now };
    this.menus.set(id, menu);
    return menu;
  }

  updateMenu(id: string, data: Partial<CmsMenu>): CmsMenu | null {
    const existing = this.menus.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.menus.set(id, updated);
    return updated;
  }

  getMenu(id: string): CmsMenu | null {
    return this.menus.get(id) || null;
  }

  getMenuBySlug(slug: string): CmsMenu | null {
    for (const menu of Array.from(this.menus.values())) {
      if (menu.slug === slug) return menu;
    }
    return null;
  }

  getMenuByLocation(location: string): CmsMenu | null {
    for (const menu of Array.from(this.menus.values())) {
      if (menu.location === location) return menu;
    }
    return null;
  }

  listMenus(): CmsMenu[] {
    return Array.from(this.menus.values());
  }

  deleteMenu(id: string): boolean {
    return this.menus.delete(id);
  }

  // ==========================================================================
  // THEMES
  // ==========================================================================

  installTheme(data: Omit<CmsTheme, "id" | "installedAt" | "updatedAt">): CmsTheme {
    const id = crypto.randomUUID();
    const now = new Date();
    const theme: CmsTheme = { ...data, id, installedAt: now, updatedAt: now };
    this.themes.set(id, theme);
    return theme;
  }

  activateTheme(id: string): CmsTheme | null {
    const theme = this.themes.get(id);
    if (!theme) return null;
    // Deactivate all others
    for (const t of Array.from(this.themes.values())) {
      this.themes.set(t.id, { ...t, isActive: false });
    }
    const activated = { ...theme, isActive: true, updatedAt: new Date() };
    this.themes.set(id, activated);
    return activated;
  }

  updateThemeSettings(id: string, settings: Record<string, unknown>): CmsTheme | null {
    const theme = this.themes.get(id);
    if (!theme) return null;
    const updated = { ...theme, settings: { ...theme.settings, ...settings }, updatedAt: new Date() };
    this.themes.set(id, updated);
    return updated;
  }

  getActiveTheme(): CmsTheme | null {
    for (const theme of Array.from(this.themes.values())) {
      if (theme.isActive) return theme;
    }
    return null;
  }

  getTheme(id: string): CmsTheme | null {
    return this.themes.get(id) || null;
  }

  listThemes(): CmsTheme[] {
    return Array.from(this.themes.values());
  }

  uninstallTheme(id: string): boolean {
    const theme = this.themes.get(id);
    if (!theme || theme.isActive) return false;
    this.themes.delete(id);
    return true;
  }

  // ==========================================================================
  // PLUGINS
  // ==========================================================================

  installPlugin(data: Omit<CmsPlugin, "id" | "installedAt" | "updatedAt">): CmsPlugin {
    const id = crypto.randomUUID();
    const now = new Date();
    const plugin: CmsPlugin = { ...data, id, installedAt: now, updatedAt: now };
    this.plugins.set(id, plugin);
    return plugin;
  }

  activatePlugin(id: string): CmsPlugin | null {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;
    // Check dependencies
    for (const dep of plugin.dependencies) {
      const depPlugin = Array.from(this.plugins.values()).find((p) => p.slug === dep);
      if (!depPlugin || !depPlugin.isActive) {
        throw new Error(`Dependency "${dep}" is not active`);
      }
    }
    const activated = { ...plugin, isActive: true, updatedAt: new Date() };
    this.plugins.set(id, activated);
    this.hooks.doAction("cms.plugin.activated", activated);
    return activated;
  }

  deactivatePlugin(id: string): CmsPlugin | null {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;
    // Check if other active plugins depend on this
    for (const p of Array.from(this.plugins.values())) {
      if (p.isActive && p.dependencies.includes(plugin.slug)) {
        throw new Error(`Plugin "${p.name}" depends on "${plugin.name}"`);
      }
    }
    const deactivated = { ...plugin, isActive: false, updatedAt: new Date() };
    this.plugins.set(id, deactivated);
    this.hooks.doAction("cms.plugin.deactivated", deactivated);
    return deactivated;
  }

  getPlugin(id: string): CmsPlugin | null {
    return this.plugins.get(id) || null;
  }

  listPlugins(): CmsPlugin[] {
    return Array.from(this.plugins.values());
  }

  uninstallPlugin(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.isActive) return false;
    this.plugins.delete(id);
    return true;
  }

  // ==========================================================================
  // CUSTOM POST TYPES
  // ==========================================================================

  registerPostType(data: Omit<CmsPostType, "id" | "createdAt">): CmsPostType {
    const id = crypto.randomUUID();
    const pt: CmsPostType = { ...data, id, createdAt: new Date() };
    this.postTypes.set(id, pt);
    this.customPostData.set(data.slug, new Map());
    return pt;
  }

  getPostType(slug: string): CmsPostType | null {
    for (const pt of Array.from(this.postTypes.values())) {
      if (pt.slug === slug) return pt;
    }
    return null;
  }

  listPostTypes(): CmsPostType[] {
    return Array.from(this.postTypes.values());
  }

  /** Create a custom post entry */
  createCustomPost(typeSlug: string, data: Record<string, unknown>): Record<string, unknown> & { id: string } {
    const store = this.customPostData.get(typeSlug);
    if (!store) throw new Error(`Post type "${typeSlug}" not found`);
    const id = crypto.randomUUID();
    const entry = { ...data, id, createdAt: new Date() };
    store.set(id, entry);
    return entry;
  }

  listCustomPosts(typeSlug: string): Record<string, unknown>[] {
    const store = this.customPostData.get(typeSlug);
    if (!store) return [];
    return Array.from(store.values());
  }

  // ==========================================================================
  // TAXONOMIES
  // ==========================================================================

  registerTaxonomy(data: Omit<CmsTaxonomy, "id" | "createdAt">): CmsTaxonomy {
    const id = crypto.randomUUID();
    const tax: CmsTaxonomy = { ...data, id, createdAt: new Date() };
    this.taxonomies.set(id, tax);
    return tax;
  }

  listTaxonomies(): CmsTaxonomy[] {
    return Array.from(this.taxonomies.values());
  }

  createTerm(taxonomyId: string, name: string, slug: string, parentId?: string): CmsTerm {
    const id = crypto.randomUUID();
    const term: CmsTerm = { id, taxonomyId, name, slug, description: null, parentId: parentId || null, count: 0, createdAt: new Date() };
    this.terms.set(id, term);
    return term;
  }

  listTerms(taxonomyId: string): CmsTerm[] {
    return Array.from(this.terms.values()).filter((t) => t.taxonomyId === taxonomyId);
  }

  // ==========================================================================
  // FORMS
  // ==========================================================================

  createForm(data: Omit<CmsForm, "id" | "createdAt" | "updatedAt">): CmsForm {
    const id = crypto.randomUUID();
    const now = new Date();
    const form: CmsForm = { ...data, id, createdAt: now, updatedAt: now };
    this.forms.set(id, form);
    return form;
  }

  getForm(id: string): CmsForm | null {
    return this.forms.get(id) || null;
  }

  getFormBySlug(slug: string): CmsForm | null {
    for (const f of Array.from(this.forms.values())) {
      if (f.slug === slug) return f;
    }
    return null;
  }

  listForms(): CmsForm[] {
    return Array.from(this.forms.values());
  }

  submitForm(formId: string, data: Record<string, unknown>, ipAddress?: string, userAgent?: string): CmsFormSubmission {
    const form = this.forms.get(formId);
    if (!form) throw new Error("Form not found");
    const id = crypto.randomUUID();
    const submission: CmsFormSubmission = { id, formId, data, ipAddress: ipAddress || null, userAgent: userAgent || null, createdAt: new Date() };
    this.formSubmissions.set(id, submission);
    this.hooks.doAction("cms.form.submitted", submission, form);
    return submission;
  }

  getFormSubmissions(formId: string): CmsFormSubmission[] {
    return Array.from(this.formSubmissions.values())
      .filter((s) => s.formId === formId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ==========================================================================
  // REDIRECTS
  // ==========================================================================

  addRedirect(from: string, to: string, type: "301" | "302" | "307" = "301"): CmsRedirect {
    const id = crypto.randomUUID();
    const redirect: CmsRedirect = { id, from, to, type, isActive: true, hitCount: 0, createdAt: new Date() };
    this.redirects.set(id, redirect);
    return redirect;
  }

  checkRedirect(path: string): CmsRedirect | null {
    for (const r of Array.from(this.redirects.values())) {
      if (r.isActive && r.from === path) {
        r.hitCount++;
        return r;
      }
    }
    return null;
  }

  listRedirects(): CmsRedirect[] {
    return Array.from(this.redirects.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteRedirect(id: string): boolean {
    return this.redirects.delete(id);
  }

  // ==========================================================================
  // WIDGETS
  // ==========================================================================

  createWidget(data: Omit<CmsWidget, "id" | "createdAt" | "updatedAt">): CmsWidget {
    const id = crypto.randomUUID();
    const now = new Date();
    const widget: CmsWidget = { ...data, id, createdAt: now, updatedAt: now };
    this.widgetsStore.set(id, widget);
    return widget;
  }

  updateWidget(id: string, data: Partial<CmsWidget>): CmsWidget | null {
    const existing = this.widgetsStore.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.widgetsStore.set(id, updated);
    return updated;
  }

  listWidgets(sidebar?: string): CmsWidget[] {
    let result = Array.from(this.widgetsStore.values());
    if (sidebar) result = result.filter((w) => w.sidebar === sidebar);
    return result;
  }

  deleteWidget(id: string): boolean {
    return this.widgetsStore.delete(id);
  }

  // ==========================================================================
  // REVISIONS
  // ==========================================================================

  private saveRevision(entityType: string, entityId: string, content: unknown): void {
    this.revisions.push({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      content,
      authorId: null,
      summary: null,
      createdAt: new Date(),
    });
    // Keep last 50 revisions per entity
    const entityRevisions = this.revisions.filter((r) => r.entityType === entityType && r.entityId === entityId);
    if (entityRevisions.length > 50) {
      const toRemove = entityRevisions.slice(0, entityRevisions.length - 50);
      this.revisions = this.revisions.filter((r) => !toRemove.includes(r));
    }
  }

  getRevisions(entityType: string, entityId: string): CmsRevision[] {
    return this.revisions
      .filter((r) => r.entityType === entityType && r.entityId === entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  /** Resolve a URL path to a page/post and render it */
  resolveAndRender(path: string): { type: string; data: CmsPage | CmsPost | null; redirect: CmsRedirect | null } {
    // Check redirects first
    const redirect = this.checkRedirect(path);
    if (redirect) return { type: "redirect", data: null, redirect };

    // Check pages
    const page = this.getPageBySlug(path);
    if (page) return { type: "page", data: page, redirect: null };

    // Check posts
    const post = this.getPostBySlug(path);
    if (post) return { type: "post", data: post, redirect: null };

    return { type: "not_found", data: null, redirect: null };
  }

  /** Render PageBuilder content to HTML */
  renderPageBuilder(content: PageBuilderContent): string {
    const parts: string[] = [];
    parts.push('<div class="msap-page-builder">');

    for (const section of content.sections) {
      const sectionClasses = ["msap-pb-section"];
      if (section.settings.className) sectionClasses.push(section.settings.className as string);

      parts.push(`<section class="${sectionClasses.join(" ")}"${section.settings.id ? ` id="${section.settings.id}"` : ""}>`);
      parts.push('<div class="msap-container">');
      parts.push(`<div class="msap-pb-columns" style="display:flex;gap:24px;flex-wrap:wrap;">`);

      for (const column of section.columns) {
        parts.push(`<div class="msap-pb-column" style="flex:${column.width};min-width:280px;">`);

        for (const widget of column.widgets) {
          const def = this.widgets.get(widget.type);
          if (def) {
            parts.push(def.render({ ...def.defaults, ...widget.settings }));
          } else {
            parts.push(`<!-- Unknown widget: ${widget.type} -->`);
          }
        }

        parts.push("</div>");
      }

      parts.push("</div>");
      parts.push("</div>");
      parts.push("</section>");
    }

    parts.push("</div>");
    return parts.join("\n");
  }

  /** Render a form to HTML */
  renderForm(formId: string): string {
    const form = this.forms.get(formId);
    if (!form) return "<p>Form not found</p>";

    const parts: string[] = [];
    parts.push(`<form class="msap-cms-form" data-form-id="${form.id}">`);
    parts.push(`<h3>${this.escapeHtml(form.title)}</h3>`);

    for (const field of form.fields) {
      parts.push(`<div class="msap-form-field" data-key="${field.key}">`);
      parts.push(`<label for="field-${field.key}">${this.escapeHtml(field.label)}${field.required ? " *" : ""}</label>`);

      switch (field.type) {
        case "text":
        case "email":
        case "url":
        case "number":
        case "password":
          parts.push(`<input type="${field.type}" id="field-${field.key}" name="${field.key}" placeholder="${this.escapeHtml(field.placeholder || "")}"${field.required ? " required" : ""} />`);
          break;
        case "textarea":
          parts.push(`<textarea id="field-${field.key}" name="${field.key}" rows="4" placeholder="${this.escapeHtml(field.placeholder || "")}"${field.required ? " required" : ""}></textarea>`);
          break;
        case "select":
          parts.push(`<select id="field-${field.key}" name="${field.key}"${field.required ? " required" : ""}>`);
          parts.push('<option value="">Select...</option>');
          if (field.choices) {
            for (const [val, label] of Object.entries(field.choices)) {
              parts.push(`<option value="${this.escapeHtml(val)}">${this.escapeHtml(label)}</option>`);
            }
          }
          parts.push("</select>");
          break;
        case "checkbox":
          parts.push(`<label class="msap-checkbox"><input type="checkbox" name="${field.key}" value="1" /> ${this.escapeHtml(field.placeholder || field.label)}</label>`);
          break;
        case "radio":
          if (field.choices) {
            for (const [val, label] of Object.entries(field.choices)) {
              parts.push(`<label class="msap-radio"><input type="radio" name="${field.key}" value="${this.escapeHtml(val)}" /> ${this.escapeHtml(label)}</label>`);
            }
          }
          break;
        default:
          parts.push(`<input type="text" id="field-${field.key}" name="${field.key}" />`);
      }

      parts.push("</div>");
    }

    const submitText = (form.settings?.submitText as string) || "Submit";
    parts.push(`<button type="submit" class="msap-form-submit">${this.escapeHtml(submitText)}</button>`);
    parts.push("</form>");
    return parts.join("\n");
  }

  // ==========================================================================
  // SEO
  // ==========================================================================

  getPageSeo(pageId: string): { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; canonical: string; noIndex: boolean; schema: Record<string, unknown> | null } {
    const page = this.pages.get(pageId);
    if (!page) throw new Error("Page not found");

    const siteName = "MSA Pakistan";
    return {
      title: page.metaTitle || `${page.title} — ${siteName}`,
      description: page.metaDescription || page.excerpt || "",
      ogTitle: page.ogTitle || page.metaTitle || page.title,
      ogDescription: page.ogDescription || page.metaDescription || page.excerpt || "",
      ogImage: page.ogImage || page.metaImage || "",
      canonical: page.canonicalUrl || "",
      noIndex: page.status !== "published",
      schema: page.schema,
    };
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  getStats(): {
    pages: { total: number; published: number; draft: number };
    posts: { total: number; published: number; draft: number };
    media: { total: number; totalSize: number };
    menus: number;
    themes: { total: number; active: string | null };
    plugins: { total: number; active: number };
    forms: { total: number; submissions: number };
    redirects: number;
    revisions: number;
    customPostTypes: number;
    taxonomies: number;
  } {
    const pages = Array.from(this.pages.values());
    const posts = Array.from(this.posts.values());
    const mediaItems = Array.from(this.media.values());

    return {
      pages: { total: pages.length, published: pages.filter((p) => p.status === "published").length, draft: pages.filter((p) => p.status === "draft").length },
      posts: { total: posts.length, published: posts.filter((p) => p.status === "published").length, draft: posts.filter((p) => p.status === "draft").length },
      media: { total: mediaItems.length, totalSize: mediaItems.reduce((sum, m) => sum + m.size, 0) },
      menus: this.menus.size,
      themes: { total: this.themes.size, active: this.getActiveTheme()?.name || null },
      plugins: { total: this.plugins.size, active: Array.from(this.plugins.values()).filter((p) => p.isActive).length },
      forms: { total: this.forms.size, submissions: this.formSubmissions.size },
      redirects: this.redirects.size,
      revisions: this.revisions.length,
      customPostTypes: this.postTypes.size,
      taxonomies: this.taxonomies.size,
    };
  }

  // ==========================================================================
  // BUILTINS
  // ==========================================================================

  private registerBuiltinWidgets(): void {
    const builtins: WidgetDefinition[] = [
      {
        type: "heading", name: "Heading", icon: "H", category: "basic",
        description: "Section heading with configurable tag level",
        defaults: { text: "Heading", tag: "h2", align: "left", color: "#1B355E" },
        render: (s) => `<${s.tag || "h2"} class="msap-pb-heading" style="text-align:${s.align || "left"};color:${s.color || "#1B355E"}">${this.escapeHtml(s.text as string || "")}</${s.tag || "h2"}>`,
      },
      {
        type: "text", name: "Text Editor", icon: "T", category: "basic",
        description: "Rich text content block",
        defaults: { content: "Enter your text here...", align: "left" },
        render: (s) => `<div class="msap-pb-text" style="text-align:${s.align || "left"}">${s.content || ""}</div>`,
      },
      {
        type: "image", name: "Image", icon: "🖼", category: "basic",
        description: "Single image with caption",
        defaults: { url: "", alt: "", caption: "", width: "100%" },
        render: (s) => s.url ? `<figure class="msap-pb-image"><img src="${s.url}" alt="${this.escapeHtml(s.alt as string || "")}" style="width:${s.width || "100%"}" />${s.caption ? `<figcaption>${this.escapeHtml(s.caption as string)}</figcaption>` : ""}</figure>` : "",
      },
      {
        type: "gallery", name: "Gallery", icon: "🖼🖼", category: "basic",
        description: "Image gallery grid",
        defaults: { images: [], columns: 3, gap: 16 },
        render: (s) => {
          const imgs = (s.images as string[]) || [];
          if (!imgs.length) return "";
          return `<div class="msap-pb-gallery" style="display:grid;grid-template-columns:repeat(${s.columns || 3},1fr);gap:${s.gap || 16}px">${imgs.map((url) => `<img src="${url}" alt="" style="width:100%;border-radius:8px" />`).join("")}</div>`;
        },
      },
      {
        type: "button", name: "Button", icon: "▢", category: "basic",
        description: "Call-to-action button",
        defaults: { text: "Click Me", url: "#", style: "primary", size: "md" },
        render: (s) => `<a href="${s.url || "#"}" class="msap-pb-button msap-pb-button--${s.style || "primary"} msap-pb-button--${s.size || "md"}">${this.escapeHtml(s.text as string || "Button")}</a>`,
      },
      {
        type: "divider", name: "Divider", icon: "—", category: "basic",
        description: "Horizontal separator line",
        defaults: { style: "solid", width: "100%", color: "#e2e8f0" },
        render: (s) => `<hr class="msap-pb-divider" style="width:${s.width || "100%"};border:none;border-top:1px ${s.style || "solid"} ${s.color || "#e2e8f0"}" />`,
      },
      {
        type: "spacer", name: "Spacer", icon: "↕", category: "basic",
        description: "Empty space between elements",
        defaults: { height: 40 },
        render: (s) => `<div class="msap-pb-spacer" style="height:${s.height || 40}px"></div>`,
      },
      {
        type: "video", name: "Video", icon: "▶", category: "general",
        description: "Embedded video player",
        defaults: { url: "", autoplay: false },
        render: (s) => {
          if (!s.url) return "";
          return `<div class="msap-pb-video"><iframe src="${s.url}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:12px"></iframe></div>`;
        },
      },
      {
        type: "map", name: "Google Map", icon: "📍", category: "general",
        description: "Embedded Google Map",
        defaults: { address: "", zoom: 14, height: 400 },
        render: (s) => s.address ? `<div class="msap-pb-map" style="height:${s.height || 400}px;border-radius:12px;overflow:hidden;background:#e2e8f0;display:flex;align-items:center;justify-content:center"><p style="color:#64748b">Map: ${this.escapeHtml(s.address as string)}</p></div>` : "",
      },
      {
        type: "html", name: "Custom HTML", icon: "</>", category: "general",
        description: "Raw HTML code block",
        defaults: { code: "" },
        render: (s) => (s.code as string) || "",
      },
      {
        type: "testimonial", name: "Testimonial", icon: "💬", category: "pro",
        description: "Client testimonial with photo",
        defaults: { text: "Amazing service!", author: "John Doe", role: "CEO", image: "" },
        render: (s) => `<div class="msap-pb-testimonial" style="background:#f8fafc;padding:32px;border-radius:16px;border-left:4px solid #138A73"><p style="font-style:italic;font-size:16px;margin:0 0 16px">"${this.escapeHtml(s.text as string || "")}"</p><div style="display:flex;align-items:center;gap:12px">${s.image ? `<img src="${s.image}" alt="" style="width:48px;height:48px;border-radius:50%" />` : ""}<div><strong>${this.escapeHtml(s.author as string || "")}</strong><br><span style="color:#64748b;font-size:14px">${this.escapeHtml(s.role as string || "")}</span></div></div></div>`,
      },
      {
        type: "countdown", name: "Countdown Timer", icon: "⏱", category: "pro",
        description: "Event countdown timer",
        defaults: { date: "", label: "Event starts in" },
        render: (s) => `<div class="msap-pb-countdown" data-date="${s.date || ""}"><p style="text-align:center;font-weight:600;color:#1B355E">${this.escapeHtml(s.label as string || "Coming soon")}</p></div>`,
      },
    ];

    for (const w of builtins) {
      this.widgets.register(w);
    }
  }

  private registerBuiltinShortcodes(): void {
    this.shortcodes.register("msap_portal_link", (attrs) => {
      const text = attrs.text || "Open Portal";
      const page = attrs.page || "";
      return `<a class="msap-button" href="/${page}">${this.escapeHtml(text)} →</a>`;
    });

    this.shortcodes.register("msap_stats", () => {
      return '<div class="msap-stats"><!-- Stats rendered by theme --></div>';
    });

    this.shortcodes.register("msap_membership_banner", () => {
      return '<div class="msap-membership-banner"><!-- Membership banner --></div>';
    });

    this.shortcodes.register("msap_socials", () => {
      return '<div class="msap-socials"><!-- Social links --></div>';
    });

    this.shortcodes.register("gallery", (attrs) => {
      const ids = attrs.ids || "";
      return `<div class="msap-gallery" data-ids="${ids}"></div>`;
    });
  }

  // ==========================================================================
  // SEED DATA
  // ==========================================================================

  private seedDefaults(): void {
    // Default theme
    this.installTheme({
      slug: "msap-default",
      name: "MSAP Default Theme",
      version: "1.0.0",
      description: "Default theme for MSA Pakistan portal",
      author: "MSA Pakistan",
      screenshot: null,
      isActive: true,
      settings: {
        primaryColor: "#1B355E",
        secondaryColor: "#138A73",
        accentColor: "#29C89E",
        fontHeading: "Sora",
        fontBody: "Manrope",
        maxWidth: 1200,
        borderRadius: 12,
      },
      customCss: "",
      headerHtml: null,
      footerHtml: null,
      templates: {
        default: { name: "Default", file: "default" },
        fullwidth: { name: "Full Width", file: "fullwidth" },
        sidebar: { name: "With Sidebar", file: "sidebar" },
        landing: { name: "Landing Page", file: "landing" },
      },
      widgetAreas: ["header", "footer-1", "footer-2", "footer-3", "footer-4", "sidebar"],
      menus: ["primary", "footer", "mobile"],
    });

    // Default menus
    this.createMenu({
      slug: "primary",
      name: "Primary Menu",
      location: "header",
      items: [
        { id: "1", label: "Home", url: "/" },
        { id: "2", label: "About", url: "/about" },
        { id: "3", label: "Membership", url: "/membership" },
        { id: "4", label: "Governance", url: "/governance" },
        { id: "5", label: "Contact", url: "/contact" },
        { id: "6", label: "Member Portal", url: "/login", className: "msap-nav-portal" },
      ],
    });

    this.createMenu({
      slug: "footer",
      name: "Footer Menu",
      location: "footer",
      items: [
        { id: "1", label: "About MSAP", url: "/about" },
        { id: "2", label: "Governance", url: "/governance" },
        { id: "3", label: "Local Councils", url: "/local-councils" },
        { id: "4", label: "Contact", url: "/contact" },
        { id: "5", label: "Privacy Policy", url: "/privacy" },
        { id: "6", label: "Terms of Service", url: "/terms" },
      ],
    });

    // Default pages
    this.createPage({
      slug: "home",
      title: "Home",
      content: {
        sections: [
          {
            id: "hero",
            type: "section",
            settings: { background: "linear-gradient(135deg, #1B355E 0%, #138A73 100%)", padding: "80px 0" },
            columns: [
              {
                id: "hero-col",
                width: "100%",
                settings: { align: "center" },
                widgets: [
                  { id: "w1", type: "heading", settings: { text: "Medical Students' Association of Pakistan", tag: "h1", align: "center", color: "#ffffff" } },
                  { id: "w2", type: "text", settings: { content: "Connecting Pakistan's medical students. Building tomorrow's health leaders.", align: "center" } },
                  { id: "w3", type: "button", settings: { text: "Join MSA Pakistan", url: "/membership", style: "primary", size: "lg" } },
                ],
              },
            ],
          },
        ],
      },
      contentHtml: null,
      excerpt: "MSA Pakistan — the largest network of medical students.",
      template: "default",
      status: "published",
      authorId: null,
      parentId: null,
      metaTitle: "MSA Pakistan — Medical Students' Association",
      metaDescription: "Join the largest network of medical students in Pakistan. Membership, governance, opportunities, and more.",
      metaImage: null,
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      schema: null,
      customFields: {},
      templateData: {},
      publishedAt: new Date(),
    });

    this.createPage({ slug: "about", title: "About MSAP", content: null, contentHtml: null, excerpt: "Learn about MSA Pakistan", template: "default", status: "published", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: new Date() });
    this.createPage({ slug: "membership", title: "Membership", content: null, contentHtml: null, excerpt: "Apply for MSA Pakistan membership", template: "default", status: "published", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: new Date() });
    this.createPage({ slug: "governance", title: "Governance", content: null, contentHtml: null, excerpt: "Constitution and bylaws", template: "default", status: "published", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: new Date() });
    this.createPage({ slug: "contact", title: "Contact", content: null, contentHtml: null, excerpt: "Get in touch with MSA Pakistan", template: "default", status: "published", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: new Date() });
    this.createPage({ slug: "privacy", title: "Privacy Policy", content: null, contentHtml: null, excerpt: "Privacy policy", template: "default", status: "draft", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: null });
    this.createPage({ slug: "terms", title: "Terms of Service", content: null, contentHtml: null, excerpt: "Terms of service", template: "default", status: "draft", authorId: null, parentId: null, metaTitle: null, metaDescription: null, metaImage: null, canonicalUrl: null, ogTitle: null, ogDescription: null, ogImage: null, schema: null, customFields: {}, templateData: {}, publishedAt: null });

    // Default form
    this.createForm({
      slug: "contact-form",
      title: "Contact Us",
      fields: [
        { key: "name", label: "Full Name", type: "text", required: true, placeholder: "Your full name" },
        { key: "email", label: "Email Address", type: "email", required: true, placeholder: "you@example.com" },
        { key: "subject", label: "Subject", type: "select", required: true, choices: { membership: "Membership Inquiry", governance: "Governance Question", general: "General Inquiry", feedback: "Feedback" } },
        { key: "message", label: "Message", type: "textarea", required: true, placeholder: "How can we help you?" },
      ],
      settings: { submitText: "Send Message", redirect: "/thank-you", emailTo: "info@msapakistan.org" },
    });
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

// Singleton
export const cmsEngine = new CMSEngine();
