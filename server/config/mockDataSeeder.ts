/**
 * Comprehensive Mock Data Seeder
 *
 * Generates realistic Pakistani medical student data for all portal modules.
 * Seeded once on server start; data lives in-memory (same pattern as engines).
 */

import { activitiesEngine } from "./activitiesEngine";
import { eventsEngine } from "./eventsEngine";
import { chaptersEngine } from "./chaptersEngine";
import { projectsEngine } from "./projectsEngine";
import { trainingEngine } from "./trainingEngine";
import { meetingsEngine } from "./meetingsEngine";
import { volunteerEngine } from "./volunteerEngine";
import { recognitionEngine } from "./recognitionEngine";
import { communicationsEngine } from "./communicationsEngine";
import { cmsEngine } from "./cmsEngine";

// ============================================================================
// Pakistani Medical University / Institution Data
// ============================================================================

const INSTITUTIONS = [
  { name: "King Edward Medical University", shortCode: "KEMU", city: "Lahore", province: "Punjab", type: "medical_university" },
  { name: "Aga Khan University", shortCode: "AKU", city: "Karachi", province: "Sindh", type: "medical_university" },
  { name: "Dow University of Health Sciences", shortCode: "DUHS", city: "Karachi", province: "Sindh", type: "medical_university" },
  { name: "Allama Iqbal Medical College", shortCode: "AIMC", city: "Lahore", province: "Punjab", type: "medical_college" },
  { name: "Punjab Medical College", shortCode: "PMC", city: "Faisalabad", province: "Punjab", type: "medical_college" },
  { name: "Nishtar Medical University", shortCode: "NMU", city: "Multan", province: "Punjab", type: "medical_university" },
  { name: "Rawalpindi Medical University", shortCode: "RMU", city: "Rawalpindi", province: "Punjab", type: "medical_university" },
  { name: "Services Institute of Medical Sciences", shortCode: "SIMS", city: "Lahore", province: "Punjab", type: "medical_college" },
  { name: "Quaid-i-Azam Medical College", shortCode: "QAMC", city: "Bahawalpur", province: "Punjab", type: "medical_college" },
  { name: "Sindh Medical College", shortCode: "SMC", city: "Karachi", province: "Sindh", type: "medical_college" },
  { name: "Jinnah Sindh Medical University", shortCode: "JSMU", city: "Karachi", province: "Sindh", type: "medical_university" },
  { name: "Liaquat University of Medical & Health Sciences", shortCode: "LUMHS", city: "Jamshoro", province: "Sindh", type: "medical_university" },
  { name: "Khyber Medical University", shortCode: "KMU", city: "Peshawar", province: "KPK", type: "medical_university" },
  { name: "Khyber Medical College", shortCode: "KMC", city: "Peshawar", province: "KPK", type: "medical_college" },
  { name: "Bolan Medical College", shortCode: "BMC", city: "Quetta", province: "Balochistan", type: "medical_college" },
  { name: "Faisalabad Medical University", shortCode: "FMU", city: "Faisalabad", province: "Punjab", type: "medical_university" },
  { name: "Gujranwala Medical College", shortCode: "GMC", city: "Gujranwala", province: "Punjab", type: "medical_college" },
  { name: "Sahiwal Medical College", shortCode: "SAHMC", city: "Sahiwal", province: "Punjab", type: "medical_college" },
  { name: "Khawaja Safdar Medical College", shortCode: "KSMC", city: "Sialkot", province: "Punjab", type: "medical_college" },
  { name: "Government Medical College for Women", shortCode: "GMCW", city: "Multan", province: "Punjab", type: "medical_college" },
];

// ============================================================================
// Local Council Data
// ============================================================================

