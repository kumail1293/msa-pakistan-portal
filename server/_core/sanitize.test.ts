import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeUrl, sanitizeHtml, sanitizeCss, sanitizeWidgetSettings } from "./sanitize";
import { sanitizeCsvValue, sanitizeCsvRow, generateCsv } from "./csvSafety";

describe("sanitizeText", () => {
  it("escapes HTML tags", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
  });

  it("escapes double quotes", () => {
    expect(sanitizeText('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(sanitizeText("it's")).toBe("it&#x27;s");
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeText(null as any)).toBe("");
    expect(sanitizeText(undefined as any)).toBe("");
  });

  it("preserves safe text", () => {
    expect(sanitizeText("Hello World 123")).toBe("Hello World 123");
  });
});

describe("sanitizeUrl", () => {
  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows relative URLs", () => {
    expect(sanitizeUrl("/admin/dashboard")).toBe("/admin/dashboard");
  });

  it("allows hash links", () => {
    expect(sanitizeUrl("#section")).toBe("#section");
  });

  it("allows mailto", () => {
    expect(sanitizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
  });

  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert('xss')")).toBe("");
  });

  it("blocks vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox")).toBe("");
  });

  it("blocks data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>alert('xss')</script>")).toBe("");
  });

  it("blocks file: protocol", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBe("");
  });

  it("handles case-insensitive javascript:", () => {
    expect(sanitizeUrl("JavaScript:alert(1)")).toBe("");
  });

  it("handles empty string", () => {
    expect(sanitizeUrl("")).toBe("");
  });
});

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const result = sanitizeHtml("<p>Hello</p><script>alert('xss')</script><p>World</p>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("removes iframe tags", () => {
    const result = sanitizeHtml("<iframe src='evil.com'></iframe>");
    expect(result).not.toContain("<iframe");
  });

  it("removes object tags", () => {
    const result = sanitizeHtml("<object data='evil.swf'></object>");
    expect(result).not.toContain("<object");
  });

  it("removes embed tags", () => {
    const result = sanitizeHtml("<embed src='evil.swf'>");
    expect(result).not.toContain("<embed");
  });

  it("removes event handler attributes", () => {
    const result = sanitizeHtml("<img src='x' onerror='alert(1)'>");
    expect(result).not.toContain("onerror");
  });

  it("removes onclick attributes", () => {
    const result = sanitizeHtml("<div onclick='alert(1)'>Click</div>");
    expect(result).not.toContain("onclick");
  });

  it("blocks javascript: in href", () => {
    const result = sanitizeHtml("<a href='javascript:alert(1)'>Click</a>");
    expect(result).not.toContain("javascript:");
  });

  it("preserves safe HTML", () => {
    const result = sanitizeHtml("<h1>Title</h1><p>Content</p>");
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<p>Content</p>");
  });

  it("removes form tags", () => {
    const result = sanitizeHtml("<form action='evil.com'><input type='submit'></form>");
    expect(result).not.toContain("<form");
  });

  it("removes link tags", () => {
    const result = sanitizeHtml("<link rel='stylesheet' href='evil.css'>");
    expect(result).not.toContain("<link");
  });

  it("removes meta tags", () => {
    const result = sanitizeHtml("<meta http-equiv='refresh' content='0;url=evil.com'>");
    expect(result).not.toContain("<meta");
  });
});

describe("sanitizeCss", () => {
  it("removes expression()", () => {
    expect(sanitizeCss("width: expression(alert('xss'))")).not.toContain("expression");
  });

  it("removes javascript:", () => {
    expect(sanitizeCss("background: url(javascript:alert('xss'))")).not.toContain("javascript:");
  });

  it("removes @import", () => {
    expect(sanitizeCss("@import url('evil.css')")).not.toContain("@import");
  });

  it("preserves safe CSS", () => {
    expect(sanitizeCss("color: red; font-size: 14px;")).toBe("color: red; font-size: 14px;");
  });
});

