/**
 * =============================================================================
 * MEDICAL STUDENTS' ASSOCIATION OF PAKISTAN (MSAP)
 * PROJECT  : MEMBERSHIP ERP & VERIFICATION SYSTEM
 * VERSION  : 7.3 — DOUBLE onEdit-FIRE (DROPDOWN) DEBOUNCE FIX
 * UPDATED  : 11 Aug 2026
 * AUTHOR   : Kumail Danial, President MSA Pakistan 2025/26
 * =============================================================================
 * CHANGELOG v7.2 → v7.3  (non-destructive; no existing data touched)
 * ── BUG FIXES ─────────────────────────────────────────────────────────────────
 * [B14] diagnoseTriggers() confirmed only ONE onWorkflowEdit trigger was
 *        installed, ruling out duplicate triggers as the cause of: (a) the
 *        Emergency Override dialog appearing twice with identical text on a
 *        single Presidential approval, and (b) one Mem_ID number silently
 *        vanishing per approval (v7.2's reservation guard correctly blocked
 *        the second, near-simultaneous processing run from writing a
 *        duplicate ID — but the already-incremented LC counter, per the
 *        no-rewind-counters rule, was not reused). Root cause is a known
 *        Google Sheets behavior: selecting a value from a data-validation
 *        dropdown (Pres_Status/VPF_Status/VPM_Status all use one) can fire
 *        onEdit twice for a single selection. FIX: onWorkflowEdit now
 *        debounces on the exact edit fingerprint (row+col+value) via
 *        CacheService before any other logic runs, so the repeat firing is
 *        ignored outright — no second dialog, no ID generated-then-discarded,
 *        for this or any other dropdown-driven action (VPF/VPM Issue emails,
 *        rejection emails) that shared the same underlying exposure.
 * =============================================================================
 * CHANGELOG v7.1 → v7.2  (non-destructive; no existing data touched)
 * ── BUG FIXES ─────────────────────────────────────────────────────────────────
 * [B12] v7.1's lock only protected against two executions racing on the SAME
 *        row. It never checked whether a DIFFERENT row already held a Mem_ID
 *        for the same person — so a row already flagged Dup_CNIC_Flag=
 *        "DUPLICATE" at sync time could still sail through approval, and
 *        bulkMigrateOldMembers() (which calls generateMembershipID_ directly,
 *        bypassing processApproval_'s lock entirely) could do the same — both
 *        issuing a second, valid, non-colliding Mem_ID to the same CNIC.
 *        FIX: new reserveMembershipIdForRow_() is now the single, lock-
 *        protected choke point for writing any Mem_ID. It re-checks (a) this
 *        row hasn't already been given an ID [existing B9 guard] and (b) no
 *        OTHER row already holds a Mem_ID for this row's CNIC
 *        [findExistingMemIdForCNIC_()]. Both processApproval_ (President
 *        approval / Emergency Override) and bulkMigrateOldMembers() now call
 *        it — no code path can generate a duplicate-person ID anymore. On a
 *        block, Pres_Status reverts to Pending, nothing else on the row is
 *        touched, and DUPLICATE_CNIC_APPROVAL_BLOCKED is logged.
 * ── NEW (read-only / administrative, does not alter existing data) ─────────
 * [N13] findDuplicatePersonMemIDs_REPORT_ONLY() — scans Membership Workflow
 *        by CNIC and reports (does not modify) any person already holding
 *        more than one Mem_ID, so you can decide manually which to keep.
 * =============================================================================
 * CHANGELOG v7.0 → v7.1  (non-destructive; no existing data touched)
 * ── BUG FIXES ─────────────────────────────────────────────────────────────────
 * [B9]  processApproval_ was non-atomic: the "already has Mem_ID?" check and
 *        the eventual write were separated by PDF/email/WhatsApp calls, so a
 *        second trigger firing (or a duplicate onWorkflowEdit trigger already
 *        installed on the project) could pass the check before the first run
 *        finished, generating a second ID/cert/email for the same row.
 *        FIX: ID reservation (check + write) now happens inside a single
 *        LockService-protected block, re-reading the cell fresh under lock.
 *        A second concurrent run now safely no-ops and logs
 *        DUPLICATE_APPROVAL_BLOCKED instead of issuing a duplicate.
 * [B10] Manual LC-code fallback (used when an institute name doesn't match
 *        LC Mapping) always produced "-0001-" on every use, so any institute
 *        that repeatedly failed to auto-match (e.g. spelling variants) got
 *        the SAME Mem_ID issued to different people every time. FIX: new
 *        resolveManualMembershipID_() looks up the entered code against the
 *        real LC Mapping counter first, and otherwise persists its own
 *        counter in Document Properties — it can no longer repeat an ID.
 * [B11] Interactive ui.prompt() for manual codes no longer runs inside any
 *        lock, so one admin waiting on the dialog can no longer block other
 *        admins' approvals from proceeding.
 * ── NEW (read-only / administrative, does not alter existing data) ─────────
 * [N10] diagnoseTriggers() — lists installed triggers per handler function,
 *        so you can see if onWorkflowEdit is duplicated.
 * [N11] removeDuplicateOnWorkflowEditTriggers_ADMIN_ONLY() — manually
 *        invoked only; keeps one onWorkflowEdit trigger, deletes any extras.
 *        Touches trigger metadata only, never spreadsheet data.
 * [N12] findDuplicateMemIDs_REPORT_ONLY() — scans Membership Workflow and
 *        reports (does not modify) any Mem_ID value assigned to more than
 *        one row, for manual review.
 * =============================================================================
 * CHANGELOG v6.0 → v7.0
 * ── BUG FIXES ─────────────────────────────────────────────────────────────────
 * [B1]  refreshDashboard_: LC matching now uses full institute name (not code)
 *        → fixes all-zeros Dashboard
 * [B2]  createWeeklyBackup duplicate removed from §13
 * [B3]  COI: normalizeCOI_() helper normalises "Nope/Nil/Not yet/." → "No"
 *        onWorkflowEdit COI block uses normalised value
 * [B4]  checkExpiryAlerts_: gradYear extracted from Date object, not regex
 * [B5]  syncResponses: Year_Grad stored as 4-digit year string, not datetime
 * [B6]  retroactiveDuplicateCheck() added — flags pre-v6 duplicate CNICs
 * [B7]  29 new institute aliases added: FMC (fixes 39 rows), HCMD, MMC,
 *        CPMC, BAMDC, BMC, CKMC, CHMC, CIMS, DGKMC, FDC, GKMC, GIMS,
 *        IMC, IMCH, IIDC, KGMC, LUMHS, LMCL, MIMDC, PUMHS, QIMS, RMDC,
 *        SMCN, SDMC, SMDC, UMDCF, WMC + consolidated duplicate AIMC entry
 * [B8]  syncResponses: skipped rows logged to Audit (not silently dropped)
 * ── LOGIC FIXES ───────────────────────────────────────────────────────────────
 * [L1]  standardizeInstitute_: alias partial-match has 4-char min guard
 * [L2]  sendRejectionEmail_ / sendIssueEmail_: Admin_Comments HTML-escaped
 * [L3]  onWorkflowEdit: Issue status requires non-empty Admin_Comments first
 * [L4]  sendLCRosters: batch cap of 150 members per run (6-min timeout guard)
 * [L5]  Portal token: timestamp-embedded (format token:::ts); 30-day expiry
 * [L6]  notifyOfficials: thresholds now configurable via CONFIG
 * ── NEW FEATURES ──────────────────────────────────────────────────────────────
 * [N1]  batchVerifyVPF_() / batchVerifyVPM_(): bulk verify selected rows
 * [N2]  scanApplicationCompleteness_(): scores each row 0–100, col Y heat-map
 * [N3]  retroactiveDuplicateCheck() in menu under Utilities
 * [N4]  StatusPage.html: member self-check page (doGet?mode=status)
 * [N5]  Portal.html: discipline-aware year dropdown; Discipline + GradYear cols;
 *        CSV export button
 * [N6]  refreshDashboard_: per-LC discipline breakdown (MBBS|BDS|DPT|Other)
 * [N7]  escapeHtml_() helper used in all admin-comment email insertions
 * [N8]  feeReceiptHyperlinks_(): converts col-U URLs to clickable formulas
 * [N9]  CONFIG: CONSTITUTION_YEAR, NOTIFY_*_THRESHOLD, PORTAL_TOKEN_VALIDITY_DAYS
 * =============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// §0 — COLUMN INDEX CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const WF_COL = {
  TIMESTAMP:      0,   // A
  EMAIL:          1,   // B
  PERSONAL_EMAIL: 2,   // C
  FULL_NAME:      3,   // D
  PHONE:          4,   // E
  DISCIPLINE:     5,   // F
  CLASS_YEAR:     6,   // G
  YEAR_GRAD:      7,   // H
  CNIC:           8,   // I
  GENDER:         9,   // J
  INSTITUTE:      10,  // K
  VPF_STATUS:     11,  // L
  VPM_STATUS:     12,  // M
  PRES_STATUS:    13,  // N
  ADMIN_COMMENTS: 14,  // O
  COI:            15,  // P
  MEM_ID:         16,  // Q
  CERT_URL:       17,  // R
  LC_NOTIFIED:    18,  // S
  CARD_URL:       19,  // T
  FEE_URL:        20,  // U
  CNIC_PHOTO_URL: 21,  // V
  DUP_FLAG:       22,  // W
  COMPLETENESS:   23   // X  [N2]
};
const WF_TOTAL_COLS = 24; // [N2] added Completeness col

const MAP_COL = {
  INSTITUTE: 0,
  LC_NAME:   1,
  LC_CODE:   2,
  COUNTER:   3,
  EMAIL:     4,
  LEGACY:    5,
  ALIASES:   6,
  TOKEN:     7   // stores "token:::timestamp" [L5]
};
const MAP_TOTAL_COLS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// §1 — CORE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  VERSION:             "7.3",  // [B13] single source of truth — bump this each release, nothing else
  ORG_NAME:            "Medical Students' Association of Pakistan",
  ORG_ABBR:            "MSA Pakistan",
  TERM:                "2025-26",
  CONSTITUTION_YEAR:   "2024-25",  // [N9] update each year

  SENDER_EMAIL:        "vpm@msapakistan.org",
  SENDER_DISPLAY_NAME: "MSA Pakistan",
  VPM_NAME:            "M. Sarim Sheikh",
  VPM_PRONOUNS:        "(he/him)",
  VPM_TITLE:           "Vice President for Members",
  VPM_PHONE:           "+92 3243788961",

  LOGO_URL:  "https://msapakistan.org/wp-content/uploads/2021/06/MSA_Pakistan_Logo_White_Horizontal_V2-1536x664.png",
  LEAF_ICON: "https://img.icons8.com/color/48/leaf.png",

  WA_GROUP_1:       "https://chat.whatsapp.com/J9oHuEh7gx794lxUPTKUws",
  WA_GROUP_2:       "https://chat.whatsapp.com/BygdtAgo0Z20n1v7Aohpaz",
  WA_CHANNEL:       "https://whatsapp.com/channel/0029Vb6q2rhGOj9m2xVG7g1D",
  CONSTITUTION_URL: "https://msapakistan.org/wp-content/uploads/2025/01/Constitution-Bylaws-MSA-Pakistan-2024-25.pdf",
  FB_GROUP_LINK:    "https://www.facebook.com/groups/2722064044621107/",

  FB_LINK: "https://facebook.com/msap.pakistan",
  IG_LINK: "https://instagram.com/msapakistan",
  TW_LINK: "https://twitter.com/msap_pakistan",
  YT_LINK: "https://youtube.com/@msap_pakistan",
  LI_LINK: "https://linkedin.com/company/msapakistan",
  IS_LINK: "https://issuu.com/msapakistan",
  LT_LINK: "https://www.linktr.ee/msapakistan",

  ALLOWED_APPROVERS: [
    "president@msapakistan.org",
    "vpm@msapakistan.org",
    "president.msap@gmail.com",
    "vpm.msap@gmail.com",
    "vpi.msap@gmail.com"
  ],

  BACKUP_FOLDER_ID: "1xtGLJHvZRWVEWotp1RZre981R0_L263Z",
  CERT_TEMPLATE_ID: "1C5N9AVkQ8f3P0zK57ECCtKkRHrek7_3H8uC1LrbT-ws",
  CARD_TEMPLATE_ID: "YOUR_ID_CARD_TEMPLATE_ID_HERE",
  CERT_FOLDER_ID:   "1LbqPuooGhX7VCRJBggBCReyeoab9Fx0g",
  PDF_ACCESS:       "PUBLIC",

  // Twilio
  TWILIO_SID:        "YOUR_TWILIO_ACCOUNT_SID",
  TWILIO_TOKEN:      "YOUR_TWILIO_AUTH_TOKEN",
  TWILIO_WA_NUMBER:  "whatsapp:+14155238886",
  TWILIO_SMS_NUMBER: "YOUR_TWILIO_SMS_PHONE_NUMBER",

  EMAIL_VPF:       "vpf@msapakistan.org",
  EMAIL_VPM:       "vpm@msapakistan.org",
  EMAIL_PRESIDENT: "president@msapakistan.org",

  SHEET_SOURCE:    "Form Responses 1",
  SHEET_WORKFLOW:  "Membership Workflow",
  SHEET_MAPPING:   "LC Mapping",
  SHEET_AUDIT:     "🛡️ Audit Log",
  SHEET_RETRY:     "📧 Retry Queue",
  SHEET_DASHBOARD: "📊 Dashboard",

  // [N9] Configurable notification thresholds
  NOTIFY_VPF_THRESHOLD:  10,
  NOTIFY_VPM_THRESHOLD:  10,
  NOTIFY_PRES_THRESHOLD:  5,

  // [L5] Portal token expiry in days
  PORTAL_TOKEN_VALIDITY_DAYS: 30,

  // [L4] Max members processed per sendLCRosters run
  ROSTER_BATCH_LIMIT: 150,

  // Portal application bridge
  PORTAL_APP_URL: "https://YOUR-PORTAL-DOMAIN.example",
  MEMBERSHIP_UPLOAD_FOLDER_ID: "YOUR_MEMBERSHIP_UPLOAD_FOLDER_ID"
};

// ─────────────────────────────────────────────────────────────────────────────
// §2 — UI MENU & SYSTEM INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(`🏥 MSAP ERP v${CONFIG.VERSION}`)
    .addItem("⚙️ 1. Run Initial Setup",              "setupAll")
    .addItem("🔄 2. Sync New Responses",              "syncResponses")
    .addSeparator()
    .addItem("📄 Generate Letter — Selected Row(s)",  "generateLetterForSelected")
    .addItem("🪪 Generate ID Card — Selected Row(s)", "generateCardForSelected")
    .addSeparator()
    .addItem("✅ Bulk Verify — VPF (Selected)",       "batchVerifyVPF_")   // [N1]
    .addItem("✅ Bulk Verify — VPM (Selected)",       "batchVerifyVPM_")   // [N1]
    .addSeparator()
    .addItem("⚠️ Request Missing Data — Selected",   "requestMissingDataForSelected")
    .addItem("🔔 Notify Officials of Pending Queue",  "notifyOfficials")
    .addItem("📩 Send Bi-Weekly Rosters to LC Pres",  "sendLCRosters")
    .addItem("📅 Send Portal Links to LC Presidents", "emailPortalLinks")
    .addSeparator()
    .addItem("💾 Manual Database Backup",             "createWeeklyBackup")
    .addItem("📊 Refresh Analytics Dashboard",        "refreshDashboard_")
    .addItem("📋 Application Completeness Scan",      "scanApplicationCompleteness_")  // [N2]
    .addItem("🔗 Convert Fee URLs to Hyperlinks",     "feeReceiptHyperlinks_")         // [N8]
    .addSeparator()
    .addItem("🔍 Retroactive CNIC Duplicate Check",   "retroactiveDuplicateCheck")     // [N3]
    .addItem("👥 Find Duplicate-Person Mem_IDs",      "findDuplicatePersonMemIDs_REPORT_ONLY") // [B12/N13]
    .addItem("🧹 Standardize Existing LC Names",      "fixLegacyInstituteNames")
    .addItem("🚀 Bulk Migrate Legacy Approvals",      "bulkMigrateOldMembers")
    .addItem("🛠️ Process Retry Queue",               "processRetryQueue_")
    .addItem("⏰ Check Membership Expiries",          "checkExpiryAlerts_")
    .addSeparator()
    .addItem("📖 Open Admin Guide",                   "showAdminGuide_")
    .addToUi();
}

function showAdminGuide_() {
  const html = `<!DOCTYPE html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body{font-family:'Montserrat',sans-serif;padding:15px;color:#1a3a5c;line-height:1.7;font-size:13px}
    h2{color:#27ae60;border-bottom:2px solid #eaeaea;padding-bottom:8px}
    b{color:#122840} code{background:#f0f4f8;padding:1px 5px;border-radius:3px;font-size:11px}
  </style></head><body>
  <h2>MSAP ERP Admin Guide v${CONFIG.VERSION}</h2>
  <p><b>1. Workflow Columns (24 cols):</b> A=Timestamp, B=Email, C=Personal Email, D=Full Name, E=Phone, F=Discipline, G=Class/Year, H=Grad Year, I=CNIC, J=Gender, K=Institute, L=VPF, M=VPM, N=President, O=Comments, P=Conflict of Interest, Q=Mem ID, R=Cert URL, S=LC Notified, T=Card URL, U=Fee Receipt, V=CNIC Photo, W=Dup Flag, X=Completeness%.</p>
  <p><b>2. COI Handling:</b> The system auto-normalises "Nope/Nil/Not yet/." etc to "No" on sync. Only genuine COI descriptions block approval. VPM must add a clearance note to col O and clear col P before Presidential approval.</p>
  <p><b>3. Bulk Verify:</b> Select rows in Workflow → Menu → Bulk Verify VPF or VPM. Confirms count before applying.</p>
  <p><b>4. Completeness Scan:</b> Adds column X (0–100%) score per application. Red &lt;60, Amber 60-79, Green ≥80.</p>
  <p><b>5. Portal Security:</b> Tokens now expire after ${CONFIG.PORTAL_TOKEN_VALIDITY_DAYS} days. Format: token:::timestamp in col H of LC Mapping. Re-run emailPortalLinks to refresh.</p>
  <p><b>6. Roster Batching:</b> sendLCRosters processes max ${CONFIG.ROSTER_BATCH_LIMIT} members per run. Re-run if needed.</p>
  <p><b>7. Retroactive CNIC Check:</b> Run once after migration to flag any pre-v6 duplicate CNICs that were missed.</p>
  <p><b>8. Constitution URL:</b> Update CONFIG.CONSTITUTION_URL and CONFIG.CONSTITUTION_YEAR every term.</p>
  </body></html>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setHeight(580).setWidth(480), `Admin Guide v${CONFIG.VERSION}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// §2a — setupAll
// ─────────────────────────────────────────────────────────────────────────────
function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. WORKFLOW TAB ──────────────────────────────────────────────────────
  let wfSh = ss.getSheetByName(CONFIG.SHEET_WORKFLOW) || ss.insertSheet(CONFIG.SHEET_WORKFLOW);
  if (wfSh.getLastRow() === 0) {
    const wfHeaders = [
      "Timestamp","Email","Personal_Email","Full_Name","Phone","Discipline",
      "Class_Year","Year_Grad","CNIC","Gender","Institute",
      "VPF_Status","VPM_Status","Pres_Status","Admin_Comments","Conflict_of_Interest",
      "Mem_ID","Cert_URL","LC_Notified","Card_URL",
      "Fee_Receipt_URL","CNIC_Photo_URL","Dup_CNIC_Flag","Completeness_%"  // [N2]
    ];
    wfSh.getRange(1, 1, 1, wfHeaders.length)
        .setValues([wfHeaders])
        .setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
    wfSh.setFrozenRows(1);

    const statusDV   = SpreadsheetApp.newDataValidation().requireValueInList(["Pending","Verified","Issue"], true).build();
    const approvalDV = SpreadsheetApp.newDataValidation().requireValueInList(["Pending","Approved","Rejected"], true).build();
    wfSh.getRange("L2:L10000").setDataValidation(statusDV);
    wfSh.getRange("M2:M10000").setDataValidation(statusDV);
    wfSh.getRange("N2:N10000").setDataValidation(approvalDV);

    const coiRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(P2<>"",P2<>"No",P2<>"None",P2<>"N/A")')
      .setBackground("#FFE8CC").setFontColor("#7A3E00")
      .setRanges([wfSh.getRange("P2:P10000")]).build();
      const dupRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("DUPLICATE")
      .setBackground("#FFCCCC").setFontColor("#8B0000").setBold(true)
      .setRanges([wfSh.getRange("W2:W10000")]).build();
    // [N2] Completeness heat-map
    const compRedRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(60).setBackground("#FFCCCC")
      .setRanges([wfSh.getRange("X2:X10000")]).build();
    const compAmberRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(60, 79).setBackground("#FFE8CC")
      .setRanges([wfSh.getRange("X2:X10000")]).build();
    const compGreenRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(80).setBackground("#CCFFCC")
      .setRanges([wfSh.getRange("X2:X10000")]).build();

    wfSh.setConditionalFormatRules([coiRule, dupRule, compRedRule, compAmberRule, compGreenRule]);
  }

  // ── 2. LC MAPPING TAB ───────────────────────────────────────────────────
  let mapSh = ss.getSheetByName(CONFIG.SHEET_MAPPING) || ss.insertSheet(CONFIG.SHEET_MAPPING);
  if (mapSh.getLastRow() === 0) {
    const mapHeaders = ["Institute","LC_Name","LC_Code","System_Counter","LC_President_Email","Legacy_Count","Aliases","Portal_Token"];
    mapSh.getRange(1, 1, 1, mapHeaders.length)
         .setValues([mapHeaders])
         .setBackground("#27ae60").setFontColor("#ffffff").setFontWeight("bold");

    const FULL_LC_NAMES = {
      'MSA-Pakistan AUMDC LC': 'Abu Umara Medical and Dental College lahore',
      'MSA-Pakistan ABMC LC':  'Abwa Medical College',
      'MSA-Pakistan AJKMC LC': 'AJK Medical College, Muzaffarabad',
      'MSA-Pakistan AIMC LC':  'Allama Iqbal Medical College, Lahore',
      'MSA-Pakistan ADMC LC':  'Ameer uddin Medical College',
      'MSA-Pakistan AIMCS LC': 'Amna Inayat Medical College, Sheikhupura',
      'MSA-Pakistan AFMDC LC': 'Aziz Fatima Medical and Dental College',
      'MSA-Pakistan ANMC LC':  'Azra Naheed Medical College Lahore',
      'MSA-Pakistan BKMC LC':  'Bacha Khan Medical College Mardan',
      'MSA-Pakistan BUHSC LC': 'Bahria University Health Sciences Campus',
      'MSA-Pakistan BAMDC LC': 'Bakhtawar Amin Medical and Dental College, Multan',
      'MSA-Pakistan BMC LC':   'Bannu Medical College, Bannu',
      'MSA-Pakistan BUMHS LC': 'Bolan University of Medical & Health Sciences, Quetta (BUMHS)',
      'MSA-Pakistan CKMC LC':  'CMH Kharian Medical College, Kharian',
      'MSA-Pakistan CHMC LC':  'Chandka Medical College, Larkana',
      'MSA-Pakistan CPMC LC':  'Central Park Medical College, Lahore',
      'MSA-Pakistan CMC LC':   'Continental Medical College',
      'MSA-Pakistan CIMS LC':  'CMH Institute of Medical Sciences, Bahawalpur',
      'MSA-Pakistan DGKMC LC': 'Dera Ghazi Khan Medical College',
      'MSA-Pakistan DIMC LC':  'Dow International Medical College, Karachi',
      'MSA-Pakistan DMC LC':   'Dow Medical College, Karachi',
      'MSA-Pakistan FMC LC':  'Federal Medical College, Islamabad',
      'MSA-Pakistan FMU LC':   'Faisalabad Medical University, Faisalabad',
      'MSA-Pakistan FDC LC':   'Faryal Dental College, Lahore',
      'MSA-Pakistan FUMC LC':  'Foundation University Medical College, Rawalpindi',
      'MSA-Pakistan GIMS LC':  'Gambat Institute of Medical Science',
      'MSA-Pakistan GKMC LC':  'Gajju Khan Medical College, Swabi',
      'MSA-Pakistan HCMD LC':  'Hamdard College of Medicine & Dentistry, Karachi',
      'MSA-Pakistan IMC LC':   'Independent Medical College',
      'MSA-Pakistan IMCH LC':  'Indus Medical College, Tando Muhammad Khan',
      'MSA-Pakistan IMDC LC':  'Islamabad Medical & Dental College',
      'MSA-Pakistan IIDC LC':  'Islamic International Dental College, Islamabad',
      'MSA-Pakistan JSMU LC':  'Jinnah Sindh Medical University',
      'MSA-Pakistan KIMS LC':  'Karachi Institute of Medical Sciences (KIMS)',
      'MSA-Pakistan KMDC LC':  'Karachi Medical & Dental College, Karachi',
      'MSA-Pakistan KEMU LC':  'King Edward Medical University',
      'MSA-Pakistan KGMC LC':  'Khyber Girls Medical College Peshawar',
      'MSA-Pakistan LUMHS LC': 'Liaquat University of Medical And Health Science',
      'MSA-Pakistan LMDC LC':  'Lahore Medical and Dental College',
      'MSA-Pakistan LMCL LC':  'Loralai Medical College Loralai',
      'MSA-Pakistan MIMDC LC': 'M. Islam Medical College, Gujranwala',
      'MSA-Pakistan MMC LC':   'Mekran Medical College, Turbat',
      'MSA-Pakistan MIMC LC':  'Mohi-ud-Din Islamic Medical College, Mirpur',
      'MSA-Pakistan MBBSMC LC':'Mohtarma Benazir Bhutto Medical College, Mirpur (MBBSMC)',
      'MSA-Pakistan MMDC LC':  'Multan Medical and Dental College',
      'MSA-Pakistan NMU LC':   'Nishtar Medical University, Multan',
      'MSA-Pakistan PUMHS LC': 'Peoples University of Medical & Health Sciences for Women',
      'MSA-Pakistan PMCR LC':  'Poonch Medical College Rawalakot',
      'MSA-Pakistan QIMS LC':  'Quetta Institute of Medical Sciences, Quetta',
      'MSA-Pakistan RMDC LC':  'Rahbar Medical And Dental College, Lahore',
      'MSA-Pakistan RMU LC':   'Rawalpindi Medical University',
      'MSA-Pakistan RIHS LC':  'Rawal Institute of Health Sciences',
      'MSA-Pakistan RLMC LC':  'Rashid Latif Medical College',
      'MSA-Pakistan SMCN LC':  'Sahara Medical College Narowal',
      'MSA-Pakistan SDMC LC':  'Saidu Medical College Swat',
      'MSA-Pakistan SGMC LC':  'Sargodha Medical College, Sargodha',
      'MSA-Pakistan SMDC LC':  'Shalamar Medical and Dental College',
      'MSA-Pakistan SZMC LC':  'Sheikh Zayed Medical College',
      'MSA-Pakistan SCM LC':   'Shifa College of Medicine, Islamabad',
      'MSA-Pakistan SMC LC':   'Sialkot Medical College, Sialkot',
      'MSA-Pakistan UMDCF LC': 'University Medical and Dental College, Faisalabad',
      'MSA-Pakistan WMC LC':   'Wah Medical College, Wah Cantt',
      'MSA-Pakistan ZMC LC':   'Ziauddin Medical College, Karachi'
    };

    const LC_EMAILS = {
      'MSA-Pakistan AUMDC LC': 'aumdc.msap@gmail.com',
      'MSA-Pakistan ABMC LC':  'abmc.msap@gmail.com',
      'MSA-Pakistan AJKMC LC': 'ajkmc.msap@gmail.com',
      'MSA-Pakistan AIMC LC':  'aimc.msap@gmail.com',
      'MSA-Pakistan ADMC LC':  'admc.msap@gmail.com',
      'MSA-Pakistan AIMCS LC': 'aimcs.msap@gmail.com',
      'MSA-Pakistan AFMDC LC': 'afmdc.msap@gmail.com',
      'MSA-Pakistan ANMC LC':  'anmc.msap@gmail.com',
      'MSA-Pakistan BKMC LC':  'bkmc.msap@gmail.com',
      'MSA-Pakistan BUHSC LC': 'buhsc.msap@gmail.com',
      'MSA-Pakistan BAMDC LC': 'bamdc.msap@gmail.com',
      'MSA-Pakistan BMC LC':   'bmc.msap@gmail.com',
      'MSA-Pakistan BUMHS LC': 'bumhs.msap123@gmail.com',
      'MSA-Pakistan CKMC LC':  'ckmc.msap123@gmail.com',
      'MSA-Pakistan CHMC LC':  'chmc.msap@gmail.com',
      'MSA-Pakistan CPMC LC':  'cpmc.msap@gmail.com',
      'MSA-Pakistan CMC LC':   'cmc.msap@gmail.com',
      'MSA-Pakistan CIMS LC':  'cims.msap@gmail.com',
      'MSA-Pakistan DGKMC LC': 'msa.dgkmclc@gmail.com',
      'MSA-Pakistan DIMC LC':  'dimc.msap@gmail.com',
      'MSA-Pakistan DMC LC':   'dmc.msap@gmail.com',
      'MSA-Pakistan FMC LC':  'fmcmsap@gmail.com',
      'MSA-Pakistan FMU LC':   'fmu.msap@gmail.com',
      'MSA-Pakistan FDC LC':   'fdc.msap@gmail.com',
      'MSA-Pakistan FUMC LC':  'fumc.msap@gmail.com',
      'MSA-Pakistan GIMS LC':  'gims.msap@gmail.com',
      'MSA-Pakistan GKMC LC':  'gkmc.msap@gmail.com',
      'MSA-Pakistan HCMD LC':  'hcmd.msap@gmail.com',
      'MSA-Pakistan IMC LC':   'imc.msap1@gmail.com',
      'MSA-Pakistan IMCH LC':  'imch.msap@gmail.com',
      'MSA-Pakistan IMDC LC':  'imdclc.msap@gmail.com',
      'MSA-Pakistan IIDC LC':  'iidc.msap@gmail.com',
      'MSA-Pakistan JSMU LC':  'jsmu.msap@gmail.com',
      'MSA-Pakistan KIMS LC':  'kims.msap@gmail.com',
      'MSA-Pakistan KMDC LC':  'kmdc.msap@gmail.com',
      'MSA-Pakistan KEMU LC':  'kemu.msap@gmail.com',
      'MSA-Pakistan KGMC LC':  'kgmc.msap@gmail.com',
      'MSA-Pakistan LUMHS LC': 'lumhs.msap@gmail.com',
      'MSA-Pakistan LMDC LC':  'lmdc.msap@gmail.com',
      'MSA-Pakistan LMCL LC':  'lmc.msap@gmail.com',
      'MSA-Pakistan MIMDC LC': 'mimdc.msap@gmail.com',
      'MSA-Pakistan MMC LC':   'mmclc.msap@gmail.com',
      'MSA-Pakistan MIMC LC':  'mimc.msap@gmail.com',
      'MSA-Pakistan MBBSMC LC':'mbbsmc.msap@gmail.com',
      'MSA-Pakistan MMDC LC':  'mmdc.msap@gmail.com',
      'MSA-Pakistan NMU LC':   'nmu.msap@gmail.com',
      'MSA-Pakistan PUMHS LC': 'pumhs.msap@gmail.com',
      'MSA-Pakistan PMCR LC':  'pmcr.msap@gmail.com',
      'MSA-Pakistan QIMS LC':  'qimsmsap@gmail.com',
      'MSA-Pakistan RMDC LC':  'rmdc.msap@gmail.com',
      'MSA-Pakistan RMU LC':   'rmu.msap@gmail.com',
      'MSA-Pakistan RIHS LC':  'rihs.msap@gmail.com',
      'MSA-Pakistan RLMC LC':  'rlmc.msap@gmail.com',
      'MSA-Pakistan SMCN LC':  'smcn.msap@gmail.com',
      'MSA-Pakistan SDMC LC':  'sdmc.msap@gmail.com',
      'MSA-Pakistan SGMC LC':  'sgmc.msap@gmail.com',
      'MSA-Pakistan SMDC LC':  'smdc.msap@gmail.com',
      'MSA-Pakistan SZMC LC':  'szmc.msap@gmail.com',
      'MSA-Pakistan SCM LC':   'scm.msap@gmail.com',
      'MSA-Pakistan SMC LC':   'smc.msap@gmail.com',
      'MSA-Pakistan UMDCF LC': 'umdc.msap@gmail.com',
      'MSA-Pakistan WMC LC':   'wmc.msap@gmail.com',
      'MSA-Pakistan ZMC LC':   'zmc.msap@gmail.com'
    };

    const LC_CODES = {
      'MSA-Pakistan ABMC LC':  'A1',
      'MSA-Pakistan AFMDC LC': 'A2',
      'MSA-Pakistan AJKMC LC': 'A3',
      'MSA-Pakistan ADMC LC':  'A4',
      'MSA-Pakistan ANMC LC':  'A5',
      'MSA-Pakistan AUMDC LC': 'A6',
      'MSA-Pakistan AIMC LC':  'A7',
      'MSA-Pakistan AIMCS LC': 'A9',
      'MSA-Pakistan BUHSC LC': 'B1',
      'MSA-Pakistan BKMC LC':  'B2',
      'MSA-Pakistan BMC LC':   'B3',
      'MSA-Pakistan BUMHS LC': 'B4',
      'MSA-Pakistan BAMDC LC': 'B5',
      'MSA-Pakistan CMC LC':   'C1',
      'MSA-Pakistan CKMC LC':  'C2',
      'MSA-Pakistan CHMC LC':  'C3',
      'MSA-Pakistan CPMC LC':  'C4',
      'MSA-Pakistan CIMS LC':  'C5',
      'MSA-Pakistan DGKMC LC': 'D1',
      'MSA-Pakistan DIMC LC':  'D2',
      'MSA-Pakistan DMC LC':   'D3',
      'MSA-Pakistan FMU LC':   'F1',
      'MSA-Pakistan FMC LC':  'F2',
      'MSA-Pakistan FUMC LC':  'F3',
      'MSA-Pakistan FDC LC':   'F4',
      'MSA-Pakistan GIMS LC':  'G1',
      'MSA-Pakistan GKMC LC':  'G2',
      'MSA-Pakistan HCMD LC':  'H1',
      'MSA-Pakistan IMDC LC':  'I1',
      'MSA-Pakistan IIDC LC':  'I2',
      'MSA-Pakistan IMC LC':   'I3',
      'MSA-Pakistan IMCH LC':  'I4',
      'MSA-Pakistan JSMU LC':  'J2',
      'MSA-Pakistan KEMU LC':  'K1',
      'MSA-Pakistan KIMS LC':  'K2',
      'MSA-Pakistan KMDC LC':  'K3',
      'MSA-Pakistan KGMC LC':  'K4',
      'MSA-Pakistan LUMHS LC': 'L1',
      'MSA-Pakistan LMCL LC':  'L2',
      'MSA-Pakistan LMDC LC':  'L3',
      'MSA-Pakistan MMDC LC':  'M1',
      'MSA-Pakistan MMC LC':   'M2',
      'MSA-Pakistan MBBSMC LC':'M3',
      'MSA-Pakistan MIMC LC':  'M4',
      'MSA-Pakistan MIMDC LC': 'M5',
      'MSA-Pakistan NMU LC':   'N1',
      'MSA-Pakistan PMCR LC':  'P1',
      'MSA-Pakistan PUMHS LC': 'P2',
      'MSA-Pakistan QIMS LC':  'Q1',
      'MSA-Pakistan RLMC LC':  'R1',
      'MSA-Pakistan RMU LC':   'R2',
      'MSA-Pakistan RIHS LC':  'R3',
      'MSA-Pakistan RMDC LC':  'R6',
      'MSA-Pakistan SZMC LC':  'S1',
      'MSA-Pakistan SMDC LC':  'S2',
      'MSA-Pakistan SMC LC':   'S3',
      'MSA-Pakistan SCM LC':   'S4',
      'MSA-Pakistan SMCN LC':  'S6',
      'MSA-Pakistan SDMC LC':  'S7',
      'MSA-Pakistan SGMC LC':  'S8',
      'MSA-Pakistan UMDCF LC': 'U1',
      'MSA-Pakistan WMC LC':   'W1',
      'MSA-Pakistan ZMC LC':   'Z1'
    };

    // [B7] Expanded alias list — covers all 63 LCs.
    // Previously 34 LCs had no aliases; all now covered.
    const LC_ALIASES = {
      // ── Existing (cleaned) ─────────────────────────────────────────────────
      'MSA-Pakistan SZMC LC':  'szmc,szmc ryk,ryk,sheikh zayed,sheikh zayd,sheikh zaid,rahimyar,rahimyar khan,rahim yar khan,rahim yar,rahimyarkhan,sheikh zyed,sheikh zyed medical college raheem yar khan',
      'MSA-Pakistan PMCR LC':  'pmcr,poonch,rawalakot,rawalkot,rawlakot,pmc rawalakot,pmc rawalkot,poonch medical',
      'MSA-Pakistan AJKMC LC': 'ajkmc,ajk medical,azad jammu kashmir medical,muzaffarabad,muzafarabad,azad jammu and kashmir medical',
      'MSA-Pakistan BUHSC LC': 'buhsc,bahria karachi,bahria university health,bahria university medical,buhs,bahria university of health sciences karachi,bahria university of helath and sciences,behria medical,bahria university and health sciences karachi',
      'MSA-Pakistan AIMC LC':  'aimc,allama iqbal,allama iqbal medical,allama iqbal medical college lahore',
      'MSA-Pakistan AFMDC LC': 'afmdc,aziz fatima,aziz fatima faisalabad',
      'MSA-Pakistan RLMC LC':  'rlmc,rashid latif,rashid latid,rashid latif medical',
      'MSA-Pakistan RMU LC':   'rmu,rawalpindi medical university,rawalpindi medical',
      'MSA-Pakistan RIHS LC':  'rihs,rawal institute,rawal institute of health',
      'MSA-Pakistan DMC LC':   'dmc,dow medical,dow medical college',
      'MSA-Pakistan DIMC LC':  'dimc,dow international,dow international medical',
      'MSA-Pakistan JSMU LC':  'jsmu,jinnah sindh,jinnah sindh medical',
      'MSA-Pakistan KEMU LC':  'kemu,king edward,king edward medical',
      'MSA-Pakistan SMC LC':   'smc,sialkot medical,sialkot medical college,islam medical college sialkot',
      'MSA-Pakistan SGMC LC':  'sgmc,sargodha medical,sargodha medical college',
      'MSA-Pakistan FMU LC':   'fmu,faisalabad medical,faisalabad medical university,faisalabad medical university faisalabad',
      'MSA-Pakistan NMU LC':   'nmu,nishtar,nishtar medical,nishtar medical university',
      'MSA-Pakistan IMDC LC':  'imdc,islamabad medical,islamabad medical dental',
      'MSA-Pakistan SCM LC':   'scm,shifa college,shifa college of medicine',
      'MSA-Pakistan FUMC LC':  'fumc,foundation university,foundation university medical',
      'MSA-Pakistan LMDC LC':  'lmdc,lahore medical,lahore medical dental',
      'MSA-Pakistan KMDC LC':  'kmdc,karachi medical dental,karachi medical',
      'MSA-Pakistan ZMC LC':   'zmc,ziauddin,ziauddin medical',
      'MSA-Pakistan KIMS LC':  'kims,karachi institute of medical,karachi institute',
      'MSA-Pakistan BUMHS LC': 'bumhs,bolan university,bolan medical,bums quetta,bolan university of medical,bumhs quetta',
      'MSA-Pakistan MMDC LC':  'mmdc,multan medical,multan medical dental',
      'MSA-Pakistan MBBSMC LC':'mbbsmc,mohtarma benazir,benazir bhutto medical mirpur',
      'MSA-Pakistan MIMC LC':  'mimc,mohi ud din,mohiuddin islamic medical,mohi-ud-din islamic medical,mohiudn islamic medical',
      'MSA-Pakistan ADMC LC':  'admc,ameer uddin,ameeruddin medical',
      // ── [B7] NEW ADDITIONS ─────────────────────────────────────────────────
      'MSA-Pakistan FMC LC':  'fmdc,federal medical college,szabmu,fmdc islamabad,federal medical college islamabad,federal medical college fmdc,federal medical and dental college,federal medical and dental college islamabad,federal medical dental,federal medical islamabad,shaheed zulfiqar ali bhutto medical,szabmu islamabad,fedral medical college',
      'MSA-Pakistan HCMD LC':  'hcmd,hamdard college of medicine and dentistry,hamdard college medicine,hamdard university karachi,hamdard medical,hamdard medical and dental,hamdard madinatul hikmah,hamdard university madinatul hikmah,hamdard college of medicine and dentistry karachi',
      'MSA-Pakistan MMC LC':   'mmc,mekran medical,makran medical,makran medical college,mmc turbat,makran medical college turbat',
      'MSA-Pakistan CPMC LC':  'cpmc,central park medical,central park lahore,central park medical college lahore',
      'MSA-Pakistan BAMDC LC': 'bamdc,bakhtawar amin,bakhtawar amin medical,bakhtawar amin multan',
      'MSA-Pakistan BMC LC':   'bmc,bannu medical,bannu medical college',
      'MSA-Pakistan CKMC LC':  'ckmc,cmh kharian,cmh kharian medical,cmh kharian medical college',
      'MSA-Pakistan CHMC LC':  'chmc,chandka medical,chandka medical college,chandka larkana',
      'MSA-Pakistan CIMS LC':  'cims,cmh institute bahawalpur,cmh institute of medical sciences,cmh institute bahawalpur,cims bahawalpur,cmh institute medical sciences bahawalpur',
      'MSA-Pakistan DGKMC LC': 'dgkmc,dera ghazi khan,dgk medical,dera ghazi khan medical college',
      'MSA-Pakistan FDC LC':   'fdc,faryal dental,faryal dental college,faryal dental lahore',
      'MSA-Pakistan GKMC LC':  'gkmc,gajju khan,gajju khan medical,gajju khan swabi,kabir medical college peshawar',
      'MSA-Pakistan GIMS LC':  'gims,gambat institute,gambat medical,gambat institute of medical',
      'MSA-Pakistan IMC LC':   'imc,independent medical,independent medical college',
      'MSA-Pakistan IMCH LC':  'imch,indus medical,indus medical college,indus medical tando',
      'MSA-Pakistan IIDC LC':  'iidc,islamic international dental,islamic international dental college,islamic international riu,iidc islamabad,international university kyrgyzstan',
      'MSA-Pakistan KGMC LC':  'kgmc,khyber girls,khyber girls medical,khyber girls medical college peshawar',
      'MSA-Pakistan LUMHS LC': 'lumhs,liaquat university,liaquat university medical,lumhs hyderabad,liaquat national hospital,liaquat national hospital and medical college',
      'MSA-Pakistan LMCL LC':  'lmcl,loralai medical,loralai medical college',
      'MSA-Pakistan MIMDC LC': 'mimdc,m islam medical,m islam medical college,m. islam medical,mimdc gujranwala',
      'MSA-Pakistan PUMHS LC': 'pumhs,peoples university,peoples university medical,pumhs women',
      'MSA-Pakistan QIMS LC':  'qims,quetta institute,quetta institute of medical sciences,quetta institute of medical sciences quetta',
      'MSA-Pakistan RMDC LC':  'rmdc,rahbar medical,rahbar medical dental,rahbar lahore',
      'MSA-Pakistan SMCN LC':  'smcn,sahara medical,sahara medical college,sahara narowal',
      'MSA-Pakistan SDMC LC':  'sdmc,saidu medical,saidu medical college,saidu swat',
      'MSA-Pakistan SMDC LC':  'smdc,shalamar medical,shalamar medical and dental,shalamar medical college,shalamar medical college university of health sciences',
      'MSA-Pakistan UMDCF LC': 'umdcf,university medical dental,university medical and dental college,umdcf faisalabad,umdc faisalabad,university medical and dental college faisalabad,university college of medicine dentistry lahore',
      'MSA-Pakistan WMC LC':   'wmc,wah medical,wah medical college,wah cantt medical',
      'MSA-Pakistan AUMDC LC': 'aumdc,abu umara medical,abu umara dental,abu umara lahore'
    };

    const lcData = [];
    for (const [key, name] of Object.entries(FULL_LC_NAMES)) {
      lcData.push([
        name,
        key,
        LC_CODES[key] || "UNK",
        0,
        LC_EMAILS[key] || "",
        0,
        LC_ALIASES[key] || "",
        ""
      ]);
    }
    lcData.sort((a, b) => a[0].localeCompare(b[0]));
    mapSh.getRange(2, 1, lcData.length, MAP_TOTAL_COLS).setValues(lcData);
  }

  // ── 3. SYSTEM TABS ───────────────────────────────────────────────────────
  [CONFIG.SHEET_AUDIT, CONFIG.SHEET_RETRY, CONFIG.SHEET_DASHBOARD].forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });

  // ── 4. TRIGGERS ──────────────────────────────────────────────────────────
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!existing.includes('onWorkflowEdit')) {
    ScriptApp.newTrigger('onWorkflowEdit').forSpreadsheet(ss).onEdit().create();
  }
  if (!existing.includes('runWeeklyTasks_')) {
    ScriptApp.newTrigger('runWeeklyTasks_')
      .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  }
  if (!existing.includes('createWeeklyBackup')) {
    ScriptApp.newTrigger('createWeeklyBackup')
      .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(0).create();
  }

  SpreadsheetApp.getUi().alert(`✅ MSAP ERP v${CONFIG.VERSION} initialized successfully.`);
  logAudit_("SYSTEM_SETUP", `v${CONFIG.VERSION} initial setup complete.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — AUTOMATED BACKUPS & RESILIENCE
// ─────────────────────────────────────────────────────────────────────────────
function createWeeklyBackup() {
  if (!CONFIG.BACKUP_FOLDER_ID || CONFIG.BACKUP_FOLDER_ID.includes("YOUR_")) return;
  try {
    const ss     = SpreadsheetApp.getActiveSpreadsheet();
    const folder = DriveApp.getFolderById(CONFIG.BACKUP_FOLDER_ID.trim());
    const stamp  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
    DriveApp.getFileById(ss.getId()).makeCopy(`MSAP_ERP_Backup_${stamp}`, folder);
    logAudit_("DATABASE_BACKUP", `Success: ${stamp}`);
  } catch(e) {
    logAudit_("BACKUP_ERROR", e.message);
  }
}

function queueRetry_(row, type, payload) {
  const sh = getSheetSafe_(CONFIG.SHEET_RETRY);
  if (!sh) return;
  sh.appendRow([new Date(), type, row, JSON.stringify(payload), 0]);
  logAudit_("RETRY_QUEUED", `Row ${row} → retry queue (${type}).`);
}

function processRetryQueue_() {
  const sh = getSheetSafe_(CONFIG.SHEET_RETRY);
  if (!sh || sh.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("Retry queue is empty.");
    return;
  }
  const data = sh.getDataRange().getValues();
  const toDelete = [];

  for (let i = 1; i < data.length; i++) {
    const [, type, rowIdx, jsonPayload, retryCount] = data[i];
    if (retryCount >= 3) {
      logAudit_("RETRY_ABANDONED", `Row ${rowIdx} failed 3× — human review needed.`);
      toDelete.push(i + 1);
      continue;
    }
    const p = JSON.parse(jsonPayload);
    const wfSheet = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
    let ok = false;

    if (type === "PDF_GENERATION") {
      // [L7] Uses p.memId from payload — does NOT regenerate ID
      const url = generatePDFCore_(p.name, p.cnic, p.institute, p.memId, p.timestampDate, CONFIG.CERT_TEMPLATE_ID, "Letter");
      if (url) {
        wfSheet.getRange(rowIdx, WF_COL.CERT_URL + 1).setValue(url);
        ok = sendApprovalEmail_(p.name, p.email, url, p.memId, p.lcName, p.classLvl, p.timestampDate);
        if (p.phone) {
          const waOk = sendWhatsAppMessage_(p.phone, p.name, p.memId, url);
          if (!waOk) sendSMSFallback_(p.phone, p.name, p.memId, url);
        }
      }
    } else if (type === "APPROVAL_EMAIL") {
      ok = sendApprovalEmail_(p.name, p.email, p.certUrl, p.memId, p.lcName, p.classLvl, p.timestampDate);
    }

    if (ok) toDelete.push(i + 1);
    else sh.getRange(i + 1, 5).setValue(Number(retryCount) + 1);
  }

  toDelete.reverse().forEach(r => sh.deleteRow(r));
  SpreadsheetApp.getUi().alert(`✅ Processed ${data.length - 1} retry entries. Cleared: ${toDelete.length}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — DATA INTAKE & SMART FUZZY SYNC
// ─────────────────────────────────────────────────────────────────────────────
function syncResponses(showUi = true) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const src = getSheetSafe_(CONFIG.SHEET_SOURCE, ss);
  const wf  = getSheetSafe_(CONFIG.SHEET_WORKFLOW, ss);
  const map = getSheetSafe_(CONFIG.SHEET_MAPPING, ss);
  if (!src || !wf || !map) return;

  const srcData = src.getDataRange().getValues();
  const wfData  = wf.getDataRange().getValues();
  const mapData = map.getDataRange().getValues();

  const existingKeys = new Set(
    wfData.map(r => `${r[WF_COL.TIMESTAMP]}_${r[WF_COL.EMAIL].toString().trim().toLowerCase()}`)
  );

  const existingCNICs = new Map();
  for (let i = 1; i < wfData.length; i++) {
    const c = cleanCNIC_(wfData[i][WF_COL.CNIC]);
    if (c && !existingCNICs.has(c)) existingCNICs.set(c, i + 1);
  }

  let added = 0, skipped = 0;
  const buffer = [];

  for (let i = 1; i < srcData.length; i++) {
    const ts   = srcData[i][0] ? srcData[i][0].toString() : "";
    const mail = srcData[i][1] ? srcData[i][1].toString().trim().toLowerCase() : "";

    // [B8] Log skipped rows instead of silently dropping
    if (!ts || !mail) {
      skipped++;
      logAudit_("SYNC_SKIP", `Source row ${i + 1} skipped — missing timestamp or email.`);
      continue;
    }
    if (existingKeys.has(`${ts}_${mail}`)) continue;

    const personalEmail = srcData[i][3]  ? srcData[i][3].toString().trim()  : "";
    const phone         = srcData[i][4]  ? srcData[i][4].toString().trim()  : "";

    // --- UPDATED COLUMN INDICES BELOW ---
    const cnic          = srcData[i][8]  ? srcData[i][8].toString().trim()  : "";
    const gender        = srcData[i][9]  ? srcData[i][9].toString().trim()  : "";
    const disc          = srcData[i][14] ? srcData[i][14].toString().trim() : "";
    const classYear     = srcData[i][15] ? srcData[i][15].toString().trim() : "";
    const gradRaw       = srcData[i][23];
    const rawInst       = srcData[i][16] ? srcData[i][16].toString().trim() : "";
    const feeUrl        = srcData[i][19] ? srcData[i][19].toString().trim() : "";
    const cnicPhotoUrl  = srcData[i][24] ? srcData[i][24].toString().trim() : "";
    const coiRaw        = srcData[i][25] ? srcData[i][25].toString().trim() : "";
    // ------------------------------------

    // [B5] Store Year_Grad as 4-digit year only, not full datetime
    let gradYear = "";
    if (gradRaw) {
      if (gradRaw instanceof Date) {
        gradYear = gradRaw.getFullYear().toString();
      } else {
        const parsed = parseInt(gradRaw.toString().trim().substring(0, 4), 10);
        gradYear = isNaN(parsed) ? "" : parsed.toString();
      }
    }

    // [B3] Normalise COI on import
    const coi    = normalizeCOI_(coiRaw);

    const officialInst = standardizeInstitute_(rawInst, mapData);

    const cleanC = cleanCNIC_(cnic);
    let dupFlag = "";
    if (cleanC && existingCNICs.has(cleanC)) {
      dupFlag = "DUPLICATE";
      logAudit_("DUPLICATE_CNIC", `CNIC ${cleanC} already exists (row ${existingCNICs.get(cleanC)}). New entry: ${mail}`);
    } else if (cleanC) {
      existingCNICs.set(cleanC, wfData.length + buffer.length + 1);
    }

    // Completeness score on import [N2]
    const tempRow = [
      ts, mail, personalEmail, srcData[i][2] || "", phone,
      disc, classYear, gradYear, cnic, gender, officialInst,
      "Pending", "Pending", "Pending", "", coi,
      "", "", "No", "", feeUrl, cnicPhotoUrl, dupFlag, ""
    ];
    const completeness = computeCompleteness_(tempRow);
    tempRow[WF_COL.COMPLETENESS] = completeness;

    buffer.push(tempRow);
    added++;
  }

  if (buffer.length > 0) {
    wf.getRange(wf.getLastRow() + 1, 1, buffer.length, WF_TOTAL_COLS).setValues(buffer);
    const dupCount = buffer.filter(r => r[WF_COL.DUP_FLAG] === "DUPLICATE").length;
    logAudit_("DATA_SYNC", `Imported ${added} new entries. Duplicates flagged: ${dupCount}. Skipped: ${skipped}.`);
  }

  const result = {
    added,
    duplicates: buffer.filter(r => r[WF_COL.DUP_FLAG] === "DUPLICATE").length,
    skipped
  };

  if (showUi) {
    SpreadsheetApp.getUi().alert(
      `✅ Sync complete.\nNew entries: ${result.added}\nDuplicate CNICs flagged: ${result.duplicates}\nRows skipped (logged): ${result.skipped}`
    );
  }
  return result;
}

/** [B7][L1] Fuzzy matcher — exact, containment, then aliases with 4-char min guard */
function standardizeInstitute_(input, mapData) {
  if (!input) return "Unknown Institute";
  const cleanInput = input.toLowerCase().replace(/[^\w\s]/g, "").trim();

  for (let j = 1; j < mapData.length; j++) {
    const official      = mapData[j][MAP_COL.INSTITUTE].toString();
    const officialClean = official.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const aliases       = mapData[j][MAP_COL.ALIASES] ? mapData[j][MAP_COL.ALIASES].toString().toLowerCase() : "";

    if (cleanInput === officialClean ||
        (cleanInput.length > 5 && officialClean.includes(cleanInput)) ||
        (officialClean.length > 5 && cleanInput.includes(officialClean))) {
      return official;
    }
    if (aliases) {
      const aliasArr = aliases.split(",").map(a => a.trim()).filter(a => a.length >= 4); // [L1] min 4 chars
      if (aliasArr.some(a => cleanInput === a ||
                             (cleanInput.length > 4 && cleanInput.includes(a)) ||
                             (a.length > 6 && a.includes(cleanInput)))) {
        return official;
      }
    }
  }
  return input.trim();
}

