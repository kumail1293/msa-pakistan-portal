# Phase 17 — Production Reality Audit

## Membership Application → Database Field Mapping

| Excel Column | Target | Status | Notes |
|---|---|---|---|
| Full Name | `users.name` / `membershipApplications.fullName` | ✅ KEEP | |
| Email | `users.email` / `membershipApplications.email` | ✅ KEEP | |
| CNIC | `users.cnic` / `membershipApplications.cnic` | ✅ KEEP | |
| Institute | `membershipApplications.institute` | ✅ KEEP | Maps to `institutions` table |
| Course of Study | `membershipApplications.courseOfStudy` | ✅ KEEP | |
| Year of Study | `membershipApplications.yearOfStudy` | ✅ KEEP | |
| Contact Number | `membershipApplications.contactNumber` | ✅ KEEP | |
| VPF_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task in membership workflow |
| VPM_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task in membership workflow |
| Pres_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task in membership workflow |
| Mem_ID | `users.membershipId` | ✅ KEEP | Generated on approval |
| Cert_URL | `documents` (type=Certificate) | ✅ DOCUMENT | Auto-generated on approval |
| Card_URL | `memberCards` | ✅ DOCUMENT | Auto-generated on approval |
| LC_Notified | `auditEvents` (action=membership.lc_notified) | ✅ WORKFLOW | Audit event |
| Dup_CNIC_Flag | Validation in membership engine | ✅ DERIVE | Checked during submission |
| Completeness_% | Derived from field validation | ✅ DERIVE | Calculated from form data |
| Fee Receipt | `membershipApplications.feeReceiptUrl` | ✅ DOCUMENT | File upload |
| CNIC Photo | `membershipApplications.cnicCopyUrl` | ✅ DOCUMENT | File upload |
| Profile Photo | `membershipApplications.profilePhotoUrl` | ✅ DOCUMENT | File upload |
| Reason for Joining | `membershipApplications.reasonForJoining` | ✅ KEEP | |
| Discovery Sources | `membershipApplications.discoverySources` | ✅ KEEP | JSON array |
| Payment Account Name | `membershipApplications.paymentAccountName` | ✅ KEEP | |
| Terms Accepted | `membershipApplications.termsAccepted` | ✅ KEEP | |
| LC (local council) | `membershipApplications.institute` → `localCouncils` | ✅ KEEP | Mapped via institution |

### Membership Workflow States

```
submitted → pending_review → lc_verification → vpi_approval → approved → membership_created → certificate_generated → notified
         ↘ rejected
```

## NEF Application → Database Field Mapping

| Excel Column | Target | Status | Notes |
|---|---|---|---|
| Activity_ID | `activities.id` | ✅ KEEP | |
| Activity_Name | `activities.title` | ✅ KEEP | |
| Institute | `activities.organizationId` → `organizations` | ✅ KEEP | |
| Coordinator | `activities.createdById` → `users` | ✅ KEEP | |
| Budget | `financeTransactions` (type=expense) | ✅ WORKFLOW | Financial data in workflow |
| VPF_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task |
| VPA_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task |
| Pres_Status | `workflowTasks` (approval) | ✅ WORKFLOW | Approval task |
| Stage | `workflowInstances.status` + `workflowStages.name` | ✅ WORKFLOW | Current workflow stage |
| Stage_Since | `workflowTasks.createdAt` | ✅ DERIVE | When current stage started |
| NRF_Status | `workflowInstances` (entityType=nrf) | ✅ WORKFLOW | Separate workflow |
| NRF_Deadline | `workflowTasks.dueAt` | ✅ WORKFLOW | Deadline in task |
| Drive_Folder_URL | `documents` (type=folder_reference) | ✅ DOCUMENT | Google Drive reference |
| Certificates_Issued | Derived from `documents` count | ✅ DERIVE | Count of issued certificates |
| Activity_Completed | `workflowInstances.status=completed` | ✅ WORKFLOW | Terminal state |
| Cancelled | `workflowInstances.status=cancelled` | ✅ WORKFLOW | Terminal state |

### NEF Workflow States

```
submitted → vpa_review → vpf_review → president_approval → approved → execution → report → closed
         ↘ rejected                                              ↘ cancelled
```

## LC/CI → Database Field Mapping

| Excel Column | Target | Status | Notes |
|---|---|---|---|
| LC Name | `localCouncils.name` | ✅ KEEP | |
| Short Code | `localCouncils.shortCode` | ✅ KEEP | |
| City | `localCouncils.city` | ✅ KEEP | |
| University | `localCouncils.university` | ✅ KEEP | |
| Status | `localCouncils.status` | ✅ KEEP | permanent/temporary/candidate |
| President | `localCouncils.presidentId` → `users` | ✅ KEEP | |
| Member Count | Derived from `users.localCouncilId` | ✅ DERIVE | COUNT query |
| Last Active | Derived from `auditEvents` | ✅ DERIVE | Most recent activity |
| Compliance Reports | `documents` (type=compliance) | ✅ DOCUMENT | Required reports |

## Architecture Gap Analysis

### What EXISTS and WORKS:
1. ✅ `membershipApplications` table — full application data
2. ✅ `users` table — member profile with all fields
3. ✅ `localCouncils` table — LC/CI management
4. ✅ `workflowEngine` — generic state machine
5. ✅ `workflowMigration` — 7 migration adapters
6. ✅ `formPipelineEngine` — form → workflow → approval
7. ✅ `documents` table — document storage
8. ✅ `auditEvents` table — audit trail
9. ✅ `governanceRulesEngine` — configurable rules
10. ✅ `configService` — 83+ configuration keys

### What's MISSING for real production:
1. 🔴 Membership approval doesn't auto-create user account on approval
2. 🔴 NEF/NRF doesn't have a real database table for activities
3. 🔴 No Google Drive integration for document storage
4. 🔴 No notification delivery (email/in-app)
5. 🟡 Workflow engine doesn't auto-assign tasks to approvers
6. 🟡 No form → membership application connection
7. 🟡 No LC verification step in membership workflow
8. 🟡 No financial transaction integration in NEF workflow

### Migration Priority:
1. **Membership** — make form → approval → account creation work end-to-end
2. **NEF/NRF** — make activity → review → approval → execution work
3. **LC Management** — make LC status transitions work
4. **Documents** — auto-generate certificates on approval
5. **Notifications** — send emails on status changes