describe("sanitizeWidgetSettings", () => {
  it("sanitizes text fields", () => {
    const result = sanitizeWidgetSettings({ text: "<script>alert('xss')</script>" });
    expect(result.text).not.toContain("<script>");
  });

  it("sanitizes URL fields", () => {
    const result = sanitizeWidgetSettings({ url: "javascript:alert(1)" });
    expect(result.url).toBe("");
  });

  it("sanitizes HTML/code fields", () => {
    const result = sanitizeWidgetSettings({ code: "<script>alert('xss')</script>" });
    expect(result.code).not.toContain("<script>");
  });

  it("preserves safe settings", () => {
    const result = sanitizeWidgetSettings({ text: "Hello", color: "#1B355E", tag: "h2" });
    expect(result.text).toBe("Hello");
    expect(result.color).toBe("#1B355E");
    expect(result.tag).toBe("h2");
  });

  it("handles nested objects", () => {
    const result = sanitizeWidgetSettings({
      settings: { text: "<script>alert(1)</script>" },
    });
    expect(result.settings.text).not.toContain("<script>");
  });

  it("handles arrays", () => {
    const result = sanitizeWidgetSettings({
      items: ["<script>alert(1)</script>", "safe text"],
    });
    expect(result.items[0]).not.toContain("<script>");
    expect(result.items[1]).toBe("safe text");
  });

  it("handles non-string values", () => {
    const result = sanitizeWidgetSettings({ count: 42, enabled: true, ratio: 0.5 });
    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
    expect(result.ratio).toBe(0.5);
  });
});

describe("sanitizeCsvValue (CSV injection prevention)", () => {
  it("prefixes = with single quote", () => {
    expect(sanitizeCsvValue("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
  });

  it("prefixes + with single quote", () => {
    expect(sanitizeCsvValue("+cmd|'/C calc'!A0")).toBe("'+cmd|'/C calc'!A0");
  });

  it("prefixes - with single quote", () => {
    expect(sanitizeCsvValue("-cmd|'/C calc'!A0")).toBe("'-cmd|'/C calc'!A0");
  });

  it("prefixes @ with single quote", () => {
    expect(sanitizeCsvValue("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("does not prefix safe values", () => {
    expect(sanitizeCsvValue("John Khan")).toBe("John Khan");
    expect(sanitizeCsvValue("2024-01-15")).toBe("2024-01-15");
    expect(sanitizeCsvValue("Active")).toBe("Active");
  });

  it("handles empty values", () => {
    expect(sanitizeCsvValue("")).toBe("");
    expect(sanitizeCsvValue(null)).toBe("");
    expect(sanitizeCsvValue(undefined)).toBe("");
  });

  it("handles tab-prefixed values", () => {
    // Tab triggers DDE; after trim the tab is removed but prefix is added
    expect(sanitizeCsvValue("\tformula")).toBe("'formula");
  });
});

describe("generateCsv", () => {
  it("generates proper CSV with headers and data", () => {
    const csv = generateCsv(["Name", "Email"], [["Ali", "ali@test.com"], ["Ahmed", "ahmed@test.com"]]);
    expect(csv).toContain("Name,Email");
    expect(csv).toContain("Ali,ali@test.com");
    expect(csv).toContain("Ahmed,ahmed@test.com");
  });

  it("sanitizes formula values", () => {
    const csv = generateCsv(["Name"], [["=cmd|'/C calc'!A0"]]);
    expect(csv).toContain("'=cmd|'/C calc'!A0");
  });

  it("escapes values with commas", () => {
    const csv = generateCsv(["Name"], [["Lahore, Punjab"]]);
    expect(csv).toContain("\"Lahore, Punjab\"");
  });

  it("escapes values with quotes", () => {
    const csv = generateCsv(["Name"], [["He said \"hello\""]]);
    expect(csv).toContain("\"He said \"\"hello\"\"\"");
  });
});
