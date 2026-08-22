/**
 * Finance Module Engine (§120-126)
 *
 * Features:
 * - Organization-wide finance (§120)
 * - Budgeting (§121)
 * - Expense management (§122)
 * - Procurement (§123)
 * - Financial controls (§124)
 * - Inventory/assets (§125)
 * - Travel management (§126)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { financeAccounts, financeBudgets, financeTransactions, expenseClaims } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const financeEngine = {
  /** Create a budget. */
  createBudget: async (input: {
    name: string; fiscalYear: string; totalBudget: number;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(financeBudgets).values({
        name: input.name, fiscalYear: input.fiscalYear,
        totalBudget: String(input.totalBudget),
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Create a transaction. */
  createTransaction: async (input: {
    type: string; amount: number; description?: string; category?: string;
    accountId?: number; budgetId?: number; organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(financeTransactions).values({
        type: input.type as any, amount: String(input.amount),
        description: input.description, category: input.category,
        accountId: input.accountId, budgetId: input.budgetId,
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Submit an expense claim. */
  submitExpense: async (input: {
    userId: number; title: string; totalAmount: number;
    description?: string; category?: string; receiptUrls?: string[];
    organizationId?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(expenseClaims).values({
        userId: input.userId, title: input.title,
        totalAmount: String(input.totalAmount),
        description: input.description, category: input.category,
        receiptUrls: input.receiptUrls, organizationId: input.organizationId,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Approve/reject expense. */
  reviewExpense: async (claimId: number, decision: "approved" | "rejected", reviewedBy: number, notes?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(expenseClaims).set({
        status: decision, reviewedBy, reviewedAt: new Date(), reviewNotes: notes,
      }).where(eq(expenseClaims.id, claimId));
      await logAuditEvent({ userId: reviewedBy, action: `expense.${decision}`, entityType: "expense_claim", entityId: claimId });
      return true;
    } catch { return false; }
  },

  /** Get financial summary. */
  getSummary: async (organizationId?: number): Promise<{
    totalIncome: number; totalExpenses: number; pendingExpenses: number;
    activeBudgets: number; transactions: number;
  }> => {
    const db = getDb();
    if (!db) return { totalIncome: 0, totalExpenses: 0, pendingExpenses: 0, activeBudgets: 0, transactions: 0 };
    try {
      const orgFilter = organizationId ? eq(financeTransactions.organizationId, organizationId) : undefined;
      const [income] = await db.select({ sum: sql<number>`COALESCE(SUM(${financeTransactions.amount}), 0)` }).from(financeTransactions).where(and(eq(financeTransactions.type, "income"), orgFilter));
      const [expenses] = await db.select({ sum: sql<number>`COALESCE(SUM(${financeTransactions.amount}), 0)` }).from(financeTransactions).where(and(eq(financeTransactions.type, "expense"), orgFilter));
      const [pending] = await db.select({ count: sql<number>`count(*)` }).from(expenseClaims).where(eq(expenseClaims.status, "submitted"));
      const [budgets] = await db.select({ count: sql<number>`count(*)` }).from(financeBudgets).where(eq(financeBudgets.status, "active"));
      const [txns] = await db.select({ count: sql<number>`count(*)` }).from(financeTransactions).where(orgFilter);
      return {
        totalIncome: Number(income?.sum ?? 0), totalExpenses: Number(expenses?.sum ?? 0),
        pendingExpenses: pending?.count ?? 0, activeBudgets: budgets?.count ?? 0,
        transactions: txns?.count ?? 0,
      };
    } catch { return { totalIncome: 0, totalExpenses: 0, pendingExpenses: 0, activeBudgets: 0, transactions: 0 }; }
  },

  /** List recent transactions. */
  listTransactions: async (options: { type?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const where = options.type ? eq(financeTransactions.type, options.type as any) : undefined;
      return db.select().from(financeTransactions).where(where).orderBy(desc(financeTransactions.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** List expense claims. */
  listExpenses: async (options: { status?: string; memberId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(expenseClaims.status, options.status as any));
      if (options.memberId) conditions.push(eq(expenseClaims.userId, options.memberId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(expenseClaims).where(where).orderBy(desc(expenseClaims.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Update a transaction. */
  updateTransaction: async (txId: number, updates: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(financeTransactions).set({ ...updates, updatedAt: new Date() }).where(eq(financeTransactions.id, txId));
      return true;
    } catch { return false; }
  },

  /** Delete a transaction. */
  deleteTransaction: async (txId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.delete(financeTransactions).where(eq(financeTransactions.id, txId));
      return true;
    } catch { return false; }
  },

  /** Get member-specific financial summary. */
  getMemberSummary: async (userId: number): Promise<{ totalExpenses: number; pendingExpenses: number; approvedExpenses: number; expenseCount: number }> => {
    const db = getDb();
    if (!db) return { totalExpenses: 0, pendingExpenses: 0, approvedExpenses: 0, expenseCount: 0 };
    try {
      const userFilter = eq(expenseClaims.userId, userId);
      const [total] = await db.select({ sum: sql<number>`COALESCE(SUM(${expenseClaims.totalAmount}), 0)` }).from(expenseClaims).where(userFilter);
      const [pending] = await db.select({ count: sql<number>`count(*)` }).from(expenseClaims).where(and(userFilter, eq(expenseClaims.status, "submitted")));
      const [approved] = await db.select({ count: sql<number>`count(*)` }).from(expenseClaims).where(and(userFilter, eq(expenseClaims.status, "approved")));
      const [all] = await db.select({ count: sql<number>`count(*)` }).from(expenseClaims).where(userFilter);
      return {
        totalExpenses: Number(total?.sum ?? 0),
        pendingExpenses: pending?.count ?? 0,
        approvedExpenses: approved?.count ?? 0,
        expenseCount: all?.count ?? 0,
      };
    } catch { return { totalExpenses: 0, pendingExpenses: 0, approvedExpenses: 0, expenseCount: 0 }; }
  },
};

export default financeEngine;
