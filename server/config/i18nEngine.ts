/**
 * Internationalization Engine (§140)
 *
 * Supports English, Urdu, and future languages with locale-aware dates,
 * numbers, currencies, time zones, RTL support, and translated templates.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { translations } from "../../drizzle/schema.remaining";

export type Locale = "en" | "ur" | "ar";
export type Namespace = "common" | "governance" | "membership" | "elections" | "plenary" | "activities" | "finance" | "documents" | "admin" | "errors";

// Default translations for English
const DEFAULT_TRANSLATIONS: Record<Locale, Record<Namespace, Record<string, string>>> = {
  en: {
    common: {
      "app.name": "MSA-Pakistan Portal",
      "nav.home": "Home",
      "nav.dashboard": "Dashboard",
      "nav.members": "Members",
      "nav.chapters": "Chapters",
      "nav.activities": "Activities",
      "nav.events": "Events",
      "nav.governance": "Governance",
      "nav.documents": "Documents",
      "nav.admin": "Administration",
      "button.save": "Save",
      "button.cancel": "Cancel",
      "button.submit": "Submit",
      "button.approve": "Approve",
      "button.reject": "Reject",
      "status.active": "Active",
      "status.inactive": "Inactive",
      "status.pending": "Pending",
      "status.approved": "Approved",
      "status.rejected": "Rejected",
    },
    governance: {
      "governance.title": "Governance Transparency",
      "governance.constitution": "Constitution",
      "governance.bylaws": "Bylaws",
      "governance.active_rules": "Active Rules",
      "governance.positions": "Official Positions",
      "governance.nga": "National General Assembly",
      "governance.sga": "Special General Assembly",
      "governance.quorum": "Quorum",
      "governance.voting": "Voting Rights",
      "governance.amendment": "Bylaw Amendment",
    },
    membership: {
      "membership.apply": "Apply for Membership",
      "membership.status": "Membership Status",
      "membership.renew": "Renew Membership",
      "membership.card": "Membership Card",
      "membership.directory": "Member Directory",
    },
    elections: {
      "election.title": "Elections",
      "election.candidates": "Candidates",
      "election.voting": "Cast Your Vote",
      "election.results": "Election Results",
    },
    plenary: {
      "plenary.title": "Plenary Session",
      "plenary.motions": "Motions",
      "plenary.speakers": "Speaker Queue",
      "plenary.voting": "Plenary Voting",
    },
    activities: {
      "activity.title": "Activities",
      "activity.register": "Register",
      "activity.attendance": "Attendance",
      "activity.report": "Activity Report",
    },
    finance: {
      "finance.title": "Finance",
      "finance.budget": "Budget",
      "finance.expenses": "Expenses",
      "finance.transactions": "Transactions",
    },
    documents: {
      "document.title": "Documents",
      "document.policy_library": "Policy Library",
      "document.templates": "Templates",
    },
    admin: {
      "admin.title": "Administration",
      "admin.config": "Configuration",
      "admin.modules": "Platform Modules",
      "admin.audit": "Audit Log",
    },
    errors: {
      "error.not_found": "Not Found",
      "error.unauthorized": "Unauthorized",
      "error.forbidden": "Access Denied",
      "error.server": "Server Error",
    },
  },
  ur: {
    common: {
      "app.name": "ایم ایس اے پاکستان پورٹل",
      "nav.home": "ہوم",
      "nav.dashboard": "ڈیش بورڈ",
      "nav.members": "ممبران",
      "nav.chapters": "باب",
      "nav.activities": "سرگرمیاں",
      "nav.events": "تقریبات",
      "nav.governance": "حکمرانی",
      "nav.documents": "دستاویزات",
      "nav.admin": "انتظامیہ",
      "button.save": "محفوظ کریں",
      "button.cancel": "منسوخ کریں",
      "button.submit": "جمع کرائیں",
      "button.approve": "منظور کریں",
      "button.reject": "مسترد کریں",
      "status.active": "فعال",
      "status.inactive": "غیر فعال",
      "status.pending": "زیر التوا",
      "status.approved": "منظور شدہ",
      "status.rejected": "مسترد شدہ",
    },
    governance: {
      "governance.title": "حکمرانی شفافیت",
      "governance.constitution": "آئین",
      "governance.bylaws": "بائی لاز",
      "governance.active_rules": "فعال قواعد",
      "governance.positions": "عہدے",
      "governance.nga": "قومی جنرل اسمبلی",
      "governance.sga": "خصوصی جنرل اسمبلی",
      "governance.quorum": "کورم",
      "governance.voting": "ووٹنگ کے حقوق",
      "governance.amendment": "بائی لاز میں ترمیم",
    },
    membership: {
      "membership.apply": "ممبرانہ کے لیے درخواست دیں",
      "membership.status": "ممبرانہ کی حیثیت",
      "membership.renew": "ممبرانہ تجدید کریں",
      "membership.card": "ممبرانہ کارڈ",
      "membership.directory": "ممبران ڈائری",
    },
    elections: {
      "election.title": "انتخابات",
      "election.candidates": "امیدواران",
      "election.voting": "وٹ ڈالیں",
      "election.results": "نتائج",
    },
    plenary: {
      "plenary.title": "پلینری سیشن",
      "plenary.motions": "موشنز",
      "plenary.speakers": " Speakers کی فہرست",
      "plenary.voting": "پلینری ووٹنگ",
    },
    activities: {
      "activity.title": "سرگرمیاں",
      "activity.register": "رجسٹر کریں",
      "activity.attendance": "حاضری",
      "activity.report": "سرگرمی رپورٹ",
    },
    finance: {
      "finance.title": "مالیات",
      "finance.budget": "بجٹ",
      "finance.expenses": "اخراجات",
      "finance.transactions": "لین دین",
    },
    documents: {
      "document.title": "دستاویزات",
      "document.policy_library": "پالیسی لائبریری",
      "document.templates": "ٹیمپلیٹس",
    },
    admin: {
      "admin.title": "انتظامیہ",
      "admin.config": "ترتیبات",
      "admin.modules": "پلیٹ فارم ماڈیولز",
      "admin.audit": "آڈٹ لاگ",
    },
    errors: {
      "error.not_found": "نہیں ملا",
      "error.unauthorized": "اجازت نہیں",
      "error.forbidden": " رسائی منع ہے",
      "error.server": "سرور خرابی",
    },
  },
  ar: {
    common: {
      "app.name": "بوابة جمعية طلاب الطب في باكستان",
      "nav.home": "الرئيسية",
      "nav.dashboard": "لوحة التحكم",
      "nav.members": "الأعضاء",
      "nav.chapters": "الفصول",
      "nav.activities": "الأنشطة",
      "nav.events": "الفعاليات",
      "nav.governance": "الحوكمة",
      "nav.documents": "الوثائق",
      "nav.admin": "الإدارة",
      "button.save": "حفظ",
      "button.cancel": "إلغاء",
      "button.submit": "إرسال",
      "button.approve": "موافقة",
      "button.reject": "رفض",
      "status.active": "نشط",
      "status.inactive": "غير نشط",
      "status.pending": "قيد الانتظار",
      "status.approved": "موافق عليه",
      "status.rejected": "مرفوض",
    },
    governance: {
      "governance.title": "الشفافية الإدارية",
      "governance.constitution": "الدستور",
      "governance.bylaws": "القانون الداخلي",
      "governance.active_rules": "القواعد النشطة",
      "governance.positions": " المناصب",
      "governance.nga": "الجمعية العامة الوطنية",
      "governance.sga": "الجمعية العامة الخاصة",
      "governance.quorum": "النصاب",
      "governance.voting": "حقوق التصويت",
      "governance.amendment": "تعديل القانون الداخلي",
    },
    membership: {
      "membership.apply": "التقديم للعضوية",
      "membership.status": "حالة العضوية",
      "membership.renew": "تجديد العضوية",
      "membership.card": "بطاقة العضوية",
      "membership.directory": "دليل الأعضاء",
    },
    elections: {
      "election.title": "الانتخابات",
      "election.candidates": "المرشحون",
      "election.voting": "صوّت",
      "election.results": "النتائج",
    },
    plenary: {
      "plenary.title": "الجلسة العامة",
      "plenary.motions": "الاقتراحات",
      "plenary.speakers": "قائمة المتحدثين",
      "plenary.voting": "التصويت العام",
    },
    activities: {
      "activity.title": "الأنشطة",
      "activity.register": "تسجيل",
      "activity.attendance": "الحضور",
      "activity.report": "تقرير النشاط",
    },
    finance: {
      "finance.title": "المالية",
      "finance.budget": "الميزانية",
      "finance.expenses": "المصروفات",
      "finance.transactions": "المعاملات",
    },
    documents: {
      "document.title": "الوثائق",
      "document.policy_library": "مكتبة السياسات",
      "document.templates": "القوالب",
    },
    admin: {
      "admin.title": "الإدارة",
      "admin.config": "الإعدادات",
      "admin.modules": "وحدات المنصة",
      "admin.audit": "سجل التدقيق",
    },
    errors: {
      "error.not_found": "غير موجود",
      "error.unauthorized": "غير مصرح",
      "error.forbidden": "الوصول ممنوع",
      "error.server": "خطأ في الخادم",
    },
  },
};

// ============================================================================
// i18n Engine
// ============================================================================

export const i18nEngine = {
  /** Get a translation by key. */
  translate: (key: string, locale: Locale = "en", namespace: Namespace = "common"): string => {
    const localeTranslations = DEFAULT_TRANSLATIONS[locale] ?? DEFAULT_TRANSLATIONS.en;
    const namespaceTranslations = localeTranslations[namespace] ?? {};
    return namespaceTranslations[key] ?? DEFAULT_TRANSLATIONS.en[namespace]?.[key] ?? key;
  },

  /** Get all translations for a locale and namespace. */
  getTranslations: async (locale: Locale, namespace?: Namespace): Promise<Record<string, string>> => {
    const db = getDb();
    const result: Record<string, string> = {};

    // Start with defaults
    const localeDefaults = DEFAULT_TRANSLATIONS[locale] ?? DEFAULT_TRANSLATIONS.en;
    if (namespace) {
      Object.assign(result, localeDefaults[namespace] ?? {});
    } else {
      for (const ns of Object.keys(localeDefaults) as Namespace[]) {
        Object.assign(result, localeDefaults[ns] ?? {});
      }
    }

    // Override with DB translations
    try {
      if (!db) return result;
      const conditions = [eq(translations.locale, locale)];
      if (namespace) conditions.push(eq(translations.namespace, namespace));
      const dbTranslations = await db.select().from(translations).where(and(...conditions));
      for (const t of dbTranslations) {
        result[t.key] = t.value;
      }
    } catch { /* DB not available, use defaults */ }

    return result;
  },

  /** Set a translation (admin function). */
  setTranslation: async (locale: Locale, namespace: Namespace, key: string, value: string, userId?: string) => {
    const db = getDb();
    if (!db) return { success: false, error: "Database not available" };
    try {
      const existing = await db.select().from(translations)
        .where(and(eq(translations.locale, locale), eq(translations.namespace, namespace), eq(translations.key, key)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(translations).set({ value, updatedAt: new Date() })
          .where(eq(translations.id, existing[0].id));
      } else {
        await db.insert(translations).values({ locale, namespace, key, value });
      }
      return { success: true };
    } catch { return { success: false, error: "Database not available" }; }
  },

  /** Bulk set translations. */
  bulkSetTranslations: async (locale: Locale, namespace: Namespace, entries: Record<string, string>, userId?: string) => {
    const db = getDb();
    if (!db) return { success: false, count: 0 };
    const results = [];
    for (const [key, value] of Object.entries(entries)) {
      results.push(await i18nEngine.setTranslation(locale, namespace, key, value, userId));
    }
    return { success: results.every(r => r.success), count: results.filter(r => r.success).length };
  },

  /** Format date for locale. */
  formatDate: (date: Date, locale: Locale = "en", options?: Intl.DateTimeFormatOptions): string => {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric", month: "long", day: "numeric",
      ...options,
    };
    try {
      const localeMap: Record<Locale, string> = { en: "en-US", ur: "ur-PK", ar: "ar-SA" };
      return new Intl.DateTimeFormat(localeMap[locale], defaultOptions).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  },

  /** Format number for locale. */
  formatNumber: (num: number, locale: Locale = "en", options?: Intl.NumberFormatOptions): string => {
    try {
      const localeMap: Record<Locale, string> = { en: "en-US", ur: "ur-PK", ar: "ar-SA" };
      return new Intl.NumberFormat(localeMap[locale], options).format(num);
    } catch {
      return num.toString();
    }
  },

  /** Format currency for locale. */
  formatCurrency: (amount: number, currency: string = "PKR", locale: Locale = "en"): string => {
    return i18nEngine.formatNumber(amount, locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  },

  /** Get RTL direction for locale. */
  getDirection: (locale: Locale): "ltr" | "rtl" => {
    return locale === "en" ? "ltr" : "rtl";
  },

  /** Get all supported locales. */
  getSupportedLocales: (): Locale[] => ["en", "ur", "ar"],

  /** Get locale display name. */
  getLocaleName: (locale: Locale): string => {
    const names: Record<Locale, string> = { en: "English", ur: "اردو", ar: "العربية" };
    return names[locale] ?? locale;
  },

  /** Get translation coverage for a locale. */
  getTranslationCoverage: async (locale: Locale): Promise<{ total: number; translated: number; percentage: number }> => {
    const db = getDb();
    try {
      if (!db) return { total: 0, translated: 0, percentage: 0 };
      // Count English keys as total
      const enTranslations = DEFAULT_TRANSLATIONS.en;
      let totalEn = 0;
      for (const ns of Object.keys(enTranslations) as Namespace[]) {
        totalEn += Object.keys(enTranslations[ns] ?? {}).length;
      }

      const [count] = await db.select({ count: translations.id }).from(translations).where(eq(translations.locale, locale));

      return {
        total: totalEn,
        translated: count?.count ?? 0,
        percentage: totalEn > 0 ? Math.round(((count?.count ?? 0) / totalEn) * 100) : 0,
      };
    } catch { return { total: 0, translated: 0, percentage: 0 }; }
  },
};

export default i18nEngine;
