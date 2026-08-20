# Workflow Engine v2

## Overview

The Workflow Engine is the backbone of all business processes. It provides a configurable, versioned workflow system with branching transitions, SLA tracking, and integration hooks.

---

## Architecture

### Current (v1) Limitation
```
Stage A → nextStageId → Stage B → nextStageId → Stage C
```
Linear only. No branching based on outcome.

### Target (v2) Design
```
Stage A
   │
   ├── approved ───────→ Stage B
   │
   ├── rejected ───────→ Stage C
   │
   ├── needs_revision ─→ Stage D
   │
   └── expired ────────→ Escalation
```
Full transition graph with outcome-based routing.

---

## Enhanced Workflow Structure

```text
Workflow
├── Version
├── Trigger (manual, event, schedule, webhook)
├── Stages
│   ├── Stage A
│   │   ├── Transitions
│   │   │   ├── approved → Stage B
│   │   │   ├── rejected → Stage C
│   │   │   └── needs_revision → Stage D
│   │   ├── Conditions (who can act, when)
│   │   ├── SLA (time limit, escalation)
│   │   ├── Permissions (who can do what)
│   │   ├── Notifications (who gets notified)
│   │   ├── Forms (what data is collected)
│   │   └── Documents (what is generated)
│   └── Stage B
│       └── ...
├── Conditions (global workflow conditions)
├── Rules (business rules for routing)
├── Permissions (overall workflow access)
├── SLA (overall workflow deadline)
├── Escalations (what happens on timeout)
├── Notifications (workflow-level notifications)
├── Integrations (webhooks, external systems)
└── Audit Events (complete history)
```

---

## Schema Design

### workflow_definitions (renamed from workflows)
```sql
CREATE TABLE workflow_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
  
  -- What triggers this workflow
  trigger_type ENUM('manual', 'event', 'schedule', 'webhook') DEFAULT 'manual',
  trigger_config JSON, -- event name, schedule cron, webhook URL
  
  -- Global conditions for starting this workflow
  start_conditions JSON,
  
  -- Overall SLA
  sla_deadline_hours INT,
  sla_escalation_config JSON,
  
  -- Metadata
  created_by INT,
  organization_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE INDEX idx_name_version (name, version)
);
```

### workflow_stages (enhanced)
```sql
CREATE TABLE workflow_stages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM(
    'start', 'form', 'review', 'approval', 'parallel_approval',
    'conditional', 'score', 'assignment', 'notification', 'timer',
    'escalation', 'webhook', 'integration', 'generate_document',
    'generate_certificate', 'payment', 'approval_group', 'end'
  ) NOT NULL,
  sort_order INT NOT NULL,
  
  -- Stage configuration
  config JSON, -- type-specific configuration
  
  -- Conditions for entering this stage
  entry_conditions JSON,
  
  -- SLA for this stage
  sla_hours INT,
  sla_escalation_config JSON,
  
  -- Permissions for this stage
  required_permissions JSON, -- ["member.approve", "chapter.admin"]
  
  -- Notification hooks
  on_enter_notifications JSON,
  on_complete_notifications JSON,
  on_timeout_notifications JSON,
  
  -- Form to display (for form stages)
  form_id INT,
  
  -- Document generation (for document stages)
  document_template_id INT,
  
  -- Assignment rules
  assignment_rules JSON, -- who gets assigned to tasks in this stage
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_workflow_order (workflow_id, sort_order)
);
```

### workflow_transitions (NEW - the key addition)
```sql
CREATE TABLE workflow_transitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  from_stage_id INT NOT NULL,
  to_stage_id INT NOT NULL,
  
  -- What outcome triggers this transition
  outcome VARCHAR(100) NOT NULL, -- 'approved', 'rejected', 'needs_revision', 'expired', 'default'
  
  -- Conditions for this transition to be available
  conditions JSON, -- e.g., {"minApprovals": 2, "role": "admin"}
  
  -- Priority (for multiple transitions with same outcome)
  priority INT DEFAULT 0,
  
  -- Is this the default transition if no conditions match?
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_from_stage (from_stage_id),
  INDEX idx_workflow (workflow_id)
);
```

### workflow_instances (enhanced)
```sql
CREATE TABLE workflow_instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  workflow_version INT NOT NULL,
  
  -- What entity this workflow is processing
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  
  -- Current state
  current_stage_id INT,
  status ENUM('running', 'completed', 'rejected', 'cancelled', 'paused', 'expired') DEFAULT 'running',
  
  -- Who started it
  started_by INT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- SLA tracking
  sla_deadline TIMESTAMP,
  sla_breached BOOLEAN DEFAULT false,
  
  -- Overall context/data for the workflow
  context JSON, -- shared data between stages
  
  -- Metadata
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_sla (sla_deadline, status)
);
```

### workflow_tasks (enhanced)
```sql
CREATE TABLE workflow_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_id INT NOT NULL,
  stage_id INT NOT NULL,
  
  -- Assignment
  assigned_to INT,
  assigned_group VARCHAR(100), -- for parallel approvals
  assignment_method ENUM('direct', 'round_robin', 'least_loaded', 'role_based') DEFAULT 'direct',
  
  -- State
  status ENUM('pending', 'in_progress', 'completed', 'rejected', 'escalated', 'overdue', 'cancelled') DEFAULT 'pending',
  
  -- Timing
  due_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT, -- actual time taken
  
  -- Decision
  decision VARCHAR(100), -- the outcome chosen
  decision_data JSON, -- additional data from the decision
  notes TEXT,
  
  -- For parallel approvals
  required_approvals INT, -- how many approvals needed
  current_approvals INT DEFAULT 0, -- how many received
  
  -- Metadata
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_instance (instance_id),
  INDEX idx_assigned (assigned_to, status),
  INDEX idx_status (status),
  INDEX idx_due (due_at, status)
);
```