const LOCAL_COUNCILS = [
  { name: "MSA-Pakistan KEMU LC", shortCode: "KEMU-LC", institutionIdx: 0, city: "Lahore", region: "Punjab Central" },
  { name: "MSA-Pakistan AKU LC", shortCode: "AKU-LC", institutionIdx: 1, city: "Karachi", region: "Sindh Urban" },
  { name: "MSA-Pakistan DUHS LC", shortCode: "DUHS-LC", institutionIdx: 2, city: "Karachi", region: "Sindh Urban" },
  { name: "MSA-Pakistan AIMC LC", shortCode: "AIMC-LC", institutionIdx: 3, city: "Lahore", region: "Punjab Central" },
  { name: "MSA-Pakistan PMC LC", shortCode: "PMC-LC", institutionIdx: 4, city: "Faisalabad", region: "Punjab South" },
  { name: "MSA-Pakistan NMU LC", shortCode: "NMU-LC", institutionIdx: 5, city: "Multan", region: "Punjab South" },
  { name: "MSA-Pakistan RMU LC", shortCode: "RMU-LC", institutionIdx: 6, city: "Rawalpindi", region: "Punjab North" },
  { name: "MSA-Pakistan SIMS LC", shortCode: "SIMS-LC", institutionIdx: 7, city: "Lahore", region: "Punjab Central" },
  { name: "MSA-Pakistan QAMC LC", shortCode: "QAMC-LC", institutionIdx: 8, city: "Bahawalpur", region: "Punjab South" },
  { name: "MSA-Pakistan KMU LC", shortCode: "KMU-LC", institutionIdx: 12, city: "Peshawar", region: "KPK" },
  { name: "MSA-Pakistan BMC LC", shortCode: "BMC-LC", institutionIdx: 14, city: "Quetta", region: "Balochistan" },
  { name: "MSA-Pakistan FMU LC", shortCode: "FMU-LC", institutionIdx: 15, city: "Faisalabad", region: "Punjab South" },
  // Regional councils (no institution)
  { name: "MSA-Pakistan Punjab Region", shortCode: "PUNJAB-R", institutionIdx: -1, city: "Lahore", region: "Punjab" },
  { name: "MSA-Pakistan Sindh Region", shortCode: "SINDH-R", institutionIdx: -1, city: "Karachi", region: "Sindh" },
  { name: "MSA-Pakistan KPK Region", shortCode: "KPK-R", institutionIdx: -1, city: "Peshawar", region: "KPK" },
  { name: "MSA-Pakistan Balochistan Region", shortCode: "BAL-R", institutionIdx: -1, city: "Quetta", region: "Balochistan" },
  // Standing committees
  { name: "SC Health Policy & Advocacy", shortCode: "SC-HPA", institutionIdx: -1, city: "Islamabad", region: "National" },
  { name: "SC Medical Education", shortCode: "SC-ME", institutionIdx: -1, city: "Lahore", region: "National" },
  { name: "SC Research & Innovation", shortCode: "SC-RI", institutionIdx: -1, city: "Karachi", region: "National" },
  { name: "SC Community Health", shortCode: "SC-CH", institutionIdx: -1, city: "Peshawar", region: "National" },
];

// ============================================================================
// Activity / Event / Training / Meeting Data
// ============================================================================

const ACTIVITIES_DATA = [
  { title: "Community Health Screening Camp", type: "health_camp", city: "Lahore", description: "Free blood pressure, diabetes, and BMI screening for underserved communities." },
  { title: "Medical Ethics Workshop", type: "workshop", city: "Karachi", description: "Interactive workshop on ethical dilemmas in clinical practice." },
  { title: "Blood Donation Drive — Campus Edition", type: "blood_donation", city: "Islamabad", description: "Annual blood donation campaign across all medical colleges." },
  { title: "First Aid Training Bootcamp", type: "training", city: "Peshawar", description: "Hands-on first aid and CPR training for 200+ medical students." },
  { title: "Mental Health Awareness Week", type: "awareness", city: "Multan", description: "Week-long campaign on student mental health with peer support." },
  { title: "Research Methodology Seminar", type: "seminar", city: "Faisalabad", description: "Workshop on biostatistics, study design, and manuscript writing." },
  { title: "Pediatric Ward Volunteering", type: "volunteering", city: "Lahore", description: "Weekly volunteering at pediatric wards in teaching hospitals." },
  { title: "Anti-Smoking Campaign — Quit Now", type: "awareness", city: "Karachi", description: "Public awareness campaign on tobacco use and cessation." },
  { title: "Surgical Skills Workshop", type: "workshop", city: "Rawalpindi", description: "Hands-on suturing, knot-tying, and basic surgical skills." },
  { title: "Public Health Policy Debate", type: "debate", city: "Islamabad", description: "Inter-university debate on universal health coverage." },
  { title: "Eye Camp — Rural Outreach", type: "health_camp", city: "Bahawalpur", description: "Free eye screening and glasses distribution in rural areas." },
  { title: "COVID-19 Vaccination Awareness", type: "awareness", city: "Quetta", description: "Community session on vaccine hesitancy and misinformation." },
];