function fixLegacyInstituteNames() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const wf  = getSheetSafe_(CONFIG.SHEET_WORKFLOW, ss);
  const map = getSheetSafe_(CONFIG.SHEET_MAPPING, ss);
  if (!wf || !map) return;

  const wfData  = wf.getDataRange().getValues();
  const mapData = map.getDataRange().getValues();
  let fixed = 0;

  for (let i = 1; i < wfData.length; i++) {
    const raw  = wfData[i][WF_COL.INSTITUTE].toString();
    const best = standardizeInstitute_(raw, mapData);
    if (best !== raw) {
      wf.getRange(i + 1, WF_COL.INSTITUTE + 1).setValue(best);
      fixed++;
    }
  }
  SpreadsheetApp.getUi().alert(`✅ Sanitization complete. Fixed ${fixed} institute names.`);
  logAudit_("CLEANUP", `Fuzzy-fixed ${fixed} institute names.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 — CORE LOGIC & PRESIDENTIAL OVERRIDE
// ─────────────────────────────────────────────────────────────────────────────
function onWorkflowEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_WORKFLOW) return;

  const row   = e.range.getRow();
  const col   = e.range.getColumn();
  const value = e.value;
  if (row < 2) return;

  // [B14] diagnoseTriggers() confirmed exactly ONE onWorkflowEdit trigger is
  // installed — so repeated processing of a single user action is NOT a
  // duplicate-trigger problem. It matches a long-documented Google Sheets
  // behavior instead: selecting a value from a data-validation dropdown
  // (Pres_Status/VPF_Status/VPM_Status all use one — see setupAll()) can
  // fire onEdit TWICE for one selection. Symptom: the Emergency Override
  // dialog appearing twice with identical text, and one Mem_ID silently
  // burned each time (the second firing's ID gets discarded by the
  // reservation guard in reserveMembershipIdForRow_, so no duplicate is
  // ever WRITTEN — but the dialog still pops twice and a number is wasted).
  // FIX: debounce on the exact edit fingerprint (row+col+value). A genuine
  // second edit to the same cell is unaffected once the short window passes;
  // only a near-simultaneous repeat of the identical edit is skipped, before
  // any downstream logic (COI check, override dialog, ID issuance, emails)
  // runs at all. Uses CacheService only — no spreadsheet data is touched.
  const dedupeCache = CacheService.getScriptCache();
  const editFingerprint = `edit_${row}_${col}_${value}`;
  if (dedupeCache.get(editFingerprint)) {
    logAudit_("DUPLICATE_EDIT_EVENT_SKIPPED",
      `Row ${row}, col ${col}, value "${value}" — repeat onEdit fire within debounce window, ignored.`);
    return;
  }
  dedupeCache.put(editFingerprint, "1", 4); // 4-second window

  // ── Presidential approval ─────────────────────────────────────────────────
  if (col === WF_COL.PRES_STATUS + 1 && value === "Approved") {

    // [B3] Use normalised COI for block check
    const coiRaw = sheet.getRange(row, WF_COL.COI + 1).getValue().toString().trim();
    const coi    = normalizeCOI_(coiRaw);
    if (coi && coi !== "No" && coi !== "") {
      sheet.getRange(row, WF_COL.PRES_STATUS + 1).setValue("Pending");
      SpreadsheetApp.getUi().alert(
        "⛔ Approval Blocked — Conflict of Interest\n\n" +
        `Declared COI in column P:\n"${coi}"\n\n` +
        "VPM must review, add a clearance note to Admin_Comments (col O), and remove the COI entry before Presidential approval."
      );
      return;
    }

    const vpf = sheet.getRange(row, WF_COL.VPF_STATUS + 1).getValue();
    const vpm = sheet.getRange(row, WF_COL.VPM_STATUS + 1).getValue();

    if (vpf !== "Verified" || vpm !== "Verified") {
      const ui  = SpreadsheetApp.getUi();
      const ans = ui.alert(
        "⚠️ Emergency Override",
        "VPF or VPM has NOT verified this entry. Continue with Presidential Override?",
        ui.ButtonSet.YES_NO
      );
      if (ans === ui.Button.YES) {
        if (vpf !== "Verified") sheet.getRange(row, WF_COL.VPF_STATUS + 1).setValue("Verified");
        if (vpm !== "Verified") sheet.getRange(row, WF_COL.VPM_STATUS + 1).setValue("Verified");
        logAudit_("EMERGENCY_OVERRIDE", `President force-approved row ${row}.`);
        processApproval_(sheet, row);
      } else {
        sheet.getRange(row, WF_COL.PRES_STATUS + 1).setValue("Pending");
      }
      return;
    }
    processApproval_(sheet, row);
  }

  // ── Rejection ─────────────────────────────────────────────────────────────
  if (col === WF_COL.PRES_STATUS + 1 && value === "Rejected") {
    const name    = sheet.getRange(row, WF_COL.FULL_NAME + 1).getValue();
    const email   = sheet.getRange(row, WF_COL.EMAIL + 1).getValue();
    const pEmail  = sheet.getRange(row, WF_COL.PERSONAL_EMAIL + 1).getValue();
    const comments= sheet.getRange(row, WF_COL.ADMIN_COMMENTS + 1).getValue();
    const target  = (pEmail && isValidEmail_(pEmail)) ? pEmail : email;
    sendRejectionEmail_(name, target, comments);
    logAudit_("REJECTION", `Application rejected for row ${row}: ${name}.`);
  }

  // ── Issue flagged → require comments before allowing [L3] ─────────────────
  if ((col === WF_COL.VPF_STATUS + 1 || col === WF_COL.VPM_STATUS + 1) && value === "Issue") {
    const comments = sheet.getRange(row, WF_COL.ADMIN_COMMENTS + 1).getValue().toString().trim();
    if (!comments) {
      sheet.getRange(row, col).setValue("Pending"); // [L3] revert
      SpreadsheetApp.getUi().alert(
        "⚠️ Admin_Comments Required\n\n" +
        "Please describe the issue in column O (Admin_Comments) before marking as 'Issue'.\n\n" +
        "This ensures the applicant receives a helpful email explaining what is needed."
      );
      return;
    }
    sendIssueEmail_(sheet, row);
  }
}

function processApproval_(sheet, row) {
  // Cheap unlocked pre-check — avoids an unnecessary manual-code prompt on an
  // obvious re-fire, but is NOT the safety guarantee (see the locked
  // reservation below, which is what actually prevents duplicates).
  let data = sheet.getRange(row, 1, 1, WF_TOTAL_COLS).getValues()[0];
  if (data[WF_COL.MEM_ID] && data[WF_COL.MEM_ID].toString().trim() !== "") return;

  const inst = data[WF_COL.INSTITUTE];

  // [B9/B10] Resolve the ID to use. generateMembershipID_ already increments
  // its counter atomically. The manual fallback is now ALSO collision-safe
  // (see resolveManualMembershipID_) — it never repeats "-0001-".
  let idData = generateMembershipID_(inst);
  if (!idData) {
    idData = resolveManualMembershipID_(inst); // [B11] interactive prompt, no lock held
    if (!idData) {
      sheet.getRange(row, WF_COL.PRES_STATUS + 1).setValue("Pending");
      return;
    }
  }

  // [B9/B12] ATOMIC RESERVATION — re-reads the cell fresh under lock AND
  // checks whether this person's CNIC already holds a Mem_ID on another
  // row. If either is true, nothing is written and no cert/email is sent.
  const reservation = reserveMembershipIdForRow_(sheet, row, data[WF_COL.CNIC], idData);
  if (!reservation.written) {
    if (reservation.reason === "DUPLICATE_CNIC") {
      sheet.getRange(row, WF_COL.PRES_STATUS + 1).setValue("Pending");
      SpreadsheetApp.getUi().alert(
        "⛔ Duplicate Person Detected\n\n" +
        `This applicant's CNIC already has an approved membership:\n` +
        `Mem_ID ${reservation.existing.id} — row ${reservation.existing.row} (${reservation.existing.name})\n\n` +
        `Row ${row} was reverted to Pending. No new ID was issued. Please review both rows manually.`
      );
    }
    return; // ALREADY_SET reason → silent no-op, same behavior as v7.1
  }

  const letterUrl = generatePDFCore_(
    data[WF_COL.FULL_NAME], data[WF_COL.CNIC], inst,
    idData.id, data[WF_COL.TIMESTAMP], CONFIG.CERT_TEMPLATE_ID, "Letter"
  );

  if (letterUrl) {
    sheet.getRange(row, WF_COL.CERT_URL + 1).setValue(letterUrl);
    // [N8] Set fee URL as clickable formula
    if (data[WF_COL.FEE_URL]) {
      sheet.getRange(row, WF_COL.FEE_URL + 1)
           .setFormula(`=HYPERLINK("${data[WF_COL.FEE_URL]}","View Receipt")`);
    }

    const emailToUse = (data[WF_COL.PERSONAL_EMAIL] && isValidEmail_(data[WF_COL.PERSONAL_EMAIL]))
                       ? data[WF_COL.PERSONAL_EMAIL]
                       : data[WF_COL.EMAIL];

    sendApprovalEmail_(data[WF_COL.FULL_NAME], emailToUse, letterUrl,
                       idData.id, idData.lcName, data[WF_COL.CLASS_YEAR], data[WF_COL.TIMESTAMP]);

    const waOk = sendWhatsAppMessage_(data[WF_COL.PHONE], data[WF_COL.FULL_NAME], idData.id, letterUrl);
    if (!waOk) sendSMSFallback_(data[WF_COL.PHONE], data[WF_COL.FULL_NAME], idData.id, letterUrl);

    logAudit_("APPROVAL_SUCCESS", `ID ${idData.id} issued to ${data[WF_COL.FULL_NAME]}.`);
  } else {
    queueRetry_(row, "PDF_GENERATION", {
      name: data[WF_COL.FULL_NAME], cnic: data[WF_COL.CNIC],
      institute: inst, memId: idData.id, // [L7] pass already-generated ID
      email: (data[WF_COL.PERSONAL_EMAIL] || data[WF_COL.EMAIL]),
      phone: data[WF_COL.PHONE], lcName: idData.lcName,
      classLvl: data[WF_COL.CLASS_YEAR], timestampDate: data[WF_COL.TIMESTAMP]
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 — WHATSAPP, SMS & MASTER EMAIL ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function sendWhatsAppMessage_(phone, name, memId, certUrl) {
  if (!CONFIG.TWILIO_SID || CONFIG.TWILIO_SID.includes("YOUR_")) return false;
  const fPhone = sanitizePhone_(phone);
  if (!fPhone) return false;

  const body =
    `*${CONFIG.ORG_ABBR} Official* ✅\n\n` +
    `Congratulations ${name}!\nYour membership *${memId}* has been approved.\n\n` +
    `📄 *Membership Letter:*\n${certUrl}\n\n` +
    `📢 *Official Channel:*\n${CONFIG.WA_CHANNEL}\n\n` +
    `💬 *Join Community:*\nGroup 1: ${CONFIG.WA_GROUP_1}\nGroup 2: ${CONFIG.WA_GROUP_2}`;

  return twilioFetch_(`whatsapp:${fPhone}`, CONFIG.TWILIO_WA_NUMBER, body);
}

function sendSMSFallback_(phone, name, memId, certUrl) {
  if (!CONFIG.TWILIO_SID || CONFIG.TWILIO_SID.includes("YOUR_")) return false;
  if (!CONFIG.TWILIO_SMS_NUMBER || CONFIG.TWILIO_SMS_NUMBER.includes("YOUR_")) return false;
  const fPhone = sanitizePhone_(phone);
  if (!fPhone) return false;

  const body = `MSA Pakistan: Congrats ${name}! Your ID is ${memId}. Download letter: ${certUrl}`;
  const ok   = twilioFetch_(fPhone, CONFIG.TWILIO_SMS_NUMBER, body);
  if (ok) logAudit_("SMS_FALLBACK", `SMS sent to ${fPhone} for ${name} (${memId}).`);
  return ok;
}

function twilioFetch_(to, from, body) {
  const url     = `https://api.twilio.com/2010-04-01/Accounts/${CONFIG.TWILIO_SID}/Messages.json`;
  const options = {
    method: "post",
    payload: { To: to, From: from, Body: body },
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(`${CONFIG.TWILIO_SID}:${CONFIG.TWILIO_TOKEN}`)
    },
    muteHttpExceptions: true
  };
  try { UrlFetchApp.fetch(url, options); return true; }
  catch(e) { Logger.log("Twilio error: " + e.message); return false; }
}

function buildMasterEmailWrapper_(contentHtml) {
  const socialLinks = [
    { href: CONFIG.FB_LINK, label: "Facebook",  img: "https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" },
    { href: CONFIG.IG_LINK, label: "Instagram", img: "https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" },
    { href: CONFIG.TW_LINK, label: "Twitter",   img: "https://img.icons8.com/ios-filled/50/ffffff/twitterx--v2.png" },
    { href: CONFIG.YT_LINK, label: "YouTube",   img: "https://img.icons8.com/ios-filled/50/ffffff/youtube-play.png" },
    { href: CONFIG.LI_LINK, label: "LinkedIn",  img: "https://img.icons8.com/ios-filled/50/ffffff/linkedin.png" },
    { href: CONFIG.IS_LINK, label: "Issuu",     img: "https://img.icons8.com/ios-filled/50/ffffff/open-book.png" },
    { href: CONFIG.LT_LINK, label: "Linktree",  img: "https://img.icons8.com/ios-filled/50/ffffff/link--v1.png" }
  ].map(s =>
    `<a href="${s.href}" style="margin:0 4px;text-decoration:none;">` +
    `<img src="${s.img}" width="22" alt="${s.label}" style="display:inline-block;">` +
    `</a>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="background:#f0f4f8;margin:0;padding:20px;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;">
<tr><td align="center">
<table width="650" cellpadding="0" cellspacing="0" border="0"
  style="background:#fff;border-collapse:collapse;box-shadow:0 4px 15px rgba(0,0,0,.05);">
  <tr><td style="background:#122840;text-align:center;padding:30px 20px;">
    <div style="color:#fff;font-size:26px;font-family:'Times New Roman',serif;margin-bottom:14px;" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    <img src="${CONFIG.LOGO_URL}" width="140" alt="MSA Pakistan Logo" style="margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <span style="color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Office of National Vice President for Members</span>
  </td></tr>
  <tr><td style="height:4px;background:#3498db;"></td></tr>
  <tr><td style="height:6px;background:#27ae60;"></td></tr>
  <tr><td style="padding:40px 30px;color:#2c3e50;font-size:14px;line-height:1.6;">
    ${contentHtml}
  </td></tr>
  <tr><td style="padding:0 30px;">
    <hr style="border:0;border-top:1px dashed #d2d6dc;margin:0 0 12px 0;">
    <p style="color:#27ae60;font-size:12px;font-weight:bold;margin:0 0 8px 0;">
    Go green! Please consider the environment before printing this email.
    </p>
    <p style="color:#718096;font-size:10px;line-height:1.4;text-align:justify;margin:0 0 28px 0;">
      <b>Disclaimer:</b> This email is confidential and intended solely for the named recipient. Sharing any part without written consent of MSA Pakistan is strictly prohibited. If received in error, please notify the sender immediately.
    </p>
  </td></tr>
  <tr><td style="background:#122840;padding:28px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="110" valign="middle" align="center" style="padding-right:18px;border-right:1px solid #4a5568;">
          <img src="${CONFIG.LOGO_URL}" width="90" alt="MSA Pakistan" style="display:block;">
        </td>
        <td valign="middle" style="padding-left:18px;">
          <div style="color:#fff;font-size:17px;font-weight:bold;margin-bottom:3px;">
            ${CONFIG.VPM_NAME} <span style="font-size:12px;color:#8fa6c2;font-weight:normal;">${CONFIG.VPM_PRONOUNS}</span>
          </div>
          <div style="color:#3498db;font-size:13px;font-weight:bold;margin-bottom:3px;">${CONFIG.VPM_TITLE}</div>
          <div style="color:#8fa6c2;font-size:12px;margin-bottom:10px;">MSA-Pakistan ${CONFIG.TERM}</div>
          <div style="color:#fff;font-size:12px;margin-bottom:4px;">
            Tel: ${CONFIG.VPM_PHONE} &nbsp;|&nbsp;
            <a href="mailto:${CONFIG.SENDER_EMAIL}" style="color:#3498db;text-decoration:none;">${CONFIG.SENDER_EMAIL}</a>
          </div>
          <div style="color:#fff;font-size:13px;font-weight:bold;">Medical Students' Association of Pakistan</div>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:22px;padding-top:18px;border-top:1px solid #4a5568;">
      ${socialLinks}
      <br><br>
      <a href="https://msapakistan.org" style="color:#fff;font-size:13px;font-weight:bold;text-decoration:none;">msapakistan.org</a>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function sendApprovalEmail_(name, email, certUrl, memId, lcName, classLvl, timestampDate) {
  if (!isValidEmail_(email)) {
    logAudit_("EMAIL_SKIP", `Invalid email for ${name}: "${email}"`);
    return false;
  }

  const appDate = timestampDate ? new Date(timestampDate) : new Date();
  const dateStr = Utilities.formatDate(appDate, Session.getScriptTimeZone(), "E MMM dd yyyy");
  // [N9] 4-digit year in ID display
  const yr = new Date().getFullYear().toString();

  const content = `
  <div style="text-align:left;margin-bottom:18px;">
    <span style="background:#e8f5e9;color:#27ae60;border:1px solid #27ae60;border-radius:4px;
                 padding:4px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
      Membership Status Update
    </span>
  </div>
  <div style="background:#27ae60;background:linear-gradient(135deg,#27ae60 0%,#1e8449 100%);
              color:#fff;padding:28px;border-radius:8px;margin-bottom:22px;">
    <h2 style="margin:0;font-size:22px;font-weight:700;">Congratulations, ${escapeHtml_(name)}! ✅</h2>
    <p style="margin:8px 0 0;font-size:15px;opacity:.9;">Your membership has been officially approved. Welcome to the MSA Pakistan family.</p>
  </div>
  <p style="margin-bottom:18px;font-size:14px;line-height:1.6;color:#4a5568;">
    After careful consideration and formal approval from the National President of MSA Pakistan,
    your application has been approved.
    <br><br>
    <span style="font-weight:600;color:#122840;">Validity Note:</span>
    This membership is valid until twelve months after the official declaration of your final-year results.
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:22px;margin-bottom:26px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
      <tr>
        <td width="40%" style="color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding-bottom:10px;">Position</td>
        <td style="color:#122840;font-weight:700;padding-bottom:10px;">General Member</td>
      </tr>
      <tr>
        <td style="color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:10px 0;border-top:1px solid #e2e8f0;">Local Council</td>
        <td style="color:#122840;font-weight:700;padding:10px 0;border-top:1px solid #e2e8f0;">${escapeHtml_(lcName)}</td>
      </tr>
      <tr>
        <td style="color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:10px 0;border-top:1px solid #e2e8f0;">MSAP ID</td>
        <td style="color:#27ae60;font-family:monospace;font-weight:700;font-size:15px;padding:10px 0;border-top:1px solid #e2e8f0;">${escapeHtml_(memId)}</td>
      </tr>
      <tr>
        <td style="color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding-top:10px;border-top:1px solid #e2e8f0;">Effective Date</td>
        <td style="color:#122840;font-weight:700;padding-top:10px;border-top:1px solid #e2e8f0;">${dateStr}</td>
      </tr>
    </table>
  </div>
  <div style="text-align:center;margin:30px 0;">
    <a href="${certUrl}"
       style="background:#122840;color:#fff;padding:15px 30px;border-radius:6px;
              text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
      Download Membership Letter
    </a>
  </div>
  <div style="background:#fff;border:1px solid #3498db;border-radius:10px;padding:26px;margin:36px 0;">
    <h4 style="color:#1a3a5c;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:1px;text-align:center;">
      Official Digital Resources
    </h4>
    <a href="${CONFIG.CONSTITUTION_URL}"
       style="display:block;background:#f0f7ff;color:#1a3a5c;padding:13px;border-radius:7px;
              text-decoration:none;font-weight:700;border-left:5px solid #3498db;margin-bottom:20px;">
      View Constitution &amp; Bylaws ${CONFIG.CONSTITUTION_YEAR}
    </a>
    <div style="text-align:center;margin-bottom:16px;">
      <p style="font-size:11px;color:#718096;margin:0 0 12px;text-transform:uppercase;font-weight:600;">Connect with the Community</p>
      <a href="${CONFIG.FB_LINK}"  style="text-decoration:none;margin:0 6px;color:#718096;">Facebook</a> ·
      <a href="${CONFIG.IG_LINK}"  style="text-decoration:none;margin:0 6px;color:#718096;">Instagram</a> ·
      <a href="${CONFIG.TW_LINK}"  style="text-decoration:none;margin:0 6px;color:#718096;">Twitter</a> ·
      <a href="${CONFIG.YT_LINK}"  style="text-decoration:none;margin:0 6px;color:#718096;">YouTube</a> ·
      <a href="${CONFIG.LI_LINK}"  style="text-decoration:none;margin:0 6px;color:#718096;">LinkedIn</a>
    </div>
    <div style="text-align:center;border-top:1px solid #f1f5f9;padding-top:18px;">
      <a href="${CONFIG.FB_GROUP_LINK}"
         style="background:#3b5998;color:#fff;padding:11px 22px;border-radius:50px;
                text-decoration:none;font-size:13px;font-weight:600;display:inline-block;">
      Join Member Discussion Group
      </a>
    </div>
  </div>
  <p style="font-size:14px;font-style:italic;color:#718096;margin-top:26px;">
    Welcome aboard. We look forward to your valuable contributions.
  </p>`;

  try {
    GmailApp.sendEmail(email, `[MSA Pakistan] Official Membership Letter — ${memId}`, "", {
      htmlBody: buildMasterEmailWrapper_(content),
      name: CONFIG.SENDER_DISPLAY_NAME
    });
    return true;
  } catch(e) {
    logAudit_("EMAIL_FAIL", `Approval email failed for ${name} (${email}): ${e.message}`);
    return false;
  }
}

/** [L2] Rejection email — Admin_Comments HTML-escaped */
function sendRejectionEmail_(name, email, reason) {
  if (!isValidEmail_(email)) return;
  const safeReason = reason ? escapeHtml_(reason.toString()) : "";
  const reasonLine = safeReason
    ? `<p style="font-weight:600;color:#c0392b;margin-top:10px;">Reason: ${safeReason}</p>`
    : "";
  const content = `
  <div style="background:#fdf2f2;border-left:5px solid #c0392b;padding:20px;border-radius:6px;margin-bottom:20px;">
    <h2 style="color:#c0392b;margin:0 0 8px;">Membership Application Update</h2>
    <p style="margin:0;font-size:14px;">Dear <b>${escapeHtml_(name)}</b>, after review by the MSA Pakistan National Executive Board,
    we regret to inform you that your membership application was not approved in this cycle.</p>
    ${reasonLine}
  </div>
  <p style="font-size:14px;line-height:1.6;color:#4a5568;">
    You are welcome to reapply in the next membership drive. If you have questions, please reply to this email
    or contact your Local Council President.
  </p>
  <p style="font-size:14px;color:#4a5568;">We appreciate your interest in MSA Pakistan and encourage you to stay engaged with our community.</p>`;

  try {
    GmailApp.sendEmail(email, "[MSA Pakistan] Membership Application — Update", "", {
      htmlBody: buildMasterEmailWrapper_(content),
      name: CONFIG.SENDER_DISPLAY_NAME
    });
  } catch(e) {
    logAudit_("EMAIL_FAIL", `Rejection email failed for ${name} (${email}): ${e.message}`);
  }
}

/** [L2] Issue notification — Admin_Comments HTML-escaped */
function sendIssueEmail_(sheet, row) {
  const name    = sheet.getRange(row, WF_COL.FULL_NAME + 1).getValue();
  const email   = sheet.getRange(row, WF_COL.EMAIL + 1).getValue();
  const pEmail  = sheet.getRange(row, WF_COL.PERSONAL_EMAIL + 1).getValue();
  const comments= sheet.getRange(row, WF_COL.ADMIN_COMMENTS + 1).getValue();
  const target  = (pEmail && isValidEmail_(pEmail)) ? pEmail : email;

  if (!isValidEmail_(target)) {
    logAudit_("ISSUE_FLAGGED", `Row ${row} — issue flagged but no valid email to notify.`);
    return;
  }

  const safeComments = escapeHtml_(comments ? comments.toString() : "Please reply to this email for details.");

  const content = `
  <h2 style="color:#c0392b;">Action Required: Membership Verification</h2>
  <p>Dear <b>${escapeHtml_(name)}</b>,</p>
  <p>Our verification team has flagged an issue with your membership application. We need your attention on the following:</p>
  <div style="background:#fdf2f2;padding:18px;border-left:5px solid #c0392b;color:#c0392b;margin:18px 0;font-size:14px;">
    <b>Issue / Required Action:</b><br>${safeComments}
  </div>
  <p><b>Please reply directly to this email</b> with the requested information or documents so we can continue processing your application.</p>`;

  try {
    GmailApp.sendEmail(target, "[Action Required] MSA Pakistan Membership Verification", "", {
      htmlBody: buildMasterEmailWrapper_(content),
      name: CONFIG.SENDER_DISPLAY_NAME
    });
    logAudit_("ISSUE_EMAIL_SENT", `Issue notification sent to ${name} (${target}).`);
  } catch(e) {
    logAudit_("EMAIL_FAIL", `Issue email failed for ${name}: ${e.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 — DYNAMIC PDF ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function generateLetterForSelected() {
  manualProcessPDF_(CONFIG.CERT_TEMPLATE_ID, "Letter", WF_COL.CERT_URL + 1);
}

function generateCardForSelected() {
  if (!CONFIG.CARD_TEMPLATE_ID || CONFIG.CARD_TEMPLATE_ID.includes("YOUR_")) {
    SpreadsheetApp.getUi().alert("Missing ID Card Template ID in CONFIG.");
    return;
  }
  manualProcessPDF_(CONFIG.CARD_TEMPLATE_ID, "ID Card", WF_COL.CARD_URL + 1);
}

function manualProcessPDF_(templateId, docType, colNum) {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_WORKFLOW) {
    SpreadsheetApp.getUi().alert("Run from the Membership Workflow sheet.");
    return;
  }
  const range    = sheet.getActiveRange();
  const startRow = range.getRow();
  if (startRow < 2) { SpreadsheetApp.getUi().alert("Select data rows, not the header."); return; }

  let success = 0;
  for (let i = 0; i < range.getNumRows(); i++) {
    const row  = startRow + i;
    const data = sheet.getRange(row, 1, 1, WF_TOTAL_COLS).getValues()[0];
    if (!data[WF_COL.MEM_ID]) continue;

    const url = generatePDFCore_(
      data[WF_COL.FULL_NAME], data[WF_COL.CNIC], data[WF_COL.INSTITUTE],
      data[WF_COL.MEM_ID], data[WF_COL.TIMESTAMP], templateId, docType
    );
    if (url) { sheet.getRange(row, colNum).setValue(url); success++; }
  }
  SpreadsheetApp.getUi().alert(`✅ Generated ${success} ${docType}(s).`);
}

function generatePDFCore_(name, cnic, institute, memId, timestampDate, templateId, docType) {
  try {
    const root      = DriveApp.getFolderById(CONFIG.CERT_FOLDER_ID.trim());
    const termFolder= getOrCreateFolder_(root, CONFIG.TERM);
    const lcFolder  = getOrCreateFolder_(termFolder, institute);
    const newName   = `${CONFIG.ORG_ABBR} ${docType} - ${name} (${memId})`;
    const tpl       = DriveApp.getFileById(templateId.trim());
    const tempDoc   = DocumentApp.openById(tpl.makeCopy(newName, lcFolder).getId());
    const body      = tempDoc.getBody();
    const appDate   = timestampDate ? new Date(timestampDate) : new Date();

    body.replaceText("{{Full Name}}",     name || "N/A");
    body.replaceText("{{CNIC}}",          cnic || "N/A");
    body.replaceText("{{Institution}}",   institute || "N/A");
    body.replaceText("{{Membership ID}}", memId || "N/A");
    body.replaceText("{{Date}}",          Utilities.formatDate(appDate, Session.getScriptTimeZone(), "dd MMMM yyyy"));
    body.replaceText("{{Generated Time}}",Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss"));

    tempDoc.saveAndClose();
    Utilities.sleep(2500);

    const docFile = DriveApp.getFileById(tempDoc.getId());
    const pdf     = lcFolder.createFile(docFile.getBlob().getAs(MimeType.PDF).setName(newName + ".pdf"));
    if (CONFIG.PDF_ACCESS === "PUBLIC") {
      pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    docFile.setTrashed(true);
    return pdf.getUrl();
  } catch(err) {
    logAudit_("PDF_CRASH", `ID:${memId} | ${err.message}`);
    return null;
  }
}

function getOrCreateFolder_(parent, name) {
  const clean = name.toString().trim().replace(/[\/\\]/g, "-");
  const iter  = parent.getFoldersByName(clean);
  return iter.hasNext() ? iter.next() : parent.createFolder(clean);
}

// ─────────────────────────────────────────────────────────────────────────────
// §8 — MEMBERSHIP ID GENERATION (with LockService)
// ─────────────────────────────────────────────────────────────────────────────
function getOfficialLCData_(inputName) {
  const mapSheet = getSheetSafe_(CONFIG.SHEET_MAPPING);
  if (!mapSheet) return null;
  const mappings  = mapSheet.getDataRange().getValues();
  const cleanInput= inputName.toString().toLowerCase().replace(/[^\w\s]/g, "").trim();

  for (let i = 1; i < mappings.length; i++) {
    const officialName = mappings[i][MAP_COL.INSTITUTE].toString();
    const offClean     = officialName.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const lcCode       = mappings[i][MAP_COL.LC_CODE].toString().toLowerCase().trim();
    const aliases      = mappings[i][MAP_COL.ALIASES] ? mappings[i][MAP_COL.ALIASES].toString().toLowerCase() : "";

    if (cleanInput === offClean || cleanInput === lcCode ||
        (cleanInput.length > 5 && offClean.includes(cleanInput)) ||
        (offClean.length > 5  && cleanInput.includes(offClean))) {
      return { officialName, lcName: mappings[i][MAP_COL.LC_NAME], code: mappings[i][MAP_COL.LC_CODE], rowIndex: i + 1, currentCount: Number(mappings[i][MAP_COL.COUNTER]) };
    }
    if (aliases) {
      const aliasArr = aliases.split(",").map(a => a.trim()).filter(a => a.length >= 4); // [L1]
      if (aliasArr.some(a => cleanInput === a ||
                             (cleanInput.length > 4 && cleanInput.includes(a)) ||
                             (a.length > 6 && a.includes(cleanInput)))) {
        return { officialName, lcName: mappings[i][MAP_COL.LC_NAME], code: mappings[i][MAP_COL.LC_CODE], rowIndex: i + 1, currentCount: Number(mappings[i][MAP_COL.COUNTER]) };
      }
    }
  }
  return null;
}

function generateMembershipID_(institute) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const match = getOfficialLCData_(institute);
    if (!match) return null;

    const mapSheet   = getSheetSafe_(CONFIG.SHEET_MAPPING);
    const freshCount = Number(mapSheet.getRange(match.rowIndex, MAP_COL.COUNTER + 1).getValue());
    const newCount   = freshCount + 1;
    mapSheet.getRange(match.rowIndex, MAP_COL.COUNTER + 1).setValue(newCount);
    SpreadsheetApp.flush();

    const yr = new Date().getFullYear().toString(); // [N9] 4-digit year
    return { id: `MSAP-${match.code}-${newCount.toString().padStart(4,"0")}/${yr}`, lcName: match.lcName };
  } finally {
    lock.releaseLock();
  }
}

/** [B12] Read-only: does ANY OTHER row already carry a Mem_ID for this CNIC? */
function findExistingMemIdForCNIC_(cleanCNIC, excludeRow) {
  if (!cleanCNIC) return null;
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return null;
  const data = wf.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const r = i + 1;
    if (r === excludeRow) continue;
    const memId = (data[i][WF_COL.MEM_ID] || "").toString().trim();
    if (!memId) continue;
    if (cleanCNIC_(data[i][WF_COL.CNIC]) === cleanCNIC) {
      return { id: memId, row: r, name: data[i][WF_COL.FULL_NAME] };
    }
  }
  return null;
}

/**
 * [B12] Single choke point for writing a Mem_ID to a row. Blocks if the
 * row already has one (existing B9 race guard) OR if another row already
 * holds an ID for the same CNIC (new cross-row duplicate-person guard).
 * Writes nothing on either block — caller decides what to do next.
 * Used by BOTH processApproval_ and bulkMigrateOldMembers so neither path
 * can issue a second ID to the same person.
 */
function reserveMembershipIdForRow_(sheet, row, cnic, idData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const freshMemId = sheet.getRange(row, WF_COL.MEM_ID + 1).getValue();
    if (freshMemId && freshMemId.toString().trim() !== "") {
      logAudit_("DUPLICATE_APPROVAL_BLOCKED",
        `Row ${row} already had Mem_ID ${freshMemId}; a second issuance (would-be ID ${idData.id}) was discarded.`);
      return { written: false, reason: "ALREADY_SET" };
    }
    const cleanC = cleanCNIC_(cnic);
    const existing = findExistingMemIdForCNIC_(cleanC, row);
    if (existing) {
      logAudit_("DUPLICATE_CNIC_APPROVAL_BLOCKED",
        `Row ${row} (CNIC ${cleanC}) blocked — CNIC already holds Mem_ID ${existing.id} ` +
        `on row ${existing.row} (${existing.name}). No ID issued.`);
      return { written: false, reason: "DUPLICATE_CNIC", existing: existing };
    }
    sheet.getRange(row, WF_COL.MEM_ID + 1).setValue(idData.id);
    SpreadsheetApp.flush();
    return { written: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * [B10] Manual LC-code fallback for institutes generateMembershipID_ can't
 * auto-match. Replaces the old hardcoded "-0001-" logic, which silently
 * reissued the SAME ID to every person from an unmatched institute.
 *
 * 1. Prompts for a code (unlocked — never blocks other admins).
 * 2. If that code already exists in LC Mapping, uses THAT row's real,
 *    live counter under lock — same guarantee as the automatic path.
 * 3. Otherwise tracks a dedicated counter for the new code in Document
 *    Properties, so repeat use of the same manual code never collides.
 * Never modifies LC Mapping rows or historical data — only reads/increments
 * a counter cell (existing LC) or a script-managed property (new code).
 */
function resolveManualMembershipID_(institute) {
  const ui   = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    "LC Code Required",
    `Cannot identify college:\n"${institute}"\n\nEnter 2–4 letter LC code (e.g. P1, KE, GEN):`,
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return null;

  const manualCode = (resp.getResponseText() || "").toUpperCase().trim() || "GEN";
  const yr   = new Date().getFullYear().toString();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // 1) Does this code already belong to a known LC? Use its real counter.
    const mapSheet = getSheetSafe_(CONFIG.SHEET_MAPPING);
    const mapData  = mapSheet.getDataRange().getValues();
    for (let i = 1; i < mapData.length; i++) {
      const rowCode = (mapData[i][MAP_COL.LC_CODE] || "").toString().toUpperCase().trim();
      if (rowCode === manualCode) {
        const freshCount = Number(mapSheet.getRange(i + 1, MAP_COL.COUNTER + 1).getValue());
        const newCount   = freshCount + 1;
        mapSheet.getRange(i + 1, MAP_COL.COUNTER + 1).setValue(newCount);
        SpreadsheetApp.flush();
        logAudit_("MANUAL_ID_MATCHED_EXISTING_LC",
          `"${institute}" manually coded "${manualCode}" matched existing LC ` +
          `"${mapData[i][MAP_COL.INSTITUTE]}" (consider adding an alias so this ` +
          `matches automatically next time) — used live counter #${newCount}.`);
        return { id: `MSAP-${manualCode}-${newCount.toString().padStart(4,"0")}/${yr}`,
                 lcName: mapData[i][MAP_COL.LC_NAME] || institute };
      }
    }

    // 2) Genuinely new/unrecognised code — persist its own counter so it
    //    can never repeat "0001" on a later use.
    const props = PropertiesService.getDocumentProperties();
    const key   = `MANUAL_COUNTER_${manualCode}`;
    const next  = (Number(props.getProperty(key)) || 0) + 1;
    props.setProperty(key, String(next));
    logAudit_("MANUAL_ID_NEW_CODE", `"${institute}" assigned new manual code "${manualCode}", counter #${next}.`);
    return { id: `MSAP-${manualCode}-${next.toString().padStart(4,"0")}/${yr}`, lcName: institute };
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §9 — WEB PORTAL, MEMBER STATUS PAGE & LC MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portal API bridge.
 * The React portal calls the Node server, which calls this endpoint server-to-server.
 * This keeps Google credentials and the spreadsheet itself out of the browser.
 */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = (body.action || "").toString().trim();

    if (action === "register") {
      return jsonResponse_(registerPortalApplication_(body.application || {}));
    }

    // Alias used by the current portal server: it posts the application fields
    // at the top level (no nested "application" object).
    if (action === "submitApplication") {
      return jsonResponse_(registerPortalApplication_(body.application || body));
    }

    if (action === "lookupMember") {
      return jsonResponse_(lookupPortalMember_(body.identifier || ""));
    }

    return jsonResponse_({ ok: false, code: "UNKNOWN_ACTION", message: "Unknown portal action." });
  } catch (err) {
    logAudit_("PORTAL_API_ERROR", err && err.message ? err.message : String(err));
    return jsonResponse_({ ok: false, code: "SERVER_ERROR", message: "The portal request could not be processed." });
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function registerPortalApplication_(a) {
  const required = [
    "email", "fullName", "contactNumber", "age", "dateOfBirth", "cnic", "gender",
    "cityOfResidence", "address", "reasonForJoining", "courseLevel", "courseOfStudy",
    "yearOfStudy", "institute", "discoverySources", "paymentAccountName"
  ];
  for (const key of required) {
    if (a[key] === undefined || a[key] === null || a[key].toString().trim() === "") {
      return { ok: false, code: "VALIDATION_ERROR", message: `Missing required field: ${key}` };
    }
  }

  const email = a.email.toString().trim().toLowerCase();
  const personalEmail = (a.personalEmail || "").toString().trim().toLowerCase();
  const cnic = cleanCNIC_(a.cnic);
  const source = getSheetSafe_(CONFIG.SHEET_SOURCE);
  const workflow = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!source || !workflow) {
    return { ok: false, code: "SHEETS_UNAVAILABLE", message: "Membership workflow sheets are unavailable." };
  }

  const existing = findExistingPortalApplication_(source, workflow, email, personalEmail, cnic);
  if (existing) {
    return {
      ok: false,
      code: "DUPLICATE_APPLICATION",
      message: `An application already exists for this email or CNIC. Reference: ${existing.reference}`
    };
  }

  const feeUrl = savePortalUpload_(a.feeReceipt, "Fee Receipt");
  const cnicUrl = savePortalUpload_(a.cnicCopy, "CNIC");

  const row = [
    new Date(),
    email,
    a.fullName.toString().trim(),
    personalEmail,
    a.contactNumber.toString().trim(),
    Number(a.age) || "",
    parsePortalDate_(a.dateOfBirth),
    "",
    cnic,
    a.gender.toString().trim(),
    a.cityOfResidence.toString().trim(),
    a.address.toString().trim(),
    a.reasonForJoining.toString().trim(),
    a.courseLevel.toString().trim(),
    a.courseOfStudy.toString().trim(),
    a.yearOfStudy.toString().trim(),
    a.institute.toString().trim(),
    "",
    a.discoverySources.toString().trim(),
    feeUrl,
    a.termsAccepted === true ? "Yes" : "No",
    (a.otherInstitute || "").toString().trim(),
    a.incompleteAcknowledgement === true ? "Yes" : "No",
    parsePortalDate_(a.graduationDate),
    cnicUrl,
    (a.conflictOfInterest || "No").toString().trim(),
    a.paymentAccountName.toString().trim()
  ];

  source.getRange(source.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();

  // API writes do not fire spreadsheet/form triggers, so explicitly run the
  // existing normalization + workflow sync after inserting the response.
  const sync = syncResponses(false);
  const applicationRef = Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();
  logAudit_("PORTAL_APPLICATION", `Portal application ${applicationRef} submitted by ${email}. Sync added ${sync.added} row(s).`);

  return {
    ok: true,
    message: "Application submitted successfully.",
    data: { applicationRef }
  };
}

function parsePortalDate_(value) {
  if (!value) return "";
  const d = new Date(value.toString());
  return isNaN(d.getTime()) ? value.toString() : d;
}

function savePortalUpload_(upload, label) {
  if (!upload || !upload.base64) return "";
  if (upload.base64.length > 8000000) throw new Error(`${label} file is too large.`);

  const folderId = CONFIG.MEMBERSHIP_UPLOAD_FOLDER_ID;
  if (!folderId || folderId.includes("YOUR_")) {
    throw new Error("MEMBERSHIP_UPLOAD_FOLDER_ID is not configured.");
  }

  const bytes = Utilities.base64Decode(upload.base64);
  const blob = Utilities.newBlob(bytes, upload.mimeType || MimeType.PDF, upload.fileName || `${label}.bin`);
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);
  return file.getUrl();
}

function findExistingPortalApplication_(source, workflow, email, personalEmail, cnic) {
  const sourceData = source.getDataRange().getValues();
  for (let i = 1; i < sourceData.length; i++) {
    const row = sourceData[i];
    const e1 = (row[1] || "").toString().trim().toLowerCase();
    const e2 = (row[3] || "").toString().trim().toLowerCase();
    const c = cleanCNIC_(row[8]);
    if ((email && (e1 === email || e2 === email)) ||
        (personalEmail && (e1 === personalEmail || e2 === personalEmail)) ||
        (cnic && c && c === cnic)) {
      return { reference: `SOURCE-${i + 1}` };
    }
  }

  const wfData = workflow.getDataRange().getValues();
  for (let i = 1; i < wfData.length; i++) {
    const row = wfData[i];
    const e1 = (row[WF_COL.EMAIL] || "").toString().trim().toLowerCase();
    const e2 = (row[WF_COL.PERSONAL_EMAIL] || "").toString().trim().toLowerCase();
    const c = cleanCNIC_(row[WF_COL.CNIC]);
    if ((email && (e1 === email || e2 === email)) ||
        (personalEmail && (e1 === personalEmail || e2 === personalEmail)) ||
        (cnic && c && c === cnic)) {
      return { reference: `WORKFLOW-${i + 1}` };
    }
  }
  return null;
}

function lookupPortalMember_(identifier) {
  const value = (identifier || "").toString().trim();
  if (!value) return { ok: false, code: "VALIDATION_ERROR", message: "Identifier is required." };

  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return { ok: false, code: "SHEETS_UNAVAILABLE", message: "Membership workflow is unavailable." };

  const data = wf.getDataRange().getValues();
  const needle = value.toLowerCase();
  for (let i = 1; i < data.length; i++) {
    const email = (data[i][WF_COL.EMAIL] || "").toString().trim().toLowerCase();
    const personalEmail = (data[i][WF_COL.PERSONAL_EMAIL] || "").toString().trim().toLowerCase();
    const memId = (data[i][WF_COL.MEM_ID] || "").toString().trim().toLowerCase();
    const status = (data[i][WF_COL.PRES_STATUS] || "").toString().trim();
    if (needle === email || needle === personalEmail || needle === memId) {
      const institute = (data[i][WF_COL.INSTITUTE] || "").toString().trim();
      // Safe profile only: never expose CNIC, address, admin comments, COI,
      // verification statuses or internal workflow notes.
      return {
        ok: true,
        data: {
          found: true,
          approved: status === "Approved",
          membershipId: data[i][WF_COL.MEM_ID] || "",
          email: data[i][WF_COL.EMAIL] || "",
          personalEmail: data[i][WF_COL.PERSONAL_EMAIL] || "",
          name: data[i][WF_COL.FULL_NAME] || "",
          phone: data[i][WF_COL.PHONE] || "",
          discipline: data[i][WF_COL.DISCIPLINE] || "",
          yearOfStudy: data[i][WF_COL.CLASS_YEAR] || "",
          graduationYear: data[i][WF_COL.YEAR_GRAD] || "",
          institute: institute,
          localCouncil: resolveLocalCouncilForInstitute_(institute),
          status: status,
          letterUrl: data[i][WF_COL.CERT_URL] || "",
          cardUrl: data[i][WF_COL.CARD_URL] || "",
          // Profile photos are not retained in the workflow sheet.
          profilePhotoUrl: ""
        }
      };
    }
  }
  return { ok: true, data: { found: false, approved: false } };
}

/** Resolve the Local Council name for a workflow institute via LC Mapping. */
function resolveLocalCouncilForInstitute_(institute) {
  if (!institute) return "";
  const map = getSheetSafe_(CONFIG.SHEET_MAPPING);
  if (!map) return "";
  const mapData = map.getDataRange().getValues();
  const needle = institute.toLowerCase();
  for (let j = 1; j < mapData.length; j++) {
    const official = (mapData[j][MAP_COL.INSTITUTE] || "").toString().toLowerCase();
    if (official && (needle === official || needle.indexOf(official) !== -1 || official.indexOf(needle) !== -1)) {
      return (mapData[j][MAP_COL.LC_NAME] || mapData[j][MAP_COL.INSTITUTE] || "").toString().trim();
    }
  }
  return "";
}

function doGet(e) {
  const mode = (e.parameter.mode || "").toLowerCase();

  if (mode === "status") {
    return HtmlService.createHtmlOutputFromFile("StatusPage")
      .setTitle("MSAP Member Status").addMetaTag("viewport","width=device-width,initial-scale=1");
  }

  const lcCode = e.parameter.lc    || "";
  const token  = e.parameter.token || "";

  if (!validatePortalToken_(lcCode, token)) {
    return HtmlService.createHtmlOutput(
      `<div style="font-family:Arial;text-align:center;padding:60px;">
       <h2 style="color:#c0392b;">🔒 Access Denied</h2>
       <p>Your portal link is invalid or has expired (links expire after ${CONFIG.PORTAL_TOKEN_VALIDITY_DAYS} days).<br>
       Please contact your <b>VPM</b> at <a href="mailto:${CONFIG.SENDER_EMAIL}">${CONFIG.SENDER_EMAIL}</a> to request a new link.</p>
       </div>`
    ).setTitle("MSAP Portal — Access Denied");
  }

  const tpl    = HtmlService.createTemplateFromFile("Portal");
  tpl.lcCode   = lcCode;
  tpl.orgAbbr  = CONFIG.ORG_ABBR;
  return tpl.evaluate()
    .setTitle("MSAP LC Portal").addMetaTag("viewport","width=device-width,initial-scale=1");
}

function getLCMembers(lcCode) {
  if (!lcCode) return [];
  const wfData  = getSheetSafe_(CONFIG.SHEET_WORKFLOW).getDataRange().getValues();
  const mapData = getSheetSafe_(CONFIG.SHEET_MAPPING).getDataRange().getValues();

  let targetInstitute = "";
  for (let i = 1; i < mapData.length; i++) {
    if (mapData[i][MAP_COL.LC_CODE] === lcCode) { targetInstitute = mapData[i][MAP_COL.INSTITUTE]; break; }
  }
  if (!targetInstitute) return [];

  const members = [];
  for (let i = 1; i < wfData.length; i++) {
    if (wfData[i][WF_COL.PRES_STATUS] !== "Approved") continue;
    if (!wfData[i][WF_COL.INSTITUTE].toString().includes(targetInstitute)) continue;
    members.push({
      row:        i + 1,
      name:       wfData[i][WF_COL.FULL_NAME],
      id:         wfData[i][WF_COL.MEM_ID],
      year:       wfData[i][WF_COL.CLASS_YEAR],
      discipline: wfData[i][WF_COL.DISCIPLINE],  // [N5]
      gradYear:   wfData[i][WF_COL.YEAR_GRAD]    // [N5]
    });
  }
  return members;
}

function updateMemberYear(row, newYear) {
  try {
    getSheetSafe_(CONFIG.SHEET_WORKFLOW).getRange(row, WF_COL.CLASS_YEAR + 1).setValue(newYear);
    logAudit_("PORTAL_UPDATE", `Row ${row} year updated to ${newYear}.`);
    return "Success";
  } catch(e) { return "Error: " + e.message; }
}

function getMemberStatus(email, cnic) {
  if (!email && !cnic) return { found: false, message: "Please provide your email or CNIC." };
  const wfData = getSheetSafe_(CONFIG.SHEET_WORKFLOW).getDataRange().getValues();
  const cleanC = cleanCNIC_(cnic);

  for (let i = 1; i < wfData.length; i++) {
    const rowEmail = wfData[i][WF_COL.EMAIL].toString().trim().toLowerCase();
    const rowPEmail= wfData[i][WF_COL.PERSONAL_EMAIL].toString().trim().toLowerCase();
    const rowCNIC  = cleanCNIC_(wfData[i][WF_COL.CNIC]);
    const emailMatch = email && (rowEmail === email.toLowerCase().trim() || rowPEmail === email.toLowerCase().trim());
    const cnicMatch  = cleanC && rowCNIC === cleanC;
    if (!emailMatch && !cnicMatch) continue;

    const status = wfData[i][WF_COL.PRES_STATUS];
    const memId  = wfData[i][WF_COL.MEM_ID];
    return {
      found:     true,
      name:      wfData[i][WF_COL.FULL_NAME],
      status:    status,
      memId:     memId || "—",
      institute: wfData[i][WF_COL.INSTITUTE],
      message: status === "Approved"
        ? `✅ Approved — Your MSAP ID is <b>${memId}</b>.`
        : status === "Rejected"
        ? "❌ Your application was not approved in this cycle. Please contact your LC President."
        : "⏳ Your application is under review. Please check back in a few days."
    };
  }
  return { found: false, message: "No record found. Please check your entries or contact your LC President." };
}

// [L5] Token: stored as "token:::timestamp"; 30-day expiry enforced
function generatePortalToken_() {
  return Utilities.getUuid().replace(/-/g, "").substring(0, 20);
}

function validatePortalToken_(lcCode, token) {
  if (!lcCode || !token) return false;
  const mapData = getSheetSafe_(CONFIG.SHEET_MAPPING).getDataRange().getValues();
  for (let i = 1; i < mapData.length; i++) {
    if (mapData[i][MAP_COL.LC_CODE] !== lcCode) continue;
    const stored = mapData[i][MAP_COL.TOKEN].toString();
    const parts  = stored.split(":::");
    const storedToken = parts[0];
    const storedTs    = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (storedToken !== token) continue;
    if (!storedTs) return false; // old-format token — force re-issue
    const ageDays = (new Date().getTime() - storedTs) / 86400000;
    return ageDays <= CONFIG.PORTAL_TOKEN_VALIDITY_DAYS;
  }
  return false;
}

function emailPortalLinks() {
  const mapSheet = getSheetSafe_(CONFIG.SHEET_MAPPING);
  if (!mapSheet) return;
  const webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl || !webAppUrl.includes("exec")) {
    SpreadsheetApp.getUi().alert("Deploy as Web App (Anyone) first.");
    return;
  }

  const mapData = mapSheet.getDataRange().getValues();
  let sent = 0;

  for (let i = 1; i < mapData.length; i++) {
    const inst  = mapData[i][MAP_COL.INSTITUTE];
    const code  = mapData[i][MAP_COL.LC_CODE];
    const email = mapData[i][MAP_COL.EMAIL];
    if (!email || !code) continue;

    // [L5] Store token:::timestamp
    const token = generatePortalToken_();
    const ts    = new Date().getTime();
    mapSheet.getRange(i + 1, MAP_COL.TOKEN + 1).setValue(`${token}:::${ts}`);

    const link = `${webAppUrl}?lc=${code}&token=${token}`;
    const body = `
      <h2 style="color:#122840;">MSAP Local Council Portal</h2>
      <p>Dear LC President of <b>${escapeHtml_(inst)}</b>,</p>
      <p>Your secure LC Portal is ready. Use it to view approved members, update study years, export rosters, and more. This link is unique to your college — do not share outside your LC Cabinet.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="background:#27ae60;color:#fff;padding:13px 26px;border-radius:6px;
                                 text-decoration:none;font-weight:bold;display:inline-block;">
          Access LC Portal
        </a>
      </div>
      <p style="font-size:12px;color:#718096;">This link expires in ${CONFIG.PORTAL_TOKEN_VALIDITY_DAYS} days. Request a fresh link from the VPM when needed.</p>`;

    if (isValidEmail_(email)) {
      try {
        GmailApp.sendEmail(email, `[MSAP] LC Portal Access — ${inst}`, "", {
          htmlBody: buildMasterEmailWrapper_(body), name: CONFIG.SENDER_DISPLAY_NAME
        });
        sent++;
      } catch(e) { logAudit_("EMAIL_FAIL", `Portal link email failed for ${inst}: ${e.message}`); }
    }
  }
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`✅ Portal links sent to ${sent} LC Presidents. Tokens regenerated (${CONFIG.PORTAL_TOKEN_VALIDITY_DAYS}-day expiry).`);
  logAudit_("PORTAL_LINKS_SENT", `${sent} LC portal links dispatched.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §10 — MISSING DATA, VERIFICATION & OFFICIALS
// ─────────────────────────────────────────────────────────────────────────────
function requestMissingDataForSelected() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ui    = SpreadsheetApp.getUi();
  if (sheet.getName() !== CONFIG.SHEET_WORKFLOW) { ui.alert("Run from the Workflow sheet."); return; }

  const range    = sheet.getActiveRange();
  const startRow = range.getRow();
  if (startRow < 2) { ui.alert("Select data rows, not the header."); return; }

  let sent = 0;
  for (let i = 0; i < range.getNumRows(); i++) {
    const row    = startRow + i;
    const name   = sheet.getRange(row, WF_COL.FULL_NAME + 1).getValue();
    const email  = sheet.getRange(row, WF_COL.EMAIL + 1).getValue();
    const pEmail = sheet.getRange(row, WF_COL.PERSONAL_EMAIL + 1).getValue();
    const target = (pEmail && isValidEmail_(pEmail)) ? pEmail : email;
    if (!isValidEmail_(target)) continue;

    const prompt = ui.prompt(`Missing Data — ${name}`,
      "Specify what is required (e.g., CNIC photo, fee slip, year of study):", ui.ButtonSet.OK_CANCEL);
    if (prompt.getSelectedButton() !== ui.Button.OK) continue;
    const notes = prompt.getResponseText().trim();
    if (!notes) continue;

    sheet.getRange(row, WF_COL.ADMIN_COMMENTS + 1).setValue(notes);
    sheet.getRange(row, WF_COL.VPF_STATUS + 1).setValue("Issue");
    sheet.getRange(row, WF_COL.VPM_STATUS + 1).setValue("Issue");

    const body = `
      <h2 style="color:#c0392b;">Action Required: Membership Verification</h2>
      <p>Dear <b>${escapeHtml_(name)}</b>, we cannot proceed with your application because:</p>
      <div style="background:#fdf2f2;padding:18px;border-left:5px solid #c0392b;color:#c0392b;margin:18px 0;font-size:14px;">
        <b>REQUIRED:</b> ${escapeHtml_(notes)}
      </div>
      <p><b>Please reply directly to this email</b> with the documents or information listed above.</p>`;

    try {
      GmailApp.sendEmail(target, "[Action Required] MSAP Membership Verification", "", {
        htmlBody: buildMasterEmailWrapper_(body), name: CONFIG.SENDER_DISPLAY_NAME
      });
      sent++;
      logAudit_("DATA_REQUEST", `Emailed ${name} (${target}) regarding: ${notes}`);
    } catch(e) { logAudit_("EMAIL_FAIL", `Missing-data email failed for ${name}: ${e.message}`); }
  }
  ui.alert(`✅ Sent ${sent} missing-data request(s).`);
}

/** [L6] Thresholds now read from CONFIG */
function notifyOfficials() {
  const data = getSheetSafe_(CONFIG.SHEET_WORKFLOW).getDataRange().getValues();
  let vpfPending = 0, vpmPending = 0, presPending = 0;

  for (let i = 1; i < data.length; i++) {
    const vpf = data[i][WF_COL.VPF_STATUS];
    const vpm = data[i][WF_COL.VPM_STATUS];
    const pres= data[i][WF_COL.PRES_STATUS];
    if (vpf === "Pending") vpfPending++;
    if (vpf === "Verified" && vpm === "Pending") vpmPending++;
    if (vpf === "Verified" && vpm === "Verified" && pres === "Pending") presPending++;
  }

  const alertBody = (role, count) => `
    <h2>Queue Alert: ${role}</h2>
    <p>There are <b>${count}</b> applications awaiting your action in the MSAP ERP.</p>
    <p>Please process them to maintain rapid turnaround for our members.</p>`;

  if (vpfPending  >= CONFIG.NOTIFY_VPF_THRESHOLD  && isValidEmail_(CONFIG.EMAIL_VPF)) {
    GmailApp.sendEmail(CONFIG.EMAIL_VPF, `[ALERT] ${vpfPending} Apps Pending VPF Review`, "",
      { htmlBody: buildMasterEmailWrapper_(alertBody("VPF", vpfPending)), name: CONFIG.SENDER_DISPLAY_NAME });
  }
  if (vpmPending  >= CONFIG.NOTIFY_VPM_THRESHOLD  && isValidEmail_(CONFIG.EMAIL_VPM)) {
    GmailApp.sendEmail(CONFIG.EMAIL_VPM, `[ALERT] ${vpmPending} Apps Pending VPM Review`, "",
      { htmlBody: buildMasterEmailWrapper_(alertBody("VPM", vpmPending)), name: CONFIG.SENDER_DISPLAY_NAME });
  }
  if (presPending >= CONFIG.NOTIFY_PRES_THRESHOLD && isValidEmail_(CONFIG.EMAIL_PRESIDENT)) {
    GmailApp.sendEmail(CONFIG.EMAIL_PRESIDENT, `[ALERT] ${presPending} Apps Pending Presidential Approval`, "",
      { htmlBody: buildMasterEmailWrapper_(alertBody("President", presPending)), name: CONFIG.SENDER_DISPLAY_NAME });
  }
  SpreadsheetApp.getUi().alert(`Queue: VPF=${vpfPending} | VPM=${vpmPending} | President=${presPending}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §11 — DASHBOARD, ROSTERS & MIGRATION
// ─────────────────────────────────────────────────────────────────────────────

/** [B1] Fixed: uses full institute name for LC matching; [N6] adds per-LC discipline breakdown */
function refreshDashboard_() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const dash   = getSheetSafe_(CONFIG.SHEET_DASHBOARD, ss);
  const wf     = getSheetSafe_(CONFIG.SHEET_WORKFLOW, ss);
  const mapSh  = getSheetSafe_(CONFIG.SHEET_MAPPING, ss);
  if (!dash || !wf || !mapSh) return;

  const data    = wf.getDataRange().getValues();
  const mapData = mapSh.getDataRange().getValues();

  let total = 0, mbbs = 0, bds = 0, dpt = 0, other = 0;
  let male = 0, female = 0, genderOther = 0, dupCNIC = 0;
  let totalLegacy = 0;

  // [B1] Build institute→lcName map using full institute names
  const instituteToLC = {};
  const lcStats = {};
  for (let i = 1; i < mapData.length; i++) {
    const officialName = mapData[i][MAP_COL.INSTITUTE].toString().trim();
    const lcName       = mapData[i][MAP_COL.LC_NAME].toString();
    const legacy       = Number(mapData[i][MAP_COL.LEGACY]) || 0;
    totalLegacy += legacy;
    if (officialName) instituteToLC[officialName.toLowerCase()] = lcName;
    if (lcName) lcStats[lcName] = { current: 0, legacy, mbbs: 0, bds: 0, dpt: 0, lcOther: 0 }; // [N6]
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][WF_COL.PRES_STATUS] !== "Approved") continue;
    total++;

    const disc = data[i][WF_COL.DISCIPLINE].toString().trim().toUpperCase();
    if (disc.includes("MBBS"))     mbbs++;
    else if (disc.includes("BDS")) bds++;
    else if (disc.includes("DPT")) dpt++;
    else                           other++;

    const g = data[i][WF_COL.GENDER].toString().trim().toLowerCase();
    if (g === "male")        male++;
    else if (g === "female") female++;
    else                     genderOther++;

    if (data[i][WF_COL.DUP_FLAG] === "DUPLICATE") dupCNIC++;

    // [B1] Match institute using full name map
    const inst      = data[i][WF_COL.INSTITUTE].toString().trim().toLowerCase();
    let   matchedLC = instituteToLC[inst];
    if (!matchedLC) {
      // Partial match fallback
      for (const [mapInst, lcName] of Object.entries(instituteToLC)) {
        if (mapInst.length > 5 && (inst.includes(mapInst) || mapInst.includes(inst))) {
          matchedLC = lcName;
          break;
        }
      }
    }
    if (matchedLC && lcStats[matchedLC]) {
      lcStats[matchedLC].current++;
      // [N6] Per-LC discipline
      if (disc.includes("MBBS"))     lcStats[matchedLC].mbbs++;
      else if (disc.includes("BDS")) lcStats[matchedLC].bds++;
      else if (disc.includes("DPT")) lcStats[matchedLC].dpt++;
      else                           lcStats[matchedLC].lcOther++;
    }
  }

  dash.clear();
  dash.getRange("A1:E1")
      .setValues([["📊 MSAP MEMBERSHIP ANALYTICS", "REFRESHED:", new Date(), "", ""]])
      .setBackground("#1a3a5c").setFontColor("#fff").setFontWeight("bold");

  const summaryRows = [
    ["Total Force (ERP + Legacy)", total + totalLegacy],
    ["ERP Approved",               total],
    ["Legacy Members",             totalLegacy],
    ["MBBS",                       mbbs],
    ["BDS",                        bds],
    ["DPT",                        dpt],
    ["Other Disciplines",          other],
    ["Male",                       male],
    ["Female",                     female],
    ["Gender Not Specified",       genderOther],
    ["⚠️ Duplicate CNIC Flags",    dupCNIC]
  ];
  dash.getRange(2, 1, summaryRows.length, 2).setValues(summaryRows).setBorder(true,true,true,true,true,true);
  dash.getRange(12, 1, 1, 2).setBackground("#FFE8CC").setFontWeight("bold");

  // [N6] LC table with per-discipline breakdown
  const lcHeaderRow = summaryRows.length + 3;
  dash.getRange(lcHeaderRow, 1, 1, 8)
      .setValues([["LOCAL COUNCIL","ERP ACTIVE","LEGACY","TOTAL","MBBS","BDS","DPT","OTHER"]])
      .setBackground("#27ae60").setFontColor("#fff").setFontWeight("bold");

  let drawRow = lcHeaderRow + 1;
  for (const [lc, c] of Object.entries(lcStats)) {
    dash.getRange(drawRow, 1, 1, 8).setValues([[
      lc, c.current, c.legacy, c.current + c.legacy,
      c.mbbs, c.bds, c.dpt, c.lcOther
    ]]);
    drawRow++;
  }

  logAudit_("DASHBOARD_REFRESH", "Analytics updated.");
  SpreadsheetApp.getUi().alert("✅ Analytics Dashboard refreshed.");
}

/** [L4] Batch cap added — max ROSTER_BATCH_LIMIT members per run */
function sendLCRosters() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const wf      = getSheetSafe_(CONFIG.SHEET_WORKFLOW, ss);
  const map     = getSheetSafe_(CONFIG.SHEET_MAPPING, ss);
  if (!wf || !map) return;

  const wfData  = wf.getDataRange().getValues();
  const mapData = map.getDataRange().getValues();

  const directory = {};
  for (let i = 1; i < mapData.length; i++) {
    if (mapData[i][MAP_COL.EMAIL]) directory[mapData[i][MAP_COL.INSTITUTE]] = mapData[i][MAP_COL.EMAIL];
  }

  const grouped = {};
  const processed = [];
  let totalQueued = 0;

  for (let i = 1; i < wfData.length; i++) {
    if (wfData[i][WF_COL.PRES_STATUS] !== "Approved" || wfData[i][WF_COL.LC_NOTIFIED] === "Yes") continue;
    if (totalQueued >= CONFIG.ROSTER_BATCH_LIMIT) break; // [L4]

    const inst = wfData[i][WF_COL.INSTITUTE].toString().trim();
    if (!grouped[inst]) grouped[inst] = [];
    const contactEmail = (wfData[i][WF_COL.PERSONAL_EMAIL] && isValidEmail_(wfData[i][WF_COL.PERSONAL_EMAIL]))
                         ? wfData[i][WF_COL.PERSONAL_EMAIL]
                         : wfData[i][WF_COL.EMAIL];
    grouped[inst].push({
      name: wfData[i][WF_COL.FULL_NAME],
      mail: contactEmail,
      cell: wfData[i][WF_COL.PHONE],
      lvl:  wfData[i][WF_COL.CLASS_YEAR],
      disc: wfData[i][WF_COL.DISCIPLINE],
      msap: wfData[i][WF_COL.MEM_ID]
    });
    processed.push(i + 1);
    totalQueued++;
  }

  let batches = 0;
  for (const [inst, members] of Object.entries(grouped)) {
    const target = directory[inst];
    if (!target || !isValidEmail_(target)) continue;

    const rows = members.map(m => `
      <tr>
        <td style="border-bottom:1px solid #eee;padding:9px;"><b>${escapeHtml_(m.name)}</b></td>
        <td style="border-bottom:1px solid #eee;padding:9px;">${m.msap}</td>
        <td style="border-bottom:1px solid #eee;padding:9px;">${m.disc}</td>
        <td style="border-bottom:1px solid #eee;padding:9px;">${m.lvl}</td>
        <td style="border-bottom:1px solid #eee;padding:9px;">${m.mail}</td>
        <td style="border-bottom:1px solid #eee;padding:9px;">${m.cell}</td>
      </tr>`).join("");

    const rosterBody = `
      <h2>Bi-Weekly Member Roster: ${escapeHtml_(inst)}</h2>
      <p>Dear LC President, please welcome and onboard the following newly verified members.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;text-align:left;border-collapse:collapse;">
        <thead><tr style="background:#f9f9f9;font-weight:bold;">
          <th style="padding:9px;">Name</th><th>MSAP ID</th><th>Discipline</th>
          <th>Year</th><th>Email</th><th>Phone</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    try {
      GmailApp.sendEmail(target, `[MSAP Roster] New Members for ${inst}`, "", {
        htmlBody: buildMasterEmailWrapper_(rosterBody), name: CONFIG.SENDER_DISPLAY_NAME
      });
      batches++;
    } catch(e) { logAudit_("EMAIL_FAIL", `Roster email failed for ${inst}: ${e.message}`); }
  }

  processed.forEach(idx => wf.getRange(idx, WF_COL.LC_NOTIFIED + 1).setValue("Yes"));
  const batchMsg = totalQueued >= CONFIG.ROSTER_BATCH_LIMIT
    ? ` (batch limit of ${CONFIG.ROSTER_BATCH_LIMIT} reached — re-run to continue)`
    : "";
  SpreadsheetApp.getUi().alert(`✅ Sent rosters to ${batches} LC Presidents covering ${processed.length} members.${batchMsg}`);
}

function bulkMigrateOldMembers() {
  const sheet = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  let done = 0, blocked = 0;

  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    if (data[i][WF_COL.PRES_STATUS] !== "Approved" || data[i][WF_COL.MEM_ID]) continue;

    const idData = generateMembershipID_(data[i][WF_COL.INSTITUTE]);
    if (!idData) { logAudit_("MIGRATE_SKIP", `Could not match institute for row ${row}.`); continue; }

    // [B12] Same guarded reservation used by processApproval_ — blocks if
    // this row's CNIC already holds a Mem_ID elsewhere. Nothing is written
    // on block; the case is only logged (Audit Log) for manual review.
    const reservation = reserveMembershipIdForRow_(sheet, row, data[i][WF_COL.CNIC], idData);
    if (!reservation.written) { blocked++; continue; }

    const url = generatePDFCore_(
      data[i][WF_COL.FULL_NAME], data[i][WF_COL.CNIC],
      data[i][WF_COL.INSTITUTE], idData.id, data[i][WF_COL.TIMESTAMP],
      CONFIG.CERT_TEMPLATE_ID, "Letter"
    );

    if (url) {
      sheet.getRange(row, WF_COL.CERT_URL + 1).setValue(url);
      sheet.getRange(row, WF_COL.LC_NOTIFIED + 1).setValue("Yes");
      const emailToUse = (data[i][WF_COL.PERSONAL_EMAIL] && isValidEmail_(data[i][WF_COL.PERSONAL_EMAIL]))
                         ? data[i][WF_COL.PERSONAL_EMAIL] : data[i][WF_COL.EMAIL];
      if (isValidEmail_(emailToUse)) {
        sendApprovalEmail_(data[i][WF_COL.FULL_NAME], emailToUse, url, idData.id,
                           idData.lcName, data[i][WF_COL.CLASS_YEAR], data[i][WF_COL.TIMESTAMP]);
      }
      const waOk = sendWhatsAppMessage_(data[i][WF_COL.PHONE], data[i][WF_COL.FULL_NAME], idData.id, url);
      if (!waOk) sendSMSFallback_(data[i][WF_COL.PHONE], data[i][WF_COL.FULL_NAME], idData.id, url);
      done++;
    }
    Utilities.sleep(500);
  }
  const blockedMsg = blocked > 0 ? ` ⛔ Skipped ${blocked} duplicate-person row(s) — see Audit Log.` : "";
  SpreadsheetApp.getUi().alert(`✅ Migration complete. Processed ${done} members (IDs + PDFs + emails sent).${blockedMsg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §12 — EXPIRY TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/** [B4] Fixed: extracts year from Date object or 4-digit string, not string regex */
function checkExpiryAlerts_() {
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return;
  const data    = wf.getDataRange().getValues();
  const today   = new Date();
  const expired = [];
  const upcoming= [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][WF_COL.PRES_STATUS] !== "Approved") continue;
    const gradRaw = data[i][WF_COL.YEAR_GRAD];
    if (!gradRaw) continue;

    // [B4] Correct year extraction
    let gradYear;
    if (gradRaw instanceof Date) {
      gradYear = gradRaw.getFullYear();
    } else {
      const s = gradRaw.toString().trim();
      gradYear = parseInt(s.substring(0, 4), 10);
    }
    if (isNaN(gradYear) || gradYear < 2020 || gradYear > 2040) continue;

    const expiry   = new Date(gradYear + 1, 11, 31);
    const diffDays = Math.ceil((expiry - today) / 86400000);

    if (diffDays < 0) {
      expired.push({ name: data[i][WF_COL.FULL_NAME], id: data[i][WF_COL.MEM_ID], gradYear, inst: data[i][WF_COL.INSTITUTE] });
    } else if (diffDays <= 90) {
      upcoming.push({ name: data[i][WF_COL.FULL_NAME], id: data[i][WF_COL.MEM_ID], gradYear, daysLeft: diffDays, inst: data[i][WF_COL.INSTITUTE] });
    }
  }

  if (expired.length === 0 && upcoming.length === 0) {
    logAudit_("EXPIRY_CHECK", "No expiring or expired memberships found.");
    return;
  }

  const buildRows = arr => arr.map(m =>
    `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;">${escapeHtml_(m.name)}</td>
     <td style="padding:7px 10px;border-bottom:1px solid #eee;">${m.id}</td>
     <td style="padding:7px 10px;border-bottom:1px solid #eee;">${m.gradYear}</td>
     <td style="padding:7px 10px;border-bottom:1px solid #eee;">${m.daysLeft !== undefined ? m.daysLeft + " days" : "EXPIRED"}</td>
     <td style="padding:7px 10px;border-bottom:1px solid #eee;">${escapeHtml_(m.inst)}</td></tr>`
  ).join("");

  const body = `
    <h2>📅 Membership Expiry Report</h2>
    ${expired.length ? `
    <h3 style="color:#c0392b;">⛔ Expired (${expired.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse;">
      <thead><tr style="background:#fdf2f2;"><th style="padding:7px 10px;">Name</th><th>ID</th><th>Grad Year</th><th>Status</th><th>Institute</th></tr></thead>
      <tbody>${buildRows(expired)}</tbody></table>` : ""}
    ${upcoming.length ? `
    <h3 style="color:#e67e22;">⚠️ Expiring Soon — within 90 days (${upcoming.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse;">
      <thead><tr style="background:#fff8f0;"><th style="padding:7px 10px;">Name</th><th>ID</th><th>Grad Year</th><th>Days Left</th><th>Institute</th></tr></thead>
      <tbody>${buildRows(upcoming)}</tbody></table>` : ""}`;

  if (isValidEmail_(CONFIG.EMAIL_PRESIDENT)) {
    GmailApp.sendEmail(CONFIG.EMAIL_PRESIDENT,
      `[MSAP] Membership Expiry Report — ${Utilities.formatDate(today,"Asia/Karachi","dd MMM yyyy")}`, "",
      { htmlBody: buildMasterEmailWrapper_(body), name: CONFIG.SENDER_DISPLAY_NAME });
  }
  logAudit_("EXPIRY_CHECK", `Expired: ${expired.length}, Expiring soon: ${upcoming.length}.`);
}

function runWeeklyTasks_() {
  refreshDashboard_();
  checkExpiryAlerts_();
  logAudit_("WEEKLY_TASKS", "Auto-refresh and expiry check complete.");
}

// ─────────────────────────────────────────────────────────────────────────────
// §13 — UTILITY FUNCTIONS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isValidEmail_(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toString().trim());
}

/** [N7] HTML escape — used in all email builders to prevent XSS from admin freetext */
function escapeHtml_(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

/** [B3] Normalise freetext COI responses → "No" for clear negatives */
function normalizeCOI_(raw) {
  if (!raw) return "";
  const s = raw.toString().trim();
  if (!s) return "";

  // Single-character or punctuation-only answers
  if (/^[.\-,!?nN\/aA]+$/.test(s) && s.length <= 5) return "No";

  const lower = s.toLowerCase().replace(/[.\-,!?]/g, "").trim();

  // Exact short negative words
  const noWords = new Set([
    "no", "nope", "nopes", "nil", "nill", "nils", "none", "na", "np", "nop",
    "nah", "naw", "null", "not", "nons", "non", "nons", "nopes", "nothing",
    "nillz", "nave", "n/a", "na", "not applicable", "nil.", "nope."
  ]);
  if (noWords.has(lower)) return "No";

  // Phrase prefixes that clearly mean no conflict
  const noPrefixes = [
    "not yet", "not really", "not currently", "not right now", "not a part",
    "not in any", "not as of", "not at", "not officially", "not of any",
    "not a member", "i am not", "i'm not", "i haven't", "i have not",
    "no other", "no conflict", "none as of", "not joined", "nope i",
    "no i am not", "no, i am not", "no i'm not", "no im not",
    "right now i'm not", "as of now no", "i am not a part",
    "i'm not a part", "i'm not in", "i am currently not",
    "first time", "first organization", "ain't", "am not a part",
    "not part of any", "not a part of any", "no, currently"
  ];
  if (noPrefixes.some(p => lower.startsWith(p) || lower === p)) return "No";

  return s; // Keep original — likely a real COI disclosure
}

function sanitizeAge_(raw) {
  if (!raw) return "";
  const n = parseInt(raw.toString().replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? "" : n;
}

function cleanCNIC_(raw) {
  if (!raw) return "";
  const str = raw.toString().trim();
  if (/e\+?\d+$/i.test(str)) {
    try { return String(Math.round(parseFloat(str))).replace(/[-\s]/g, ""); }
    catch(e) { return ""; }
  }
  return str.replace(/[-\s]/g, "").trim();
}

function sanitizePhone_(raw) {
  if (!raw) return "";
  let n = raw.toString().replace(/[^0-9]/g, "");
  if (/e\+?\d+$/i.test(raw.toString().trim())) {
    try { n = String(Math.round(parseFloat(raw.toString()))); }
    catch(e) { return ""; }
  }
  if (n.startsWith("0")) n = "92" + n.substring(1);
  if (!n.startsWith("+")) n = "+" + n;
  return n.length >= 12 && n.length <= 15 ? n : "";
}

function getSheetSafe_(name, ss) {
  const wb = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sh = wb.getSheetByName(name);
  if (!sh) Logger.log("Sheet not found: " + name);
  return sh || null;
}

function logAudit_(action, details) {
  try {
    const sh = getSheetSafe_(CONFIG.SHEET_AUDIT);
    if (sh) sh.appendRow([new Date(), Session.getActiveUser().getEmail() || "System", action, details]);
  } catch(e) { Logger.log("Audit log error: " + e.message); }
}

// [N2] Application completeness scorer (0–100)
function computeCompleteness_(rowData) {
  const fields = [
    { col: WF_COL.FULL_NAME,      weight: 15 },
    { col: WF_COL.CNIC,           weight: 20 },
    { col: WF_COL.PHONE,          weight: 10 },
    { col: WF_COL.GENDER,         weight:  5 },
    { col: WF_COL.DISCIPLINE,     weight: 10 },
    { col: WF_COL.CLASS_YEAR,     weight:  5 },
    { col: WF_COL.YEAR_GRAD,      weight:  5 },
    { col: WF_COL.PERSONAL_EMAIL, weight: 10 },
    { col: WF_COL.FEE_URL,        weight: 15 },
    { col: WF_COL.CNIC_PHOTO_URL, weight:  5 }
  ];
  let score = 0;
  for (const f of fields) {
    const val = rowData[f.col];
    if (val && val.toString().trim() !== "" && val.toString().trim().toLowerCase() !== "nan") {
      score += f.weight;
    }
  }
  return score;
}

/** [N2] Scan and write completeness scores to col X; apply heat-map */
function scanApplicationCompleteness_() {
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return;
  const data = wf.getDataRange().getValues();

  // Ensure header
  const hdr = wf.getRange(1, WF_COL.COMPLETENESS + 1).getValue();
  if (!hdr || hdr.toString().trim() === "") {
    wf.getRange(1, WF_COL.COMPLETENESS + 1).setValue("Completeness_%")
      .setBackground("#1a3a5c").setFontColor("#ffffff").setFontWeight("bold");
  }

  const scores = [];
  for (let i = 1; i < data.length; i++) {
    scores.push([computeCompleteness_(data[i])]);
  }

  if (scores.length > 0) {
    wf.getRange(2, WF_COL.COMPLETENESS + 1, scores.length, 1).setValues(scores);
  }

  SpreadsheetApp.getUi().alert(`✅ Completeness scan done. ${scores.length} rows scored in column X.`);
  logAudit_("COMPLETENESS_SCAN", `Scored ${scores.length} applications.`);
}

/** [N10] Lists installed triggers per handler — diagnose duplicate firing. Read-only. */
function diagnoseTriggers() {
  const counts = {};
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    counts[fn] = (counts[fn] || 0) + 1;
  });
  const report = JSON.stringify(counts, null, 2);
  Logger.log(report);
  SpreadsheetApp.getUi().alert("Installed triggers:\n\n" + report);
}

/**
 * [N11] ADMIN-ONLY — manually invoke from the script editor if
 * diagnoseTriggers() shows onWorkflowEdit > 1. Keeps exactly one
 * onWorkflowEdit trigger and deletes any extras. Only touches trigger
 * metadata — never reads, writes, or deletes any spreadsheet row/data.
 */
function removeDuplicateOnWorkflowEditTriggers_ADMIN_ONLY() {
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "onWorkflowEdit");
  if (triggers.length <= 1) {
    SpreadsheetApp.getUi().alert(`Only ${triggers.length} onWorkflowEdit trigger(s) found — nothing to remove.`);
    return;
  }
  for (let i = 1; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  logAudit_("TRIGGER_CLEANUP", `Removed ${triggers.length - 1} duplicate onWorkflowEdit trigger(s); 1 retained.`);
  SpreadsheetApp.getUi().alert(`✅ Removed ${triggers.length - 1} duplicate onWorkflowEdit trigger(s).`);
}

/**
 * [N12] REPORT-ONLY — scans Membership Workflow for any Mem_ID assigned to
 * more than one row. Does NOT modify anything; use it to decide manually
 * which row keeps the ID and which needs a corrected one.
 */
function findDuplicateMemIDs_REPORT_ONLY() {
  const wf   = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  const data = wf.getDataRange().getValues();
  const byId = {};
  for (let i = 1; i < data.length; i++) {
    const id = (data[i][WF_COL.MEM_ID] || "").toString().trim();
    if (!id) continue;
    (byId[id] = byId[id] || []).push({ row: i + 1, name: data[i][WF_COL.FULL_NAME] });
  }
  const dupes = Object.entries(byId).filter(([, rows]) => rows.length > 1);
  if (!dupes.length) {
    SpreadsheetApp.getUi().alert("✅ No duplicate Mem_IDs found.");
    return;
  }
  const lines = dupes.map(([id, rows]) =>
    `${id} → ${rows.map(r => `row ${r.row} (${r.name})`).join(" & ")}`
  ).join("\n");
  Logger.log(lines);
  SpreadsheetApp.getUi().alert(`⚠️ ${dupes.length} duplicate Mem_ID(s):\n\n${lines}`);
}

/**
 * [B12/N13] REPORT-ONLY — finds people (by CNIC) holding more than one
 * Mem_ID. This is the diagnostic for the exact bug reported: one person
 * ending up with two IDs (one via President approval, one via Bulk
 * Migrate). Does NOT modify anything — decide manually which ID/row to
 * keep, then handle the other by hand per your no-auto-delete rules.
 */
function findDuplicatePersonMemIDs_REPORT_ONLY() {
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  const data = wf.getDataRange().getValues();
  const byCNIC = {};
  for (let i = 1; i < data.length; i++) {
    const c = cleanCNIC_(data[i][WF_COL.CNIC]);
    const id = (data[i][WF_COL.MEM_ID] || "").toString().trim();
    if (!c || !id) continue;
    (byCNIC[c] = byCNIC[c] || []).push({ row: i + 1, name: data[i][WF_COL.FULL_NAME], id });
  }
  const dupes = Object.entries(byCNIC).filter(([, rows]) => rows.length > 1);
  if (!dupes.length) { SpreadsheetApp.getUi().alert("✅ No person holds more than one Mem_ID."); return; }
  const lines = dupes.map(([cnic, rows]) =>
    `CNIC ${cnic} (${rows[0].name}) → ${rows.map(r => `${r.id} (row ${r.row})`).join(" & ")}`
  ).join("\n");
  Logger.log(lines);
  SpreadsheetApp.getUi().alert(`⚠️ ${dupes.length} person(s) hold multiple Mem_IDs:\n\n${lines}`);
}

/** [N3] Retroactive CNIC duplicate check — flags rows missed before v7 */
function retroactiveDuplicateCheck() {
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return;
  const data = wf.getDataRange().getValues();
  const seen = new Map();
  let flagged = 0, cleared = 0;

  for (let i = 1; i < data.length; i++) {
    const c = cleanCNIC_(data[i][WF_COL.CNIC]);
    if (!c) continue;
    const currentFlag = data[i][WF_COL.DUP_FLAG];
    if (seen.has(c)) {
      if (currentFlag !== "DUPLICATE") {
        wf.getRange(i + 1, WF_COL.DUP_FLAG + 1).setValue("DUPLICATE");
        flagged++;
        logAudit_("RETRO_DUP_FLAG", `CNIC ${c} duplicate — row ${i + 1} flagged (first seen at row ${seen.get(c)}).`);
      }
    } else {
      seen.set(c, i + 1);
      // Clear erroneous flags for the first occurrence
      if (currentFlag === "DUPLICATE") {
        wf.getRange(i + 1, WF_COL.DUP_FLAG + 1).setValue("");
        cleared++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Retroactive CNIC check complete.\nNewly flagged: ${flagged}\nErroneous flags cleared: ${cleared}`);
}

/** [N1] Bulk verify selected rows — VPF */
function batchVerifyVPF_() { batchVerify_("VPF"); }

/** [N1] Bulk verify selected rows — VPM */
function batchVerifyVPM_() { batchVerify_("VPM"); }

function batchVerify_(role) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ui    = SpreadsheetApp.getUi();
  if (sheet.getName() !== CONFIG.SHEET_WORKFLOW) {
    ui.alert("Run from the Membership Workflow sheet.");
    return;
  }
  const range    = sheet.getActiveRange();
  const startRow = range.getRow();
  if (startRow < 2) { ui.alert("Select data rows, not the header."); return; }

  const numRows = range.getNumRows();
  const confirm = ui.alert(
    `Bulk ${role} Verification`,
    `Set ${role}_Status = "Verified" for ${numRows} selected row(s)?\n\nThis action will be logged.`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const col = (role === "VPF") ? WF_COL.VPF_STATUS + 1 : WF_COL.VPM_STATUS + 1;
  let done = 0;
  for (let i = 0; i < numRows; i++) {
    const row     = startRow + i;
    const current = sheet.getRange(row, col).getValue();
    if (current !== "Verified") {
      sheet.getRange(row, col).setValue("Verified");
      done++;
    }
  }
  SpreadsheetApp.flush();
  logAudit_(`BULK_${role}_VERIFY`, `${done} rows bulk-verified by ${Session.getActiveUser().getEmail()}.`);
  ui.alert(`✅ Done. ${done} row(s) set to ${role} Verified.`);
}

/** [N8] Convert Fee_Receipt_URL plain text values to clickable HYPERLINK formulas */
function feeReceiptHyperlinks_() {
  const wf = getSheetSafe_(CONFIG.SHEET_WORKFLOW);
  if (!wf) return;
  const data = wf.getDataRange().getValues();
  let converted = 0;

  for (let i = 1; i < data.length; i++) {
    const url = data[i][WF_COL.FEE_URL];
    if (!url || typeof url !== "string" || !url.trim().startsWith("http")) continue;
    wf.getRange(i + 1, WF_COL.FEE_URL + 1).setFormula(`=HYPERLINK("${url.trim()}","View Receipt")`);
    converted++;
  }
  SpreadsheetApp.getUi().alert(`✅ Converted ${converted} fee receipt URLs to clickable links.`);
  logAudit_("FEE_HYPERLINKS", `${converted} fee receipt URLs converted.`);
}

function testSinglePortalLink() {
  const TEST_LC_CODE = "P1"; // ← change to the LC code you want to test

  const mapSheet = getSheetSafe_(CONFIG.SHEET_MAPPING);
  const webAppUrl = ScriptApp.getService().getUrl();
  const mapData = mapSheet.getDataRange().getValues();

  for (let i = 1; i < mapData.length; i++) {
    if (mapData[i][MAP_COL.LC_CODE] !== TEST_LC_CODE) continue;

    const inst  = mapData[i][MAP_COL.INSTITUTE];
    const email = mapData[i][MAP_COL.EMAIL];
    const token = generatePortalToken_();
    const ts    = new Date().getTime();

    mapSheet.getRange(i + 1, MAP_COL.TOKEN + 1).setValue(`${token}:::${ts}`);
    SpreadsheetApp.flush();

    const link = `${webAppUrl}?lc=${TEST_LC_CODE}&token=${token}`;
    Logger.log("Portal link: " + link);

    if (isValidEmail_(email)) {
      GmailApp.sendEmail(email, `[MSAP] LC Portal Access — ${inst}`, "", {
        htmlBody: buildMasterEmailWrapper_(
          `<h2>MSAP Local Council Portal</h2>
           <p>Dear LC President of <b>${escapeHtml_(inst)}</b>, your portal link is ready.</p>
           <div style="text-align:center;margin:28px 0;">
             <a href="${link}" style="background:#27ae60;color:#fff;padding:13px 26px;
             border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
               Access LC Portal
             </a>
           </div>
           <p style="font-size:12px;color:#718096;">Expires in ${CONFIG.PORTAL_TOKEN_VALIDITY_DAYS} days.</p>`
        ),
        name: CONFIG.SENDER_DISPLAY_NAME
      });
      SpreadsheetApp.getUi().alert("✅ Portal link sent to: " + email + "\n\nLink: " + link);
    }
    return;
  }
  SpreadsheetApp.getUi().alert("LC code not found: " + TEST_LC_CODE);
}