### workflow_audit_events (NEW)
```sql
CREATE TABLE workflow_audit_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_id INT NOT NULL,
  task_id INT,
  
  -- What happened
  event_type ENUM('started', 'stage_entered', 'task_created', 'task_completed', 
                   'task_rejected', 'transition', 'escalated', 'completed', 
                   'rejected', 'cancelled', 'paused', 'resumed', 'sla_breached') NOT NULL,
  
  -- Details
  from_stage_id INT,
  to_stage_id INT,
  outcome VARCHAR(100),
  
  -- Actor
  actor_id INT,
  actor_email VARCHAR(320),
  
  -- Snapshot
  before JSON,
  after JSON,
  
  -- Metadata
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_instance (instance_id),
  INDEX idx_created (created_at)
);
```

---

## Transition Logic

### Resolving Next Stage

When a task is completed with an outcome:

1. Look up all transitions from the current stage
2. Filter by conditions (check if they're met)
3. If multiple transitions match, use priority
4. If no transitions match, use the `is_default` transition
5. If no default transition, the workflow ends (or errors)

```typescript
async function resolveNextStage(
  instanceId: number,
  currentStageId: number,
  outcome: string,
  decisionData?: Record<string, unknown>
): Promise<number | null> {
  // 1. Get all transitions from current stage
  const transitions = await db
    .select()
    .from(workflowTransitions)
    .where(eq(workflowTransitions.fromStageId, currentStageId))
    .orderBy(desc(workflowTransitions.priority));
  
  // 2. Find matching transition
  for (const transition of transitions) {
    if (transition.outcome === outcome) {
      // Check conditions
      if (await evaluateConditions(transition.conditions, decisionData)) {
        return transition.toStageId;
      }
    }
  }
  
  // 3. Fallback to default
  const defaultTransition = transitions.find(t => t.is_default);
  return defaultTransition?.toStageId ?? null;
}
```

---

## SLA Management

### SLA Configuration
```typescript
interface SLAConfig {
  deadlineHours: number; // Time limit for the stage/workflow
  escalation: {
    afterHours: number; // When to escalate
    escalateTo: string; // Role or user to escalate to
    action: 'notify' | 'reassign' | 'auto_approve' | 'cancel';
  }[];
  breach: {
    action: 'notify' | 'cancel' | 'escalate';
    notifyRoles: string[];
  };
}
```

### SLA Checking
A background job runs every minute to check for SLA breaches:

```typescript
async function checkSLABreaches(): Promise<void> {
  const now = new Date();
  
  // Find tasks that are overdue
  const overdueTasks = await db
    .select()
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.status, 'pending'),
        lt(workflowTasks.dueAt, now)
      )
    );
  
  for (const task of overdueTasks) {
    // Get the stage's SLA config
    const stage = await getStage(task.stageId);
    const slaConfig = stage.sla_escalation_config as SLAConfig;
    
    // Execute escalation
    await executeEscalation(task, slaConfig);
    
    // Update task status
    await db.update(workflowTasks)
      .set({ status: 'overdue' })
      .where(eq(workflowTasks.id, task.id));
    
    // Log audit event
    await logWorkflowAudit(task.instanceId, 'sla_breached', {
      taskId: task.id,
      stageName: stage.name,
      dueAt: task.dueAt,
    });
  }
}
```

---

## Integration Hooks

### Webhook Configuration
```typescript
interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'hmac';
    credentials: string;
  };
  payload?: {
    includeContext: boolean;
    includeFormData: boolean;
    customFields?: string[];
  };
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}
```

### Trigger Points
- `on_workflow_start` — When a workflow instance is created
- `on_stage_enter` — When a stage is entered
- `on_stage_complete` — When a stage is completed
- `on_transition` — When a transition occurs
- `on_workflow_complete` — When the workflow finishes
- `on_sla_breach` — When an SLA is breached
- `on_escalation` — When an escalation occurs

---

## Migration from v1

### Breaking Changes
1. `nextStageId` on `workflow_stages` is replaced by `workflow_transitions` table
2. `workflows` table is renamed to `workflow_definitions` (or columns added)
3. `config` column on stages may need restructuring

### Migration Steps
1. Create new tables (`workflow_transitions`, `workflow_audit_events`)
2. Migrate existing linear flows to transition records
3. Update `advanceWorkflow` to use transition resolution
4. Add SLA fields to existing tables
5. Update all callers of the workflow API

---

## Usage Examples

### Creating a Membership Approval Workflow
```typescript
const workflow = await createWorkflow({
  name: 'Membership Approval',
  entityType: 'membership_application',
  triggerType: 'event',
  triggerConfig: { event: 'application.submitted' },
  stages: [
    { name: 'Application Review', type: 'review', slaHours: 48 },
    { name: 'LC President Approval', type: 'approval', slaHours: 72 },
    { name: 'Generate Card', type: 'generate_document' },
    { name: 'Send Welcome Email', type: 'notification' },
  ],
  transitions: [
    { from: 'Application Review', outcome: 'approved', to: 'LC President Approval' },
    { from: 'Application Review', outcome: 'rejected', to: null }, // end workflow
    { from: 'LC President Approval', outcome: 'approved', to: 'Generate Card' },
    { from: 'LC President Approval', outcome: 'rejected', to: null },
    { from: 'LC President Approval', outcome: 'needs_revision', to: 'Application Review' },
  ],
});
```

### Advancing a Workflow
```typescript
// Approve the current task
await advanceWorkflow(instanceId, {
  decision: 'approved',
  userId: reviewerId,
  notes: 'Application looks good',
  decisionData: { comments: 'Verified documents' },
});
```
