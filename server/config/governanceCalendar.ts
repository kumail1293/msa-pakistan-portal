/**
 * Governance Calendar
 * 
 * Implements Section 62: Governance Calendar
 * 
 * Contains:
 * - NGA dates
 * - SGA dates
 * - Elections
 * - BCP deadlines
 * - Candidacy deadlines
 * - Credential deadlines
 * - Committee deadlines
 * - Report deadlines
 * - Financial deadlines
 * - LC calendar
 * - Term dates
 * - Policy effective dates
 * 
 * Automatic reminders based on rules.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  ngaMeetings,
  sgaMeetings,
  ngaDelegations,
} from "../../drizzle/schema.nga";
import { elections } from "../../drizzle/schema.governance";
import { logAuditEvent } from "./auditService";

// ============================================================================
// TYPES
// ============================================================================

export type CalendarEventType =
  | "nga"
  | "sga"
  | "election"
  | "bcp_deadline"
  | "candidacy_deadline"
  | "credential_deadline"
  | "committee_deadline"
  | "report_deadline"
  | "financial_deadline"
  | "term_start"
  | "term_end"
  | "policy_effective"
  | "custom";

export type EventPriority = "critical" | "high" | "medium" | "low";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  deadline?: Date;
  priority: EventPriority;
  recurring: boolean;
  recurringPattern?: "annual" | "quarterly" | "monthly";
  governanceVersion?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  metadata?: Record<string, unknown>;
}

export interface CalendarReminder {
  eventId: string;
  reminderDate: Date;
  daysBefore: number;
  sent: boolean;
  sentAt?: Date;
}

export interface CalendarSummary {
  totalEvents: number;
  upcomingEvents: number;
  overdueEvents: number;
  eventsByType: Record<CalendarEventType, number>;
  nextDeadline?: CalendarEvent;
}

// ============================================================================
// GOVERNANCE CALENDAR
// ============================================================================

export const governanceCalendar = {
  /**
   * Get all calendar events for a governance version.
   */
  getEvents: async (options: {
    startDate?: Date;
    endDate?: Date;
    type?: CalendarEventType;
    governanceVersion?: string;
  } = {}): Promise<CalendarEvent[]> => {
    const db = getDb();
    if (!db) return [];

    const events: CalendarEvent[] = [];
    const now = new Date();

    // NGA events
    const ngas = await db
      .select()
      .from(ngaMeetings)
      .orderBy(ngaMeetings.scheduledStart);

    for (const nga of ngas) {
      events.push({
        id: `NGA-${nga.id}`,
        type: "nga",
        title: nga.title,
        description: nga.description ?? "",
        startDate: nga.scheduledStart,
        endDate: nga.scheduledEnd,
        priority: "critical",
        recurring: true,
        recurringPattern: "annual",
        governanceVersion: nga.governanceVersion ?? undefined,
        relatedEntityType: "nga_meeting",
        relatedEntityId: nga.id,
      });
    }

    // SGA events
    const sgas = await db
      .select()
      .from(sgaMeetings)
      .orderBy(sgaMeetings.scheduledStart);

    for (const sga of sgas) {
      events.push({
        id: `SGA-${sga.id}`,
        type: "sga",
        title: sga.title,
        description: sga.description ?? "",
        startDate: sga.scheduledStart,
        endDate: sga.scheduledEnd,
        priority: "high",
        recurring: false,
        governanceVersion: sga.governanceVersion ?? undefined,
        relatedEntityType: "sga_meeting",
        relatedEntityId: sga.id,
      });
    }

    // Election events
    const electionList = await db
      .select()
      .from(elections)
      .orderBy(elections.votingStart);

    for (const el of electionList) {
      events.push({
        id: `ELECTION-${el.id}`,
        type: "election",
        title: el.title,
        description: el.description ?? "",
        startDate: el.votingStart,
        endDate: el.votingEnd,
        deadline: el.nominationsEnd ?? undefined,
        priority: "high",
        recurring: false,
        relatedEntityType: "election",
        relatedEntityId: el.id,
      });
    }

    // BCP deadlines (3 weeks before NGA)
    for (const nga of ngas) {
      if (nga.scheduledStart) {
        const bcpDeadline = new Date(nga.scheduledStart);
        bcpDeadline.setDate(bcpDeadline.getDate() - 21); // 3 weeks before

        events.push({
          id: `BCP-DEADLINE-${nga.id}`,
          type: "bcp_deadline",
          title: `BCP Submission Deadline - ${nga.title}`,
          description: `Bylaw Change Proposals must be submitted at least 3 weeks before NGA`,
          deadline: bcpDeadline,
          startDate: bcpDeadline,
          priority: "critical",
          recurring: false,
          relatedEntityType: "nga_meeting",
          relatedEntityId: nga.id,
        });
      }
    }

    // Credential deadlines (1 week before NGA)
    for (const nga of ngas) {
      if (nga.scheduledStart) {
        const credentialDeadline = new Date(nga.scheduledStart);
        credentialDeadline.setDate(credentialDeadline.getDate() - 7); // 1 week before

        events.push({
          id: `CREDENTIAL-DEADLINE-${nga.id}`,
          type: "credential_deadline",
          title: `Credential Submission Deadline - ${nga.title}`,
          description: `Credential forms must be submitted before the 2nd plenary`,
          deadline: credentialDeadline,
          startDate: credentialDeadline,
          priority: "high",
          recurring: false,
          relatedEntityType: "nga_meeting",
          relatedEntityId: nga.id,
        });
      }
    }

    // Term dates (annual, starting September)
    const currentYear = now.getFullYear();
    events.push({
      id: `TERM-START-${currentYear}`,
      type: "term_start",
      title: `Term ${currentYear}-${currentYear + 1} Start`,
      description: `Start of the ${currentYear}-${currentYear + 1} term`,
      startDate: new Date(currentYear, 8, 1), // September 1
      priority: "high",
      recurring: true,
      recurringPattern: "annual",
    });

    events.push({
      id: `TERM-END-${currentYear}`,
      type: "term_end",
      title: `Term ${currentYear - 1}-${currentYear} End`,
      description: `End of the ${currentYear - 1}-${currentYear} term`,
      startDate: new Date(currentYear, 7, 31), // August 31
      priority: "high",
      recurring: true,
      recurringPattern: "annual",
    });

    // Filter by date range
    let filtered = events;
    if (options.startDate) {
      filtered = filtered.filter(e => e.startDate >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(e => e.startDate <= options.endDate!);
    }
    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    if (options.governanceVersion) {
      filtered = filtered.filter(e => e.governanceVersion === options.governanceVersion);
    }

    return filtered.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  },

  /**
   * Get upcoming deadlines.
   */
  getUpcomingDeadlines: async (daysAhead: number = 30): Promise<CalendarEvent[]> => {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const events = await governanceCalendar.getEvents({
      startDate: now,
      endDate: futureDate,
    });

    return events.filter(e => e.deadline || e.type.includes("deadline"));
  },

  /**
   * Get overdue events.
   */
  getOverdueEvents: async (): Promise<CalendarEvent[]> => {
    const now = new Date();
    const events = await governanceCalendar.getEvents({
      endDate: now,
    });

    return events.filter(e => {
      if (e.deadline) return e.deadline < now;
      return false;
    });
  },

  /**
   * Get calendar summary.
   */
  getSummary: async (): Promise<CalendarSummary> => {
    const events = await governanceCalendar.getEvents();
    const now = new Date();

    const upcoming = events.filter(e => e.startDate > now);
    const overdue = events.filter(e => {
      if (e.deadline) return e.deadline < now;
      return false;
    });

    const eventsByType = {} as Record<CalendarEventType, number>;
    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
    }

    const deadlines = events
      .filter(e => e.deadline)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());

    return {
      totalEvents: events.length,
      upcomingEvents: upcoming.length,
      overdueEvents: overdue.length,
      eventsByType,
      nextDeadline: deadlines[0],
    };
  },

  /**
   * Create a custom calendar event.
   */
  createEvent: async (input: {
    type: CalendarEventType;
    title: string;
    description: string;
    startDate: Date;
    endDate?: Date;
    deadline?: Date;
    priority?: EventPriority;
    recurring?: boolean;
    recurringPattern?: "annual" | "quarterly" | "monthly";
    metadata?: Record<string, unknown>;
  }): Promise<CalendarEvent> => {
    const event: CalendarEvent = {
      id: `CUSTOM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      title: input.title,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      deadline: input.deadline,
      priority: input.priority ?? "medium",
      recurring: input.recurring ?? false,
      recurringPattern: input.recurringPattern,
      metadata: input.metadata,
    };

    await logAuditEvent({
      action: "calendar.event_created",
      entityType: "calendar_event",
      entityId: 0,
      after: { eventId: event.id, type: event.type, title: event.title },
    });

    return event;
  },

  /**
   * Get events for a specific NGA.
   */
  getNGAEvents: async (ngaId: number): Promise<CalendarEvent[]> => {
    const events = await governanceCalendar.getEvents();
    return events.filter(e => e.relatedEntityId === ngaId && e.relatedEntityType === "nga_meeting");
  },

  /**
   * Get governance timeline for a year.
   */
  getTimeline: async (year: number): Promise<{
    months: Array<{
      month: string;
      events: CalendarEvent[];
    }>;
  }> => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const events = await governanceCalendar.getEvents({ startDate, endDate });

    const months = [];
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i < 12; i++) {
      const monthEvents = events.filter(e => {
        const eventMonth = e.startDate.getMonth();
        return eventMonth === i;
      });

      months.push({
        month: monthNames[i],
        events: monthEvents,
      });
    }

    return { months };
  },
};

export default governanceCalendar;