const EVENTS_DATA = [
  { title: "Annual MSAP National Conference 2026", type: "conference", city: "Islamabad", description: "3-day national conference on medical education, research, and leadership." },
  { title: "Inter-University Medical Quiz", type: "competition", city: "Lahore", description: "National-level medical quiz competition between all chapters." },
  { title: "MSAP Leadership Summit", type: "summit", city: "Karachi", description: "Leadership development summit for chapter presidents." },
  { title: "World Health Day Observance", type: "observance", city: "All Cities", description: "Simultaneous events across all local councils." },
  { title: "Research Paper Presentation Day", type: "academic", city: "Peshawar", description: "Students present original research papers with faculty panel." },
  { title: "Medical Art & Photography Exhibition", type: "cultural", city: "Multan", description: "Showcasing medical illustrations and clinical photography." },
  { title: "Physiotherapy Awareness Walk", type: "awareness", city: "Faisalabad", description: "Public walk promoting physiotherapy and rehabilitation." },
  { title: "Surgical Skills Olympiad", type: "competition", city: "Rawalpindi", description: "Competitive surgical skills event for final-year students." },
];

const COURSES_DATA = [
  { title: "Evidence-Based Medicine Fundamentals", category: "Research", description: "Systematic review, meta-analysis, and clinical evidence appraisal.", duration: 6, enrolledCount: 234 },
  { title: "Leadership in Healthcare Organizations", category: "Leadership", description: "Management and leadership skills for healthcare administrators.", duration: 8, enrolledCount: 189 },
  { title: "Medical Research Ethics (CIOMS)", category: "Ethics", description: "International ethics guidelines for human subjects research.", duration: 4, enrolledCount: 312 },
  { title: "Clinical Communication Skills", category: "Clinical", description: "Patient interview techniques, history taking, breaking bad news.", duration: 5, enrolledCount: 456 },
  { title: "Community Medicine & Public Health", category: "Public Health", description: "Epidemiology, biostatistics, and community health assessment.", duration: 10, enrolledCount: 521 },
  { title: "Trauma & Emergency Care Basics", category: "Emergency", description: "ATLS principles, triage, and emergency department protocols.", duration: 3, enrolledCount: 198 },
  { title: "Medical Writing & Publication", category: "Research", description: "Write case reports, original articles, and review papers.", duration: 6, enrolledCount: 167 },
  { title: "Mental Health First Aid", category: "Mental Health", description: "Recognize and respond to mental health crises.", duration: 2, enrolledCount: 389 },
];

const PROJECTS_DATA = [
  { title: "Telemedicine Pilot for Rural Sindh", description: "Establish telemedicine links between urban specialists and rural clinics." },
  { title: "Medical Education Curriculum Reform", description: "Advocate for competency-based medical education reform." },
  { title: "Digital Health Records for LCs", description: "Develop digital membership and activity tracking system." },
  { title: "Maternal Health Awareness App", description: "Mobile app for maternal health education in Urdu." },
  { title: "Campus Mental Health Helpline", description: "Peer-run mental health helpline for medical students." },
  { title: "Medical Equipment Recycling Drive", description: "Collect and refurbish equipment for rural health facilities." },
];

const VOLUNTEER_DATA = [
  { title: "Street Health Clinic Volunteer", type: "clinical", description: "Assist in free street health clinics.", maxVolunteers: 20 },
  { title: "Health Literacy Workshop Facilitator", type: "education", description: "Lead health literacy sessions in community centers.", maxVolunteers: 15 },
  { title: "Blood Donation Camp Coordinator", type: "events", description: "Coordinate logistics for blood donation camps.", maxVolunteers: 10 },
  { title: "Mental Health Peer Counselor", type: "counseling", description: "Provide peer support for distressed students.", maxVolunteers: 25 },
  { title: "Disaster Response Team Member", type: "emergency", description: "Join the MSAP disaster response readiness team.", maxVolunteers: 30 },
  { title: "Medical Journal Peer Reviewer", type: "academic", description: "Review student research papers.", maxVolunteers: 12 },
];

