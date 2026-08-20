# UI/UX System

## Architecture

### Component Hierarchy
```
App
├── Providers (Auth, Theme, Config, Query)
├── Router
│   ├── Public Routes
│   │   ├── Login
│   │   ├── Register
│   │   └── Public Pages
│   └── Protected Routes
│       ├── Dashboard Layout
│       │   ├── Sidebar Navigation
│       │   ├── Header
│       │   └── Content Area
│       └── Module Pages
│           ├── Membership
│           ├── Elections
│           ├── Plenary
│           ├── Activities
│           ├── Finance
│           └── Admin
└── Modals / Dialogs
```

---

## Theme System

### CSS Variables
```css
:root {
  /* Brand Colors (from config) */
  --color-primary: #1B355E;
  --color-secondary: #2E7D32;
  --color-accent: #FFC107;
  
  /* Neutral Colors */
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-border: #e2e8f0;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  
  /* Status Colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}
```

### Dynamic Theming
Theme is loaded from configuration service on app start:
```typescript
// Apply theme from config
const branding = await getBranding();
document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor);
document.documentElement.style.setProperty('--color-accent', branding.accentColor);
```

---

## Component Library

### Base Components (shadcn/ui)
- Button, Input, Select, Checkbox, Radio
- Dialog, Sheet, Modal
- Table, Card, Badge
- Tabs, Accordion, Collapsible
- Toast, Alert
- Dropdown Menu, Context Menu
- Form (with validation)

### Custom Components
- SignaturePad — Digital signature capture
- PDFViewer — In-browser PDF viewing
- RichTextEditor — WYSIWYG text editing
- FormBuilder — Dynamic form builder
- WorkflowVisualizer — Visual workflow display
- Timeline — Event timeline display
- Avatar, AvatarGroup — User avatars
- StatusBadge — Colored status indicators
- DataTable — Advanced data table with sorting, filtering, pagination

---

## Module Layouts

### Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo · Search · Notifications · Profile         │
├─────────────┬───────────────────────────────────────────┤
│ Sidebar     │ Main Content                              │
│             │                                           │
│ Dashboard   │ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ Members     │ │ Stats   │ │ Stats   │ │ Stats   │     │
│ Elections   │ │ Card 1  │ │ Card 2  │ │ Card 3  │     │
│ Plenary     │ └─────────┘ └─────────┘ └─────────┘     │
│ Activities  │                                           │
│ Finance     │ ┌─────────────────────────────────────┐  │
│ Documents   │ │ Recent Activity / Charts             │  │
│ Settings    │ │                                       │  │
│             │ └─────────────────────────────────────┘  │
│             │                                           │
│             │ ┌─────────────────────────────────────┐  │
│             │ │ Quick Actions / Tasks                │  │
│             │ └─────────────────────────────────────┘  │
└─────────────┴───────────────────────────────────────────┘
```

### Election Module
```
┌─────────────────────────────────────────────────────────┐
│ Elections                                               │
├─────────────────────────────────────────────────────────┤
│ Tabs: Active · Upcoming · Past · Drafts                 │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Election Card                                       │ │
│ │ ┌─────────┐ Title                                    │ │
│ │ │ Status  │ Description                              │ │
│ │ │ Badge   │ Dates: Start - End                       │ │
│ │ └─────────┘ Progress: Nominations → Voting → Results │ │
│ │           [View] [Manage] [Results]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Election Card                                       │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Plenary Module
```
┌─────────────────────────────────────────────────────────┐
│ Plenary Sessions                                        │
├─────────────────────────────────────────────────────────┤
│ Tabs: Upcoming · In Progress · Past · Drafts            │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Session Card                                        │ │
│ │ Title: Annual General Assembly 2025                 │ │
│ │ Date: March 15, 2025                                │ │
│ │ Status: In Progress                                 │ │
│ │                                                     │ │
│ │ Live Dashboard:                                     │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐            │ │
│ │ │ Quorum   │ │ Current  │ │ Speakers │            │ │
│ │ │ 75/100   │ │ Item #3  │ │ 2 waiting│            │ │
│ │ └──────────┘ └──────────┘ └──────────┘            │ │
│ │                                                     │ │
│ │ [Open Dashboard] [View Minutes] [Manage]           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive

### Breakpoints
```css
/* Mobile: < 640px */
/* Tablet: 640px - 1024px */
/* Desktop: > 1024px */
```

### Mobile Adaptations
- Sidebar collapses to hamburger menu
- Tables become card lists
- Forms stack vertically
- Navigation moves to bottom bar
- Touch-friendly controls

---

## Accessibility

### Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode
- Reduced motion support

### Implementation
- Semantic HTML
- ARIA labels
- Focus management
- Color contrast ratios
- Alt text for images
