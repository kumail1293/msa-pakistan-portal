/**
 * Public Governance Transparency Service
 *
 * Read-only service that serves governance data to the public without
 * requiring authentication. Used by the public transparency page to
 * display active bylaws, governance documents, and organizational structure.
 *
 * All data is pre-approved for public viewing — only active/effective
 * rules and published documents are served.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
} from "../../drizzle/schema.governance_rules";
import {
  GOVERNANCE_CONFIG_DEFINITIONS,
} from "./organizationConfigStudio";

// ============================================================================
// Types
// ============================================================================

export interface PublicBylawSection {
  id: string;
  number: string;
  title: string;
  content: string;
  level: "constitution" | "bylaws" | "annex";
  children: PublicBylawSection[];
  clauseId?: string;
}

export interface PublicGovernanceDocument {
  id: number;
  title: string;
  type: string;
  version: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  sectionCount: number;
}

export interface PublicRuleSummary {
  ruleKey: string;
  ruleType: string;
  parameters: Record<string, unknown>;
  clauseId: number | string;
}

export interface PublicGovernanceOverview {
  documentTitle: string;
  documentVersion: string;
  lastAmended: string;
  effectiveFrom: string;
  organizationName: string;
  sections: PublicBylawSection[];
  activeRules: PublicRuleSummary[];
  positions: PublicPosition[];
  committees: string[];
}

export interface PublicPosition {
  title: string;
  body: string;
  electionMethod: string;
  termDuration: string;
}

// ============================================================================
// Bylaws Content — Extracted from the 47-page document
// ============================================================================

const BYLAW_SECTIONS: PublicBylawSection[] = [
  // ── CONSTITUTION ──────────────────────────────────────────────
  {
    id: "C-1",
    number: "1",
    title: "NAME AND SEAT",
    content: "The name of the organization is Medical Students' Association of Pakistan (MSA-Pakistan). The seat of the organization shall be at the national level.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-2",
    number: "2",
    title: "NATURE",
    content: "MSA-Pakistan is a non-political, non-profit, representative body of medical and health sciences students of Pakistan. It is the national member organization of IFMSA (International Federation of Medical Students' Associations).",
    level: "constitution",
    children: [],
  },
  {
    id: "C-3",
    number: "3",
    title: "PRINCIPLES",
    content: "MSA-Pakistan is founded on the principles of democracy, transparency, equality, inclusivity, and service to the medical student community.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-4",
    number: "4",
    title: "MISSION AND OBJECTIVES",
    content: "Mission: To represent, serve, and empower medical and health sciences students of Pakistan through democratic governance, professional development, and advocacy. Vision: A unified, effective, and transparent platform for all medical students of Pakistan. Objectives include promoting medical education, facilitating student exchange, advocating for student rights, and fostering international cooperation.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-5",
    number: "5",
    title: "MEMBERSHIP ELIGIBILITY AND LEADERSHIP CRITERIA",
    content: "Membership is open to enrolled students of MBBS, BDS, DPT, BSN, PharmD, and allied health sciences programs at recognized institutions in Pakistan. Recent graduates within the configured grace period may retain active membership. Leadership positions require additional criteria as defined in the bylaws.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-6",
    number: "6",
    title: "NATIONAL GENERAL ASSEMBLY (NGA)",
    content: "The NGA is the supreme governing body of MSA-Pakistan. It meets at least once per year during the configured NGA window. The NGA has the authority to amend the constitution and bylaws, elect national officials, approve budgets, and make binding governance decisions.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-7",
    number: "7",
    title: "EXECUTIVE BOARD AND TEAM OF OFFICIALS",
    content: "The Executive Board (EB) and Team of Officials (TO) are responsible for the day-to-day management of the organization between NGA sessions. The EB consists of the President, Vice President, Secretary General, and other positions as defined. The TO includes additional officials appointed or elected as specified.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-8",
    number: "8",
    title: "SUPERVISING COUNCIL",
    content: "The Supervising Council provides oversight and guidance to the Executive Board. It consists of the immediate past President and other designated members. The Supervising Council has advisory authority and may propose bylaw changes.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-9",
    number: "9",
    title: "STANDING COMMITTEES",
    content: "Standing committees may be established by the NGA or EBTO for specific areas of governance. Each committee has defined terms of reference, composition, and reporting requirements.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-10",
    number: "10",
    title: "FINANCE",
    content: "The organization shall maintain transparent financial records. All expenditures require proper authorization. The Financial Committee reviews financial reports and the annual budget.",
    level: "constitution",
    children: [],
  },
  {
    id: "C-11",
    number: "11",
    title: "AMENDMENTS",
    content: "The constitution may be amended by a two-thirds (2/3) majority vote at the NGA. Proposed amendments must be submitted as Bylaw Change Proposals (BCPs) at least 3 weeks before the NGA. Only the Supervising Council, EBTO, or two Permanent Local Councils may propose amendments.",
    level: "constitution",
    children: [],
  },

  // ── BYLAWS ────────────────────────────────────────────────────
  {
    id: "B-1",
    number: "1",
    title: "NAME",
    content: "The organization shall be known as the Medical Students' Association of Pakistan, abbreviated as MSA-Pakistan or MSAP.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-6",
    number: "6",
    title: "MEMBERSHIP",
    content: "Membership categories include Regular Members (currently enrolled students), Alumni Members (graduates within the grace period), and Honorary Members (as approved by the NGA). Each member has voting rights at the local council level. National voting rights are exercised through Local Council delegations at the NGA.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-6.23",
    number: "6.23",
    title: "MEMBERSHIP TERMINATION",
    content: "Membership may be terminated through: (a) Voluntary resignation, (b) Conduct violations requiring show-cause proceedings, (c) Non-payment of fees beyond the configured threshold, (d) Prolonged inactivity, or (e) Disciplinary action. Due process including a show-cause notice, response period, and judging panel review is required for involuntary termination. Appeals must be filed within 7 days.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-7",
    number: "7",
    title: "LOCAL COUNCILS",
    content: "Local Councils (LCs) are the grassroots chapters of MSA-Pakistan at each medical institution. LCs may be Permanent, Temporary, or Candidate status. Each LC has its own leadership structure and operates under the national governance framework.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-7.6",
    number: "7.6",
    title: "LC LEADERSHIP",
    content: "Each Local Council shall have a President, Vice President, Secretary, and Treasurer, elected by the LC's general body. LC leadership elections must comply with the national election rules and timelines.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8",
    number: "8",
    title: "NATIONAL GENERAL ASSEMBLY",
    content: "The NGA is the highest decision-making body. It convenes at least once annually. The NGA has authority over constitutional amendments, election of national officers, approval of budgets, and all major governance decisions.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.1",
    number: "8.1",
    title: "NGA PROCEEDINGS",
    content: "The NGA follows a structured lifecycle: Planning → Organizing Committee → Call for Participation → Registration → Credentialing → Preparation → Opening → Plenary → Committees → Elections → Reports → Bylaw Changes → Closing → Certification → Archive.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.4",
    number: "8.4",
    title: "PLENARY PROCEEDINGS",
    content: "Plenary sessions are conducted by the Plenary Team (Chairperson, Vice Chairperson, Secretary, Assistant Secretaries, Returning Officers). Motions follow the lifecycle: proposed → seconded → debated → voted → adopted/rejected. The Chairperson manages speaking rights, points of order, and procedural motions.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.4.11",
    number: "8.4.11",
    title: "PROCEDURAL MOTIONS",
    content: "The following procedural motions are available: (a) Adopt agenda, (b) Change agenda, (c) Open meeting, (d) Adjourn, (e) Proceed to vote, (f) Proceed to next business, (g) Postpone, (h) Postpone indefinitely, (i) Reopen debate, (j) Reopen speakers list, (k) Candidates leave room, (l) Suspend bylaw paragraph, (m) Resume suspended paragraph, (n) Confidential discussion, (o) Overrule chair, (p) Vote of no confidence, (q) Overrule CCC, (r) Observers leave room.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.5",
    number: "8.5",
    title: "POINT OF ORDER",
    content: "Any delegate may raise a Point of Order when the rules of procedure are not being followed. The Chair must rule on the point immediately. A delegation receives a warning after 3 POO in a session. POO takes precedence over all proceedings except voting.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.7",
    number: "8.7",
    title: "VOTING RIGHTS",
    content: "Voting entitlements: Permanent/Temporary LC — 1 plenary vote + 10 election votes (max). Candidate LC / Coordinator Institute — 0 plenary votes + 1 election vote. If a delegation has fewer than 10 eligible delegates, election votes equal the number of delegates. Proxy voting is allowed for bylaw changes only, with a maximum of 2 proxies per delegation.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.7.14",
    number: "8.7.14",
    title: "PROXY VOTING",
    content: "A delegation may grant proxy voting authority to another delegation for bylaw change votes only. Maximum 2 proxies per delegation. Self-proxy is prohibited. The proxy must be documented and filed with the Plenary Team before the relevant vote.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-8.7.16",
    number: "8.7.16",
    title: "OATH OF OFFICE",
    content: "All elected and appointed officials must take an oath of office before assuming duties. The oath may be administered verbally, in writing, electronically, or by digital signature. The oath is recorded and maintained in the official governance records.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-9",
    number: "9",
    title: "EXECUTIVE BOARD AND TEAM OF OFFICIALS",
    content: "The Executive Board consists of the National President, Vice President, Secretary General, and other positions as configured. The Team of Officials includes additional roles. All positions have defined terms, eligibility criteria, election methods, and succession rules.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-10",
    number: "10",
    title: "STANDING COMMITTEES",
    content: "Standing committees include the Constitution Credential Committee (CCC), Financial Committee, and others as established by the NGA. Each committee has defined composition, authority, and reporting requirements.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-11",
    number: "11",
    title: "EXECUTIVE BOARD DUTIES",
    content: "The EB is responsible for implementing NGA decisions, managing organizational operations, overseeing Local Councils, coordinating with international bodies, and ensuring compliance with the constitution and bylaws.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-13",
    number: "13",
    title: "ELECTIONS",
    content: "National elections are conducted at the NGA by the Returning Officers. The election process includes candidate nominations, eligibility verification, campaigning, secret ballot voting, counting, certification, and dispute resolution.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-16",
    number: "16",
    title: "ACTIVITIES",
    content: "MSA-Pakistan organizes activities including NEF (National Executive Forum), NRF (National Research Forum), workshops, seminars, and community service programs. Activity proposals follow the governance approval process.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-17",
    number: "17",
    title: "AMENDMENTS",
    content: "Bylaw changes require a Bylaw Change Proposal (BCP) submitted at least 3 weeks before the NGA. Approval requires a 2/3 supermajority vote. Approved changes take effect immediately unless otherwise specified. Editorial/grammatical changes follow a separate streamlined process.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-17.1",
    number: "17.1",
    title: "BYLAW SUSPENSION",
    content: "Bylaw paragraphs may be temporarily suspended through a Bylaw Suspension Proposal (BSP). Suspension requires written justification and a majority vote. Suspended clauses remain visible as SUSPENDED in the governance records. Certain clauses may be designated as non-suspendable.",
    level: "bylaws",
    children: [],
  },
  {
    id: "B-18",
    number: "18",
    title: "ALUMNI",
    content: "Alumni members who were previously active members may retain certain privileges as defined by the NGA. Alumni may participate in advisory capacities but do not hold voting rights at the NGA.",
    level: "bylaws",
    children: [],
  },
];

// ============================================================================
// Public Governance Service
// ============================================================================

export const publicGovernance = {
  /**
   * Get the full public governance overview.
   */
  getOverview: async (): Promise<PublicGovernanceOverview> => {
    const db = getDb();

    // Get organization name from config
    let orgName = "MSA-Pakistan";
    if (db) {
      try {
        const rows = await db.execute(sql`
          SELECT \`value\` FROM \`configuration\`
          WHERE \`key\` = 'brand.name' LIMIT 1
        `);
        const row = (rows as any[])[0];
        if (row?.value) orgName = row.value;
      } catch {
        // Use default
      }
    }

    // Get active rules summary
    const activeRules = await publicGovernance.getActiveRules();

    return {
      documentTitle: "Constitution & Bylaws",
      documentVersion: "2025-26 Edition",
      lastAmended: "6th September 2025",
      effectiveFrom: "1st October 2025",
      organizationName: orgName,
      sections: BYLAW_SECTIONS,
      activeRules,
      positions: publicGovernance.getPositions(),
      committees: [
        "Constitution Credential Committee (CCC)",
        "Financial Committee",
        "NGA Organizing Committee",
        "Plenary Team",
        "Standing Committees (as established by NGA)",
      ],
    };
  },

  /**
   * Get all bylaw sections.
   */
  getSections: async (level?: "constitution" | "bylaws" | "annex"): Promise<PublicBylawSection[]> => {
    if (level) {
      return BYLAW_SECTIONS.filter((s) => s.level === level);
    }
    return BYLAW_SECTIONS;
  },

  /**
   * Get a specific bylaw section by ID.
   */
  getSection: async (sectionId: string): Promise<PublicBylawSection | null> => {
    return BYLAW_SECTIONS.find((s) => s.id === sectionId) ?? null;
  },

  /**
   * Search bylaw sections by query.
   */
  searchSections: async (query: string): Promise<PublicBylawSection[]> => {
    const q = query.toLowerCase();
    return BYLAW_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.number.includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  },

  /**
   * Get active governance rules from the database.
   */
  getActiveRules: async (): Promise<PublicRuleSummary[]> => {
    const db = getDb();
    if (!db) return [];

    try {
      const rules = await db
        .select()
        .from(governanceRules)
        .where(eq(governanceRules.status, "active"))
        .orderBy(governanceRules.ruleKey);

      return rules.map((r) => ({
        ruleKey: r.ruleKey,
        ruleType: r.ruleType ?? "unknown",
        parameters: (r.parameters as Record<string, unknown>) ?? {},
        clauseId: r.clauseId ?? "",
      }));
    } catch {
      return [];
    }
  },

  /**
   * Get published governance documents.
   */
  getDocuments: async (): Promise<PublicGovernanceDocument[]> => {
    const db = getDb();
    if (!db) return [];

    try {
      const docs = await db
        .select()
        .from(governanceDocuments)
        .where(eq(governanceDocuments.status, "effective"))
        .orderBy(desc(governanceDocuments.effectiveFrom));

      return docs.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type ?? "unknown",
        version: d.version ?? "1.0",
        status: d.status ?? "effective",
        effectiveFrom: d.effectiveFrom ?? null,
        effectiveUntil: d.effectiveUntil ?? null,
        sectionCount: 0,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Get official positions.
   */
  getPositions: (): PublicPosition[] => {
    return [
      {
        title: "National President",
        body: "Executive Board",
        electionMethod: "Elected at NGA",
        termDuration: "1 year",
      },
      {
        title: "Vice President",
        body: "Executive Board",
        electionMethod: "Elected at NGA",
        termDuration: "1 year",
      },
      {
        title: "Secretary General",
        body: "Executive Board",
        electionMethod: "Elected at NGA",
        termDuration: "1 year",
      },
      {
        title: "Treasurer",
        body: "Executive Board",
        electionMethod: "Elected at NGA",
        termDuration: "1 year",
      },
      {
        title: "Regional Coordinators",
        body: "Team of Officials",
        electionMethod: "Appointed by EBTO",
        termDuration: "1 year",
      },
      {
        title: "Standing Committee Chairs",
        body: "Standing Committees",
        electionMethod: "Elected/Appointed",
        termDuration: "1 year",
      },
    ];
  },
};

export default publicGovernance;
