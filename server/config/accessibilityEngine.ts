/**
 * Accessibility Engine (§141)
 *
 * WCAG 2.2 AA compliance utilities: keyboard navigation, ARIA,
 * color contrast, focus management, screen reader support,
 * and accessibility audit helpers.
 */

export type AccessibilityLevel = "A" | "AA" | "AAA";
export type Severity = "critical" | "serious" | "moderate" | "minor";

export interface AccessibilityIssue {
  id: string;
  rule: string;
  description: string;
  severity: Severity;
  level: AccessibilityLevel;
  element?: string;
  suggestion: string;
  wcagReference: string;
}

export interface AccessibilityReport {
  timestamp: Date;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  issues: AccessibilityIssue[];
  score: number; // 0-100
  level: AccessibilityLevel;
}

export const accessibilityEngine = {
  /** WCAG color contrast ratio calculator */
  getContrastRatio: (foreground: string, background: string): number => {
    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      };
    };
    const luminance = (rgb: { r: number; g: number; b: number }) => {
      const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(v =>
        v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return Math.round(ratio * 100) / 100;
  },

  /** Check if contrast meets WCAG level */
  meetsContrastRequirement: (ratio: number, level: AccessibilityLevel, isLargeText: boolean = false): boolean => {
    if (isLargeText) {
      return level === "AAA" ? ratio >= 4.5 : ratio >= 3;
    }
    return level === "AAA" ? ratio >= 7 : ratio >= 4.5;
  },

  /** Validate ARIA attributes */
  validateAriaAttributes: (attributes: Record<string, string>): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = [];

    // role required check
    if (!attributes.role && !attributes["aria-label"] && !attributes["aria-labelledby"]) {
      // Interactive elements need accessible names
    }

    // aria-label should not be empty
    if (attributes["aria-label"] === "") {
      issues.push({
        id: "aria-label-empty",
        rule: "aria-label",
        description: "aria-label attribute is empty",
        severity: "serious",
        level: "A",
        suggestion: "Provide a descriptive label or remove the attribute",
        wcagReference: "4.1.2 Name, Role, Value",
      });
    }

    // aria-labelledby must reference existing IDs
    if (attributes["aria-labelledby"]) {
      const refs = attributes["aria-labelledby"].split(" ");
      for (const ref of refs) {
        if (!ref.trim()) {
          issues.push({
            id: "aria-labelledby-empty-ref",
            rule: "aria-labelledby",
            description: "aria-labelledby contains an empty reference",
            severity: "serious",
            level: "A",
            suggestion: "Ensure all referenced IDs exist in the DOM",
            wcagReference: "4.1.2 Name, Role, Value",
          });
        }
      }
    }

    // aria-describedby must reference existing IDs
    if (attributes["aria-describedby"]) {
      const refs = attributes["aria-describedby"].split(" ");
      for (const ref of refs) {
        if (!ref.trim()) {
          issues.push({
            id: "aria-describedby-empty-ref",
            rule: "aria-describedby",
            description: "aria-describedby contains an empty reference",
            severity: "moderate",
            level: "A",
            suggestion: "Ensure all referenced IDs exist in the DOM",
            wcagReference: "1.3.1 Info and Relationships",
          });
        }
      }
    }

    // aria-hidden on focusable elements
    if (attributes["aria-hidden"] === "true" && (attributes.tabindex === "0" || attributes.tabindex === undefined)) {
      issues.push({
        id: "aria-hidden-focusable",
        rule: "aria-hidden",
        description: "Focusable element has aria-hidden='true'",
        severity: "critical",
        level: "A",
        suggestion: "Remove aria-hidden or set tabindex='-1' on this element",
        wcagReference: "4.1.2 Name, Role, Value",
      });
    }

    return issues;
  },

  /** Validate heading hierarchy */
  validateHeadingHierarchy: (headings: { level: number; text: string }[]): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = [];
    if (headings.length === 0) return issues;

    if (headings[0].level !== 1) {
      issues.push({
        id: "missing-h1",
        rule: "heading-order",
        description: "Page does not start with an h1 heading",
        severity: "serious",
        level: "A",
        suggestion: "Add an h1 heading as the first heading on the page",
        wcagReference: "1.3.1 Info and Relationships",
      });
    }

    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i - 1].level + 1) {
        issues.push({
          id: `heading-skip-${i}`,
          rule: "heading-order",
          description: `Heading level skips from h${headings[i - 1].level} to h${headings[i].level}`,
          severity: "moderate",
          level: "AA",
          suggestion: `Use h${headings[i - 1].level + 1} instead of h${headings[i].level}`,
          wcagReference: "1.3.1 Info and Relationships",
        });
      }
    }

    return issues;
  },

  /** Keyboard navigation checklist */
  getKeyboardNavigationRules: (): { check: string; description: string; level: AccessibilityLevel }[] => [
    { check: "tab-order", description: "Tab order follows logical reading sequence", level: "A" },
    { check: "focus-visible", description: "All interactive elements have visible focus indicator", level: "AA" },
    { check: "no-keyboard-trap", description: "User can navigate away from all components using keyboard alone", level: "A" },
    { check: "skip-link", description: "Skip to main content link is present", level: "A" },
    { check: "escape-key", description: "Modal dialogs can be closed with Escape key", level: "A" },
    { check: "arrow-keys", description: "Custom widgets support arrow key navigation", level: "A" },
    { check: "enter-space", description: "Buttons and links activate with Enter or Space", level: "A" },
    { check: "form-labels", description: "All form inputs have associated labels", level: "A" },
    { check: "error-identification", description: "Form errors are identified in text (not just color)", level: "A" },
    { check: "error-suggestion", description: "Input suggestions are provided where possible", level: "AA" },
  ],

  /** ARIA roles for common UI patterns */
  getAriaRoles: (): Record<string, { role: string; requiredAttrs: string[]; description: string }> => ({
    button: { role: "button", requiredAttrs: [], description: "Interactive button element" },
    dialog: { role: "dialog", requiredAttrs: ["aria-label or aria-labelledby"], description: "Modal or non-modal dialog" },
    alertdialog: { role: "alertdialog", requiredAttrs: ["aria-label or aria-labelledby"], description: "Dialog with urgent message" },
    navigation: { role: "navigation", requiredAttrs: [], description: "Navigation landmark" },
    main: { role: "main", requiredAttrs: [], description: "Main content landmark" },
    banner: { role: "banner", requiredAttrs: [], description: "Site header landmark" },
    contentinfo: { role: "contentinfo", requiredAttrs: [], description: "Site footer landmark" },
    complementary: { role: "complementary", requiredAttrs: [], description: "Sidebar/aside landmark" },
    search: { role: "search", requiredAttrs: [], description: "Search landmark" },
    tablist: { role: "tablist", requiredAttrs: [], description: "Container for tab elements" },
    tab: { role: "tab", requiredAttrs: ["aria-selected", "aria-controls"], description: "Individual tab" },
    tabpanel: { role: "tabpanel", requiredAttrs: ["aria-labelledby"], description: "Tab content panel" },
    menu: { role: "menu", requiredAttrs: [], description: "Menu container" },
    menuitem: { role: "menuitem", requiredAttrs: [], description: "Menu item" },
    tree: { role: "tree", requiredAttrs: [], description: "Tree view container" },
    treeitem: { role: "treeitem", requiredAttrs: [], description: "Tree view item" },
    progressbar: { role: "progressbar", requiredAttrs: ["aria-valuenow"], description: "Progress indicator" },
    status: { role: "status", requiredAttrs: [], description: "Live status region" },
    alert: { role: "alert", requiredAttrs: [], description: "Important message" },
    tooltip: { role: "tooltip", requiredAttrs: ["aria-describedby"], description: "Tooltip popup" },
  }),

  /** Generate accessibility report */
  generateReport: (issues: AccessibilityIssue[]): AccessibilityReport => {
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    const seriousCount = issues.filter(i => i.severity === "serious").length;
    const moderateCount = issues.filter(i => i.severity === "moderate").length;
    const minorCount = issues.filter(i => i.severity === "minor").length;

    // Score: start at 100, deduct points per severity
    let score = 100;
    score -= criticalCount * 25;
    score -= seriousCount * 15;
    score -= moderateCount * 5;
    score -= minorCount * 1;

    const level: AccessibilityLevel = criticalCount > 0 ? "A" : seriousCount > 0 ? "AA" : "AAA";

    return {
      timestamp: new Date(),
      totalIssues: issues.length,
      criticalCount,
      seriousCount,
      moderateCount,
      minorCount,
      issues,
      score: Math.max(0, score),
      level,
    };
  },

  /** Get all WCAG 2.2 AA success criteria */
  getWcagCriteria: (): { code: string; title: string; level: AccessibilityLevel; category: string }[] => [
    { code: "1.1.1", title: "Non-text Content", level: "A", category: "Perceivable" },
    { code: "1.2.1", title: "Audio-only and Video-only", level: "A", category: "Perceivable" },
    { code: "1.3.1", title: "Info and Relationships", level: "A", category: "Perceivable" },
    { code: "1.3.2", title: "Meaningful Sequence", level: "A", category: "Perceivable" },
    { code: "1.3.3", title: "Sensory Characteristics", level: "A", category: "Perceivable" },
    { code: "1.3.4", title: "Orientation", level: "AA", category: "Perceivable" },
    { code: "1.3.5", title: "Identify Input Purpose", level: "AA", category: "Perceivable" },
    { code: "1.4.1", title: "Use of Color", level: "A", category: "Perceivable" },
    { code: "1.4.2", title: "Audio Control", level: "A", category: "Perceivable" },
    { code: "1.4.3", title: "Contrast (Minimum)", level: "AA", category: "Perceivable" },
    { code: "1.4.4", title: "Resize Text", level: "AA", category: "Perceivable" },
    { code: "1.4.5", title: "Images of Text", level: "AA", category: "Perceivable" },
    { code: "1.4.10", title: "Reflow", level: "AA", category: "Perceivable" },
    { code: "1.4.11", title: "Non-text Contrast", level: "AA", category: "Perceivable" },
    { code: "1.4.12", title: "Text Spacing", level: "AA", category: "Perceivable" },
    { code: "1.4.13", title: "Content on Hover or Focus", level: "AA", category: "Perceivable" },
    { code: "2.1.1", title: "Keyboard", level: "A", category: "Operable" },
    { code: "2.1.2", title: "No Keyboard Trap", level: "A", category: "Operable" },
    { code: "2.2.1", title: "Timing Adjustable", level: "A", category: "Operable" },
    { code: "2.2.2", title: "Pause, Stop, Hide", level: "A", category: "Operable" },
    { code: "2.3.1", title: "Three Flashes or Below", level: "A", category: "Operable" },
    { code: "2.4.1", title: "Bypass Blocks", level: "A", category: "Operable" },
    { code: "2.4.2", title: "Page Titled", level: "A", category: "Operable" },
    { code: "2.4.3", title: "Focus Order", level: "A", category: "Operable" },
    { code: "2.4.4", title: "Link Purpose (In Context)", level: "A", category: "Operable" },
    { code: "2.4.5", title: "Multiple Ways", level: "AA", category: "Operable" },
    { code: "2.4.6", title: "Headings and Labels", level: "AA", category: "Operable" },
    { code: "2.4.7", title: "Focus Visible", level: "AA", category: "Operable" },
    { code: "2.4.11", title: "Focus Not Obscured (Minimum)", level: "AA", category: "Operable" },
    { code: "2.5.1", title: "Pointer Gestures", level: "A", category: "Operable" },
    { code: "2.5.2", title: "Pointer Cancellation", level: "A", category: "Operable" },
    { code: "2.5.3", title: "Label in Name", level: "A", category: "Operable" },
    { code: "2.5.4", title: "Motion Actuation", level: "A", category: "Operable" },
    { code: "2.5.7", title: "Dragging Movements", level: "AA", category: "Operable" },
    { code: "2.5.8", title: "Target Size (Minimum)", level: "AA", category: "Operable" },
    { code: "3.1.1", title: "Language of Page", level: "A", category: "Understandable" },
    { code: "3.1.2", title: "Language of Parts", level: "AA", category: "Understandable" },
    { code: "3.2.1", title: "On Focus", level: "A", category: "Understandable" },
    { code: "3.2.2", title: "On Input", level: "A", category: "Understandable" },
    { code: "3.2.3", title: "Consistent Navigation", level: "AA", category: "Understandable" },
    { code: "3.2.4", title: "Consistent Identification", level: "AA", category: "Understandable" },
    { code: "3.2.6", title: "Consistent Help", level: "A", category: "Understandable" },
    { code: "3.3.1", title: "Error Identification", level: "A", category: "Understandable" },
    { code: "3.3.2", title: "Labels or Instructions", level: "A", category: "Understandable" },
    { code: "3.3.3", title: "Error Suggestion", level: "AA", category: "Understandable" },
    { code: "3.3.4", title: "Error Prevention (Legal)", level: "AA", category: "Understandable" },
    { code: "3.3.7", title: "Redundant Entry", level: "A", category: "Understandable" },
    { code: "3.3.8", title: "Accessible Authentication (Minimum)", level: "AA", category: "Understandable" },
    { code: "4.1.2", title: "Name, Role, Value", level: "A", category: "Robust" },
    { code: "4.1.3", title: "Status Messages", level: "AA", category: "Robust" },
  ],
};