const AWARDS_DATA = [
  { title: "Best Research Paper — National Conference 2025", category: "research", description: "Awarded for outstanding original research presented at the national conference." },
  { title: "Outstanding Chapter President Award", category: "leadership", description: "Recognizing exceptional chapter leadership and growth." },
  { title: "Community Health Champion", category: "community", description: "For significant community health impact through MSAP activities." },
  { title: "Best Medical Education Initiative", category: "education", description: "Innovative contribution to medical education quality." },
  { title: "MSAP Volunteer of the Year", category: "volunteer", description: "Outstanding volunteer service and dedication." },
  { title: "Innovation in Healthcare Award", category: "innovation", description: "Novel healthcare solutions and digital health initiatives." },
  { title: "Outstanding LC Secretary", category: "leadership", description: "Exceptional administrative and organizational leadership." },
  { title: "Research Excellence — Clinical Sciences", category: "research", description: "Outstanding contribution to clinical science research." },
];

const ANNOUNCEMENTS_DATA = [
  { title: "National Conference Registration Open", content: "Registration for Annual MSAP National Conference 2026 is now open. Early bird discount until March 15.", priority: "high" as const, type: "events" },
  { title: "New Member Onboarding — Batch 2026", content: "Welcome new members! Onboarding sessions at all local councils this week.", priority: "normal" as const, type: "membership" },
  { title: "Research Grant Applications Due", content: "Last date for research grant applications is February 28. Apply through the portal.", priority: "high" as const, type: "research" },
  { title: "LC Elections — Schedule Released", content: "Local council elections will be conducted in March. Check your LC page for details.", priority: "normal" as const, type: "governance" },
  { title: "Emergency Health Advisory — Dengue Season", content: "Dengue prevention sessions at all campuses. Volunteers needed.", priority: "high" as const, type: "health" },
  { title: "Training Platform Upgrade Complete", content: "MSAP online training platform upgraded with new courses and certificate system.", priority: "normal" as const, type: "training" },
];

