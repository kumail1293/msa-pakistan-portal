/**
 * Conflict & Disciplinary Management Engine (§116)
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { disciplinaryCases } from "../../drizzle/schema.remaining";
import { logAuditEvent } from "./auditService";

export const disciplinaryEngine = {
  create: async (input: {
    title: string; description?: string; type: string; severity?: string;
    complainantId?: number; complainantName?: string; respondentId?: number; respondentName?: string;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number; caseNumber: string } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const caseNumber = `DC-${Date.now().toString(36).toUpperCase()}`;
      const [result] = await db.insert(disciplinaryCases).values({
        caseNumber, title: input.title, description: input.description,
        type: input.type as any, severity: (input.severity as any) ?? "medium",
        complainantId: input.complainantId, complainantName: input.complainantName,
        respondentId: input.respondentId, respondentName: input.respondentName,
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId), caseNumber };
    } catch { return null; }
  },

  transition: async (caseId: number, newStatus: string, userId: number, notes?: string): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(disciplinaryCases).set({ status: newStatus as any, updatedAt: new Date(), decisionNotes: notes }).where(eq(disciplinaryCases.id, caseId));
      await logAuditEvent({ userId, action: `disciplinary.${newStatus}`, entityType: "disciplinary_case", entityId: caseId });
      return true;
    } catch { return false; }
  },

  assignInvestigator: async (caseId: number, investigatorId: number, userId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(disciplinaryCases).set({ investigatorId, investigationStartedAt: new Date(), status: "under_investigation" as any }).where(eq(disciplinaryCases.id, caseId));
      return true;
    } catch { return false; }
  },

  scheduleHearing: async (caseId: number, hearingDate: Date, panel: number[], userId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(disciplinaryCases).set({ hearingDate, hearingPanel: panel as any, status: "hearing_scheduled" as any }).where(eq(disciplinaryCases.id, caseId));
      return true;
    } catch { return false; }
  },

  makeDecision: async (caseId: number, decision: string, notes: string, sanctions: Array<{ type: string; description: string; duration?: string }>, decidedBy: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(disciplinaryCases).set({ decision, decisionNotes: notes, sanctions: sanctions as any, decidedBy, decidedAt: new Date(), status: "resolved" as any }).where(eq(disciplinaryCases.id, caseId));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; type?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(disciplinaryCases.status, options.status as any));
      if (options.type) conditions.push(eq(disciplinaryCases.type, options.type as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(disciplinaryCases).where(where).orderBy(desc(disciplinaryCases.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ status: disciplinaryCases.status, count: sql<number>`count(*)` }).from(disciplinaryCases).groupBy(disciplinaryCases.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

export default disciplinaryEngine;

/**
 * Safeguarding Engine (§117)
 */
import { safeguardingIncidents } from "../../drizzle/schema.remaining";

