import { afterEach, describe, expect, it } from "vitest";
import {
  buildMailOptions,
  clearMemoryEmailLog,
  getMemoryEmailLog,
  isSmtpConfigured,
  queueEmail,
  sendTestEmail,
  stripHtml,
} from "./emailService";

// Keep SMTP vars deterministic: tests must not depend on the host environment.
const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM_NAME",
  "FROM_EMAIL",
] as const;

function withSmtpConfig(config: Partial<Record<(typeof SMTP_KEYS)[number], string>>) {
  for (const key of SMTP_KEYS) delete process.env[key];
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

afterEach(() => {
  for (const key of SMTP_KEYS) delete process.env[key];
  clearMemoryEmailLog();
});

describe("emailService SMTP configuration", () => {
  it("reports not configured when SMTP_HOST is missing", () => {
    withSmtpConfig({ SMTP_USER: "user", SMTP_PASSWORD: "pass" });
    expect(isSmtpConfigured()).toBe(false);
  });

  it("reports configured when SMTP_HOST is set", () => {
    withSmtpConfig({ SMTP_HOST: "smtp.example.com" });
    expect(isSmtpConfigured()).toBe(true);
  });

  it("builds mail options with sender, HTML and a plain-text fallback", () => {
    withSmtpConfig({
      SMTP_HOST: "smtp.example.com",
      FROM_EMAIL: "vpm@msapakistan.org",
      SMTP_FROM_NAME: "MSA Pakistan",
    });
    const mail = buildMailOptions({
      recipientEmail: "student@example.com",
      subject: "Welcome",
      emailType: "TEST",
      htmlBody: "<h1>Hello</h1><p>Your account is ready.</p>",
    });
    expect(mail.from).toContain("MSA Pakistan");
    expect(mail.from).toContain("vpm@msapakistan.org");
    expect(mail.to).toBe("student@example.com");
    expect(mail.subject).toBe("Welcome");
    expect(mail.html).toContain("<h1>Hello</h1>");
    expect(mail.text).toContain("Hello");
    expect(mail.text).not.toContain("<");
  });

  it("sendTestEmail throws a clear error when SMTP is not configured", async () => {
    withSmtpConfig({});
    await expect(
      sendTestEmail("admin@example.com")
    ).rejects.toThrow(/SMTP is not configured/);
  });
});

describe("emailService queue fallback (no database)", () => {
  it("buffers queued emails in the memory outbox", async () => {
    const id = await queueEmail({
      recipientEmail: "student@example.com",
      subject: "[MSA Pakistan] Set Up Your Member Portal Account",
      emailType: "PASSWORD_SETUP",
      htmlBody: "<p>hi</p>",
    });
    expect(id).not.toBeNull();
    const log = getMemoryEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.subject).toContain("Set Up Your Member Portal Account");
  });
});

describe("stripHtml", () => {
  it("converts HTML to readable text", () => {
    const text = stripHtml(
      "<div><h2>Hello</h2><p>Some &amp; text with&nbsp;spaces</p></div>"
    );
    expect(text).toContain("Hello");
    expect(text).toContain("Some & text with spaces");
    expect(text).not.toContain("<");
  });
});
