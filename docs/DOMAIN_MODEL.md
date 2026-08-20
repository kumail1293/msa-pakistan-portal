# Domain Model

## Core Entities

### User
- **Purpose**: Any person who interacts with the system (member, admin, official)
- **Key fields**: openId, email, name, cnic, phone, role, membershipStatus
- **Lifecycle**: Created → Active → Inactive/Suspended/Terminated/Alumni

### Organization
- **Purpose**: Any organizational unit (national body, chapter, committee, project)
- **Types**: national, regional, international, chapter, committee, project, task_force, working_group
- **Hierarchy**: Parent-child relationships for nested organizations

### Organizational Unit
- **Purpose**: Subdivisions within an organization
- **Types**: chapter, committee, project, task_force, working_group, delegation, division, department

---

## Membership Domain

### Membership Application
- **States**: pending → approved/rejected
- **Workflow**: Submit → Review → Decision → Account Creation
- **Documents**: Profile photo, fee receipt, CNIC copy

### Member Card
- **States**: none → pending_signature → signed → issued → expired
- **Workflow**: Issue → Holder signs → Reviewed → Active
- **Versioning**: Cards are versioned for reissues

### Lifecycle Case
- **Types**: suspend, terminate, reinstate
- **States**: pending → approved/rejected
- **Timeline**: Full audit trail of every action

---

## Governance Domain

### Elections
- **Types**: presidential, board, national_team, regional, chapter, committee
- **States**: draft → nominations_open → voting_active → counting → certified → published
- **Voting Methods**: plurality, majority, ranked_choice, runoff, weighted, secret_ballot

### Plenary Sessions
- **States**: proposed → scheduled → in_progress → adjourned
- **Components**: Agenda → Items → Motions → Debate → Vote → Resolution

### Motions
- **Types**: main, amendment, procedural, point_of_order, closure
- **States**: proposed → seconded → debated → voted → adopted/rejected

---

## Workflow Domain

### Workflow Definition
- **Versioning**: Each workflow has a version number
- **Status**: draft → active → archived
- **Triggers**: Manual, event-based, schedule-based

### Workflow Stage
- **Types**: start, form, review, approval, parallel_approval, conditional, score, assignment, notification, timer, escalation, webhook, integration, generate_document, generate_certificate, payment, end
- **Transitions**: Each stage can transition to multiple next stages based on outcome

### Workflow Instance
- **States**: running → completed/rejected/cancelled/paused
- **Tracks**: Which entity is going through which workflow

### Workflow Task
- **States**: pending → in_progress → completed/rejected/escalated/overdue
- **Assignment**: Tasks are assigned to specific users

---

## Forms Domain

### Form Definition
- **Status**: draft → active → archived
- **Versioning**: Forms are versioned
- **Usage Types**: membership_application, activity_proposal, survey, evaluation, registration

### Form Field
- **Types**: text, textarea, number, email, phone, date, select, multi_select, checkbox, radio, file, image, signature, divider, heading, paragraph, rating, matrix, address, ranking
- **Features**: Validation, conditional display, groups, width options

### Form Submission
- **States**: submitted → reviewed → approved/rejected
- **Data**: JSON payload of field values

---

## Finance Domain

### Budget
- **Periods**: Annual, quarterly, project-based
- **Categories**: Configurable via rules engine

### Expense
- **States**: draft → submitted → approved/rejected → paid
- **Workflow**: Submit → Review → Approve → Pay → Reconcile

### Transaction
- **Types**: income, expense, transfer, refund
- **Audit**: Full trail of every financial movement

---

## Activity Domain

### Activity/Event
- **Types**: NEF, NRF, workshop, seminar, conference, social
- **States**: draft → proposed → approved → active → completed → archived
- **Workflow**: Proposal → Review → Approval → Execution → Reporting

### Attendance
- **States**: registered → attended → no_show → excused
- **Tracking**: QR codes, manual check-in, self-reporting

---

## Document Domain

### Document Template
- **Types**: letter, certificate, card, report, form
- **Engine**: Handlebars/PDF generation with dynamic data

### Generated Document
- **States**: generated → signed → archived
- **Storage**: Local filesystem or cloud storage

---

## Notification Domain

### Notification Template
- **Types**: email, push, in-app, sms
- **Placeholders**: Dynamic data injection
- **Triggers**: Event-based, schedule-based, condition-based

### Notification
- **States**: pending → sent → delivered → read → archived
- **Preferences**: Per-user notification settings

---

## Entity Relationship Overview

```
User ──┬── has many → UserRoles ──→ Role ──→ Permissions
       ├── has many → LifecycleCases
       ├── has many → MemberCards
       ├── has many → FormSubmissions
       ├── has many → AuditEvents
       └── belongs to → Organizations

Organization ──┬── has many → OrganizationalUnits
               ├── has many → Workflows
               └── has many → Configuration

Workflow ──┬── has many → WorkflowStages ──→ Transitions
           └── has many → WorkflowInstances ──→ Tasks

Form ──┬── has many → FormFields
       └── has many → FormSubmissions

Election ──┬── has many → Candidates
           ├── has many → Ballots
           └── has many → Results

PlenarySession ──┬── has many → AgendaItems
                 ├── has many → Motions
                 └── has many → Resolutions
```