export const safeguardingEngine = {
  report: async (input: {
    title: string; description?: string; category: string; severity?: string;
    reporterId?: number; reporterName?: string; reporterRole?: string;
    isAnonymous?: boolean; affectedPersonId?: number; affectedPersonName?: string;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number; incidentNumber: string } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const incidentNumber = `SG-${Date.now().toString(36).toUpperCase()}`;
      const [result] = await db.insert(safeguardingIncidents).values({
        incidentNumber, title: input.title, description: input.description,
        category: input.category as any, severity: (input.severity as any) ?? "medium",
        reporterId: input.reporterId, reporterName: input.reporterName, reporterRole: input.reporterRole,
        isAnonymous: input.isAnonymous ?? false,
        affectedPersonId: input.affectedPersonId, affectedPersonName: input.affectedPersonName,
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId), incidentNumber };
    } catch { return null; }
  },

  assignOfficer: async (incidentId: number, officerId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(safeguardingIncidents).set({ designatedOfficerId: officerId, assignedAt: new Date(), status: "acknowledged" as any }).where(eq(safeguardingIncidents.id, incidentId));
      return true;
    } catch { return false; }
  },

  escalate: async (incidentId: number, externalAgency?: string, notes?: string): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      const updates: any = { status: "escalated" as any, investigationNotes: notes };
      if (externalAgency) { updates.externalReported = true; updates.externalAgency = externalAgency; updates.externalReportDate = new Date(); }
      await db.update(safeguardingIncidents).set(updates).where(eq(safeguardingIncidents.id, incidentId));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; category?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(safeguardingIncidents.status, options.status as any));
      if (options.category) conditions.push(eq(safeguardingIncidents.category, options.category as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(safeguardingIncidents).where(where).orderBy(desc(safeguardingIncidents.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ status: safeguardingIncidents.status, count: sql<number>`count(*)` }).from(safeguardingIncidents).groupBy(safeguardingIncidents.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/**
 * Feedback Engine (§118)
 */
import { feedbackItems } from "../../drizzle/schema.remaining";

export const feedbackEngine = {
  submit: async (input: {
    type: string; subject: string; description: string; category?: string;
    priority?: string; submitterId?: number; isAnonymous?: boolean;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [result] = await db.insert(feedbackItems).values({
        type: input.type as any, subject: input.subject, description: input.description,
        category: input.category, priority: (input.priority as any) ?? "medium",
        submitterId: input.submitterId, isAnonymous: input.isAnonymous ?? false,
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  respond: async (itemId: number, response: string, respondedBy: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(feedbackItems).set({ response, respondedBy, respondedAt: new Date(), status: "resolved" as any }).where(eq(feedbackItems.id, itemId));
      return true;
    } catch { return false; }
  },

  list: async (options: { type?: string; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(feedbackItems.type, options.type as any));
      if (options.status) conditions.push(eq(feedbackItems.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(feedbackItems).where(where).orderBy(desc(feedbackItems.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ status: feedbackItems.status, count: sql<number>`count(*)` }).from(feedbackItems).groupBy(feedbackItems.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/**
 * Helpdesk/Ticketing Engine (§119)
 */
import { tickets, ticketComments } from "../../drizzle/schema.remaining";

export const helpdeskEngine = {
  create: async (input: {
    subject: string; description?: string; category?: string; priority?: string;
    requesterId?: number; organizationId?: number; createdBy?: number;
  }): Promise<{ id: number; ticketNumber: string } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}`;
      const [result] = await db.insert(tickets).values({
        ticketNumber, subject: input.subject, description: input.description,
        category: input.category, priority: (input.priority as any) ?? "medium",
        requesterId: input.requesterId, organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId), ticketNumber };
    } catch { return null; }
  },

  assign: async (ticketId: number, userId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(tickets).set({ assignedTo: userId, status: "in_progress" as any }).where(eq(tickets.id, ticketId));
      return true;
    } catch { return false; }
  },

  addComment: async (ticketId: number, userId: number, content: string, isInternal?: boolean): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.insert(ticketComments).values({ ticketId, userId, content, isInternal: isInternal ?? false });
      if (!isInternal) await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));
      return true;
    } catch { return false; }
  },

  resolve: async (ticketId: number, resolution: string, userId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(tickets).set({ status: "resolved" as any, resolution, resolvedAt: new Date() }).where(eq(tickets.id, ticketId));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; priority?: string; assignedTo?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(tickets.status, options.status as any));
      if (options.priority) conditions.push(eq(tickets.priority, options.priority as any));
      if (options.assignedTo) conditions.push(eq(tickets.assignedTo, options.assignedTo));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(tickets).where(where).orderBy(desc(tickets.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ status: tickets.status, count: sql<number>`count(*)` }).from(tickets).groupBy(tickets.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/**
 * Inventory Engine (§125)
 */
import { inventoryItems, inventoryTransactions } from "../../drizzle/schema.remaining";

export const inventoryEngine = {
  create: async (input: {
    name: string; description?: string; category?: string; type?: string;
    serialNumber?: string; assetTag?: string; purchasePrice?: number;
    location?: string; organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [result] = await db.insert(inventoryItems).values({
        name: input.name, description: input.description,
        category: input.category, type: (input.type as any) ?? "equipment",
        serialNumber: input.serialNumber, assetTag: input.assetTag,
        purchasePrice: input.purchasePrice ? String(input.purchasePrice) : undefined,
        location: input.location, organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  checkout: async (itemId: number, toUserId: number, notes?: string, performedBy?: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(inventoryItems).set({ status: "in_use" as any, assignedTo: toUserId }).where(eq(inventoryItems.id, itemId));
      await db.insert(inventoryTransactions).values({ itemId, type: "checkout", toUserId, notes, performedBy });
      return true;
    } catch { return false; }
  },

  return: async (itemId: number, notes?: string, performedBy?: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
      await db.update(inventoryItems).set({ status: "available" as any, assignedTo: null }).where(eq(inventoryItems.id, itemId));
      await db.insert(inventoryTransactions).values({ itemId, type: "return", fromUserId: item?.assignedTo ?? undefined, notes, performedBy });
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; category?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(inventoryItems.status, options.status as any));
      if (options.category) conditions.push(eq(inventoryItems.category, options.category));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(inventoryItems).where(where).orderBy(inventoryItems.name).limit(options.limit ?? 100);
    } catch { return []; }
  },

  getStats: async (): Promise<{ total: number; available: number; inUse: number; maintenance: number; lost: number }> => {
    const db = getDb(); if (!db) return { total: 0, available: 0, inUse: 0, maintenance: 0, lost: 0 };
    try {
      const [t] = await db.select({ c: sql<number>`count(*)` }).from(inventoryItems);
      const [a] = await db.select({ c: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.status, "available"));
      const [u] = await db.select({ c: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.status, "in_use"));
      const [m] = await db.select({ c: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.status, "maintenance"));
      const [l] = await db.select({ c: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.status, "lost"));
      return { total: t?.c ?? 0, available: a?.c ?? 0, inUse: u?.c ?? 0, maintenance: m?.c ?? 0, lost: l?.c ?? 0 };
    } catch { return { total: 0, available: 0, inUse: 0, maintenance: 0, lost: 0 }; }
  },
};

/**
 * Travel Engine (§126)
 */
import { travelRequests } from "../../drizzle/schema.remaining";

export const travelEngine = {
  create: async (input: {
    title: string; purpose?: string; destination?: string;
    departureDate?: Date; returnDate?: Date; travelMode?: string;
    estimatedCost?: number; requesterId: number;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [result] = await db.insert(travelRequests).values({
        title: input.title, purpose: input.purpose, destination: input.destination,
        departureDate: input.departureDate, returnDate: input.returnDate,
        travelMode: input.travelMode, estimatedCost: input.estimatedCost ? String(input.estimatedCost) : undefined,
        requesterId: input.requesterId, organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  approve: async (requestId: number, approvedBy: number, budget?: number, notes?: string): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(travelRequests).set({ status: "approved" as any, approvedBy, approvedAt: new Date(), approvalNotes: notes, approvedBudget: budget ? String(budget) : undefined }).where(eq(travelRequests.id, requestId));
      return true;
    } catch { return false; }
  },

  reimburse: async (requestId: number, amount: number, notes?: string): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.update(travelRequests).set({ reimbursementStatus: "reimbursed" as any, reimbursementAmount: String(amount), reimbursementDate: new Date(), status: "reimbursed" as any }).where(eq(travelRequests.id, requestId));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; requesterId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(travelRequests.status, options.status as any));
      if (options.requesterId) conditions.push(eq(travelRequests.requesterId, options.requesterId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(travelRequests).where(where).orderBy(desc(travelRequests.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ status: travelRequests.status, count: sql<number>`count(*)` }).from(travelRequests).groupBy(travelRequests.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
