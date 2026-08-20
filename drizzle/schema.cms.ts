/**
 * CMS Database Schema
 *
 * Full content management system: pages, posts, media, menus, widgets,
 * themes, plugins, forms, custom post types, taxonomies, SEO, revisions.
 */

import { pgTable, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// ============================================================================
// CORE CONTENT
// ============================================================================

/** Pages — static content with flexible page builder layouts */
export const cmsPages = pgTable("cms_pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: jsonb("content"),            // Page builder JSON (Elementor-like)
  contentHtml: text("content_html"),     // Rendered HTML fallback
  excerpt: text("excerpt"),
  template: text("template").default("default"),
  status: text("status").default("draft"), // draft, published, archived, trashed
  authorId: text("author_id"),
  parentId: text("parent_id"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  metaImage: text("meta_image"),
  canonicalUrl: text("canonical_url"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  schema: jsonb("schema"),              // Structured data JSON-LD
  customFields: jsonb("custom_fields"),
  templateData: jsonb("template_data"), // Theme-specific template params
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("cms_pages_slug_idx").on(t.slug),
  index("cms_pages_status_idx").on(t.status),
  index("cms_pages_author_idx").on(t.authorId),
]);

/** Posts — blog articles, news, updates */
export const cmsPosts = pgTable("cms_posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: jsonb("content"),
  contentHtml: text("content_html"),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"),
  status: text("status").default("draft"),
  authorId: text("author_id"),
  postType: text("post_type").default("post"), // post, news, announcement
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  customFields: jsonb("custom_fields"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("cms_posts_slug_idx").on(t.slug),
  index("cms_posts_type_idx").on(t.postType),
  index("cms_posts_status_idx").on(t.status),
]);

// ============================================================================
// MEDIA LIBRARY
// ============================================================================

export const cmsMedia = pgTable("cms_media", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),          // bytes
  width: integer("width"),
  height: integer("height"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  alt: text("alt"),
  caption: text("caption"),
  description: text("description"),
  folder: text("folder").default("/"),
  tags: jsonb("tags").$type<string[]>().default([]),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("cms_media_folder_idx").on(t.folder),
  index("cms_media_mime_idx").on(t.mimeType),
]);

// ============================================================================
// MENUS
// ============================================================================

export const cmsMenus = pgTable("cms_menus", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  location: text("location"),  // header, footer, sidebar, mobile
  items: jsonb("items").$type<CmsMenuItem[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cms_menus_slug_idx").on(t.slug),
]);

export interface CmsMenuItem {
  id: string;
  label: string;
  url: string;
  target?: string;
  className?: string;
  children?: CmsMenuItem[];
}

// ============================================================================
// WIDGETS / BLOCKS
// ============================================================================

export const cmsWidgets = pgTable("cms_widgets", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),  // text, image, gallery, form, html, menu, search, custom
  content: jsonb("content"),     // Widget-specific config
  sidebar: text("sidebar"),      // Which sidebar/widget area
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// THEMES
// ============================================================================

export const cmsThemes = pgTable("cms_themes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  version: text("version"),
  description: text("description"),
  author: text("author"),
  screenshot: text("screenshot"),
  isActive: boolean("is_active").default(false),
  settings: jsonb("settings"),   // Theme-specific settings (colors, fonts, layout)
  customCss: text("custom_css"),
  headerHtml: text("header_html"),
  footerHtml: text("footer_html"),
  templates: jsonb("templates"), // Available templates: { slug: { name, file } }
  widgetAreas: jsonb("widget_areas").$type<string[]>().default([]),
  menus: jsonb("menus").$type<string[]>().default([]),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cms_themes_slug_idx").on(t.slug),
]);

// ============================================================================
// PLUGINS
// ============================================================================

export const cmsPlugins = pgTable("cms_plugins", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  version: text("version"),
  description: text("description"),
  author: text("author"),
  isActive: boolean("is_active").default(false),
  settings: jsonb("settings"),
  hooks: jsonb("hooks"),          // Registered hooks: { filter: [...], action: [...] }
  permissions: jsonb("permissions"), // Required permissions
  dependencies: jsonb("dependencies").$type<string[]>().default([]),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cms_plugins_slug_idx").on(t.slug),
]);

// ============================================================================
// CUSTOM POST TYPES
// ============================================================================

