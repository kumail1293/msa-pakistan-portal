// Add these functions to the existing MSAP ERP v7.3 script.
// Also add the two CONFIG keys described in the README.

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