const MEETINGS_DATA = [
  { title: "National Executive Board Meeting", type: "executive", description: "Quarterly NEB meeting to review national strategy and finances.", isFuture: true },
  { title: "Punjab Regional Coordination Meeting", type: "board", description: "Coordination for all Punjab local council representatives.", isFuture: true },
  { title: "Standing Committee on Health Policy", type: "committee", description: "Monthly meeting to discuss health policy advocacy.", isFuture: true },
  { title: "Sindh LC Presidents Roundtable", type: "board", description: "Discussion on membership growth and event planning.", isFuture: false },
  { title: "Annual General Meeting 2025", type: "board", description: "Annual general meeting with all stakeholders.", isFuture: false },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

let seeded = false;

export async function seedMockData(): Promise<void> {
  if (seeded) return;

  // SAFETY: Never seed mock data in production
  if (process.env.NODE_ENV === "production") {
    console.warn("[MockData] ⚠ BLOCKED — refusing to seed mock data in production (NODE_ENV=production)");
    return;
  }

  // SAFETY: Require explicit opt-in flag even in development
  if (!process.env.MSAP_SEED_MOCK_DATA) {
    console.info("[MockData] Skipping — set MSAP_SEED_MOCK_DATA=true to enable");
    return;
  }

  seeded = true;
  console.log("[MockData] Seeding comprehensive mock data (development only)...");

  // ── Activities ──
  for (const a of ACTIVITIES_DATA) {
    const offset = Math.random() * 90 * 24 * 60 * 60 * 1000;
    await activitiesEngine.create({
      title: a.title,
      description: a.description,
      type: a.type,
      city: a.city,
      startDate: new Date(Date.now() + offset),
      endDate: new Date(Date.now() + offset + 2 * 24 * 60 * 60 * 1000),
      maxParticipants: 50 + Math.floor(Math.random() * 200),
      venue: `${a.city} Medical Center`,
    });
  }
  console.log(`[MockData]   ✓ ${ACTIVITIES_DATA.length} activities`);

  // ── Events ──
  for (const e of EVENTS_DATA) {
    const startOffset = (30 + Math.random() * 180) * 24 * 60 * 60 * 1000;
    await eventsEngine.create({
      title: e.title,
      description: e.description,
      type: e.type,
      city: e.city,
      startDate: new Date(Date.now() + startOffset),
      endDate: new Date(Date.now() + startOffset + 3 * 24 * 60 * 60 * 1000),
      maxCapacity: 100 + Math.floor(Math.random() * 500),
      venue: `${e.city} Convention Center`,
    });
  }
  console.log(`[MockData]   ✓ ${EVENTS_DATA.length} events`);

  // ── Chapters (Local Councils + Regional + Standing Committees) ──
  for (const lc of LOCAL_COUNCILS) {
    const type = lc.institutionIdx >= 0 ? "permanent" : (lc.region === "National" ? "candidate" : "temporary");
    await chaptersEngine.create({
      name: lc.name,
      shortName: lc.shortCode,
      city: lc.city,
      province: lc.region,
      type,
    });
  }
  console.log(`[MockData]   ✓ ${LOCAL_COUNCILS.length} chapters/councils`);

  // ── Projects ──
  for (const p of PROJECTS_DATA) {
    await projectsEngine.create({
      title: p.title,
      description: p.description,
      startDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      budget: Math.floor(Math.random() * 500000) + 50000,
    });
  }
  console.log(`[MockData]   ✓ ${PROJECTS_DATA.length} projects`);

  // ── Training Courses ──
  for (const c of COURSES_DATA) {
    await trainingEngine.createCourse({
      title: c.title,
      description: c.description,
      category: c.category,
      duration: c.duration,
      maxEnrollments: c.enrolledCount + 100,
      passingScore: 70,
    });
  }
  console.log(`[MockData]   ✓ ${COURSES_DATA.length} courses`);

  // ── Meetings ──
  for (const m of MEETINGS_DATA) {
    const daysOffset = m.isFuture ? 14 + Math.random() * 60 : -(14 + Math.random() * 60);
    await meetingsEngine.create({
      title: m.title,
      type: m.type,
      scheduledDate: new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000),
      venue: "MSAP National Office, Islamabad",
    });
  }
  console.log(`[MockData]   ✓ ${MEETINGS_DATA.length} meetings`);

  // ── Volunteer Opportunities ──
  for (const v of VOLUNTEER_DATA) {
    await volunteerEngine.createOpportunity({
      title: v.title,
      description: v.description,
      type: v.type,
      maxVolunteers: v.maxVolunteers,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }
  console.log(`[MockData]   ✓ ${VOLUNTEER_DATA.length} volunteer opportunities`);

  // ── Awards ──
  for (const a of AWARDS_DATA) {
    await recognitionEngine.createAward({
      title: a.title,
      description: a.description,
      category: a.category,
      frequency: "annual",
    });
  }
  console.log(`[MockData]   ✓ ${AWARDS_DATA.length} awards`);

  // ── Announcements ──
  for (const a of ANNOUNCEMENTS_DATA) {
    await communicationsEngine.createAnnouncement({
      title: a.title,
      content: a.content,
      priority: a.priority,
      type: a.type,
    });
  }
  console.log(`[MockData]   ✓ ${ANNOUNCEMENTS_DATA.length} announcements`);

  // ── CMS Pages (pre-built for page builder) ──
  seedCMSContent();
  console.log(`[MockData]   ✓ CMS pages seeded`);

  console.log("[MockData] Mock data seeded successfully.");
}

function seedCMSContent(): void {
  const builderPages = [
    { slug: "about-us", title: "About MSA Pakistan", description: "Learn about our mission, vision, and history" },
    { slug: "local-councils", title: "Local Councils", description: "Directory of all MSAP local councils across Pakistan" },
    { slug: "events-page", title: "Events & Conferences", description: "Upcoming and past MSAP events" },
    { slug: "contact-us", title: "Contact Us", description: "Get in touch with MSAP leadership" },
    { slug: "join-msap", title: "Join MSA Pakistan", description: "Membership application and information" },
  ];

  for (const p of builderPages) {
    const existing = cmsEngine.getPageBySlug(p.slug);
    if (!existing) {
      cmsEngine.createPage({
        slug: p.slug,
        title: p.title,
        content: null,
        contentHtml: null,
        excerpt: p.description,
        template: "default",
        status: "published",
        authorId: null,
        parentId: null,
        metaTitle: null,
        metaDescription: null,
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
    }
  }
}

/**
 * Get a summary of all seeded mock data counts.
 */
export function getMockDataStats(): Record<string, number> {
  return {
    institutions: INSTITUTIONS.length,
    localCouncils: LOCAL_COUNCILS.length,
    activities: ACTIVITIES_DATA.length,
    events: EVENTS_DATA.length,
    courses: COURSES_DATA.length,
    projects: PROJECTS_DATA.length,
    volunteers: VOLUNTEER_DATA.length,
    awards: AWARDS_DATA.length,
    announcements: ANNOUNCEMENTS_DATA.length,
    meetings: MEETINGS_DATA.length,
    sampleMembers: 50,
    cmsPages: 5,
  };
}