export const cmsPostTypes = pgTable("cms_post_types", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  plural: text("plural").notNull(),
  icon: text("icon"),
  supports: jsonb("supports").$type<string[]>().default(["title", "editor"]),
  fields: jsonb("fields"),           // Custom field definitions
  taxonomies: jsonb("taxonomies").$type<string[]>().default([]),
  menuPosition: integer("menu_position").default(0),
  isPublic: boolean("is_public").default(true),
  hasArchive: boolean("has_archive").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cms_post_types_slug_idx").on(t.slug),
]);

// ============================================================================
// CUSTOM FIELDS (ACF-like)
// ============================================================================

export const cmsFieldGroups = pgTable("cms_field_groups", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  fields: jsonb("fields").$type<CmsFieldDef[]>().default([]),
  location: jsonb("location"), // Where to show: [{ param, operator, value }]
  menuOrder: integer("menu_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface CmsFieldDef {
  key: string;
  label: string;
  type: string; // text, textarea, number, image, file, select, checkbox, radio, date, repeater, group, wysiwyg, color, url, email, password, gallery, relationship, taxonomy, google_map, flex_content
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  choices?: Record<string, string>;
  min?: number;
  max?: number;
  wrapper?: { width?: string; class?: string };
  conditions?: unknown[];
  instructions?: string;
}

// ============================================================================
// TAXONOMIES
// ============================================================================

export const cmsTaxonomies = pgTable("cms_taxonomies", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  plural: text("plural").notNull(),
  postTypes: jsonb("post_types").$type<string[]>().default([]),
  hierarchical: boolean("hierarchical").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cmsTerms = pgTable("cms_terms", {
  id: text("id").primaryKey(),
  taxonomyId: text("taxonomy_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  parentId: text("parent_id"),
  count: integer("count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("cms_terms_taxonomy_idx").on(t.taxonomyId),
  index("cms_terms_slug_idx").on(t.slug),
]);

// ============================================================================
// FORMS BUILDER
// ============================================================================

export const cmsForms = pgTable("cms_forms", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  fields: jsonb("fields").$type<CmsFieldDef[]>().default([]),
  settings: jsonb("settings"), // submit button text, redirect, email notifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cmsFormSubmissions = pgTable("cms_form_submissions", {
  id: text("id").primaryKey(),
  formId: text("form_id").notNull(),
  data: jsonb("data").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// REVISIONS
// ============================================================================

export const cmsRevisions = pgTable("cms_revisions", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // page, post, media, theme, plugin
  entityId: text("entity_id").notNull(),
  content: jsonb("content").notNull(),
  authorId: text("author_id"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("cms_revisions_entity_idx").on(t.entityType, t.entityId),
]);

// ============================================================================
// REDIRECTS
// ============================================================================

export const cmsRedirects = pgTable("cms_redirects", {
  id: text("id").primaryKey(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  type: text("type").default("301"),  // 301, 302, 307
  isActive: boolean("is_active").default(true),
  hitCount: integer("hit_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cms_redirects_from_idx").on(t.from),
]);

// ============================================================================
// SEO
// ============================================================================

export const cmsSeoSettings = pgTable("cms_seo_settings", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  canonicalUrl: text("canonical_url"),
  schema: jsonb("schema"),
  noIndex: boolean("no_index").default(false),
  noFollow: boolean("no_follow").default(false),
}, (t) => [
  uniqueIndex("cms_seo_entity_idx").on(t.entityType, t.entityId),
]);

// ============================================================================
// TYPES
// ============================================================================

export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = typeof cmsPages.$inferInsert;
export type CmsPost = typeof cmsPosts.$inferSelect;
export type InsertCmsPost = typeof cmsPosts.$inferInsert;
export type CmsMediaItem = typeof cmsMedia.$inferSelect;
export type CmsMenu = typeof cmsMenus.$inferSelect;
export type CmsWidget = typeof cmsWidgets.$inferSelect;
export type CmsTheme = typeof cmsThemes.$inferSelect;
export type CmsPlugin = typeof cmsPlugins.$inferSelect;
export type CmsPostType = typeof cmsPostTypes.$inferSelect;
export type CmsFieldGroup = typeof cmsFieldGroups.$inferSelect;
export type CmsTaxonomy = typeof cmsTaxonomies.$inferSelect;
export type CmsTerm = typeof cmsTerms.$inferSelect;
export type CmsForm = typeof cmsForms.$inferSelect;
export type CmsFormSubmission = typeof cmsFormSubmissions.$inferSelect;
export type CmsRevision = typeof cmsRevisions.$inferSelect;
export type CmsRedirect = typeof cmsRedirects.$inferSelect;
export type CmsSeoSetting = typeof cmsSeoSettings.$inferSelect;
