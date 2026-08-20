/**
 * Public Landing Page — Sell the portal to other organizations
 *
 * WordPress-like marketing page with features, pricing, testimonials,
 * and organization sign-up CTA.
 */

import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Globe,
  Lock,
  Shield,
  Sparkles,
  Users,
  Zap,
  FileText,
  Calendar,
  Vote,
  BarChart3,
  Settings,
  Bell,
  CreditCard,
  Building,
} from "lucide-react";

const FEATURES = [
  { icon: Users, title: "Member Management", desc: "Complete member lifecycle — applications, cards, onboarding, directory" },
  { icon: Shield, title: "Governance Engine", desc: "Constitution, bylaws, rules engine — all configurable, not hardcoded" },
  { icon: Vote, title: "Elections & Voting", desc: "Secret ballots, weighted voting, eligibility, results certification" },
  { icon: FileText, title: "Document Management", desc: "Version control, approval workflows, policy library, retention" },
  { icon: Calendar, title: "Events & Activities", desc: "Conferences, workshops, NEF/NRF, check-in, certificates" },
  { icon: BarChart3, title: "Analytics & Reports", desc: "Dashboards, KPIs, member engagement, financial reporting" },
  { icon: Bell, title: "Notifications", desc: "Multi-channel: in-app, email, SMS, push. Templates and queues" },
  { icon: Settings, title: "Fully Configurable", desc: "Positions, terminology, workflows, forms — change without code" },
  { icon: Globe, title: "Multi-Language", desc: "English, Urdu, Arabic and more. RTL support built in" },
  { icon: Lock, title: "Enterprise Security", desc: "RBAC, MFA, audit trails, impersonation, compliance" },
  { icon: CreditCard, title: "Digital Credentials", desc: "CR80 membership cards, QR verification, PDF export" },
  { icon: Zap, title: "API Platform", desc: "REST API, webhooks, integrations with your existing systems" },
];

const STEPS = [
  { num: "01", title: "Sign Up", desc: "Create your organization account in 2 minutes" },
  { num: "02", title: "Configure", desc: "Set up branding, modules, and governance rules" },
  { num: "03", title: "Import", desc: "Bulk import your members, chapters, and data" },
  { num: "04", title: "Launch", desc: "Go live with your branded portal in under a week" },
];

const TESTIMONIALS = [
  {
    quote: "This platform replaced 5 different tools we were using. The governance engine alone saved us hundreds of hours.",
    name: "MSA Pakistan",
    role: "National Organization",
  },
  {
    quote: "Finally, a management system built for medical student organizations. The election and plenary features are exactly what we needed.",
    name: "IFMSA Member",
    role: "International Federation",
  },
];

export default function PublicLanding() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen overflow-hidden">
      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-50 border-b border-[#D9E4E1] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <MSAPLogo variant="horizontal-compact" tone="brand" className="w-36 sm:w-40" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")} className="text-sm text-[#5D7086] hover:text-[#1B355E]">
              Sign In
            </Button>
            <Button onClick={() => navigate("/membership")} className="bg-[#138A73] text-white hover:bg-[#106E5B] text-sm">
              Get Started Free <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0C1A33_0%,#1B355E_40%,#0E5D4D_100%)] px-4 py-20 text-center text-white sm:px-6 sm:py-28">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full border-[40px] border-white/5" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border-[40px] border-white/5" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#138A73]/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <Badge className="mb-6 border-white/20 bg-white/10 text-[#A8D8CD] text-xs">
            <Sparkles className="mr-1.5 h-3 w-3" /> Open-Source Governance Platform
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            The WordPress of
            <br />
            <span className="bg-gradient-to-r from-[#A8D8CD] via-[#138A73] to-[#C9A227] bg-clip-text text-transparent">
              Organizational Management
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            A world-class, configurable portal for memberships, governance, elections,
            plenary, finance, and operations. Set up your organization in minutes,
            not months. No coding required.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => navigate("/membership")}
              className="bg-[#138A73] px-8 py-6 text-base font-semibold text-white hover:bg-[#106E5B] shadow-lg shadow-[#138A73]/30"
            >
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white hover:border-white/40 hover:bg-white/10"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See All Features
            </Button>
          </div>
          <p className="mt-6 text-sm text-white/50">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#106E5B]">How it works</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
              Live in 4 simple steps
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="relative rounded-2xl border border-[#D9E4E1] bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1B355E,#138A73)] text-xl font-extrabold text-white shadow-lg shadow-[#138A73]/20">
                  {step.num}
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#1B355E]">{step.title}</h3>
                <p className="mt-2 text-sm text-[#5D7086]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="bg-[#F6F9F8] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#106E5B]">Everything you need</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
              Built for organizations that mean business
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#5D7086]">
              Every feature is configurable through the admin panel. Change positions, workflows,
              governance rules, and terminology without writing code.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feat) => (
              <Card key={feat.title} className="group border-[#D9E4E1] bg-white transition-all hover:border-[#138A73]/30 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F4F0] text-[#106E5B] transition-colors group-hover:bg-[#138A73] group-hover:text-white">
                    <feat.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#1B355E]">{feat.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5D7086]">{feat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#106E5B]">Simple pricing</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
              Choose the plan that fits
            </h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {/* Starter */}
            <div className="rounded-2xl border border-[#D9E4E1] bg-white p-8">
              <h3 className="text-xl font-bold text-[#1B355E]">Starter</h3>
              <p className="mt-2 text-sm text-[#5D7086]">For small local councils</p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-[#1B355E]">Free</span>
                <span className="ml-1 text-sm text-[#5D7086]">forever</span>
              </div>
              <ul className="mt-6 space-y-3">
                {["Up to 100 members", "Basic governance", "Events & documents", "Email support", "5 GB storage"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#42566E]">
                    <Check className="h-4 w-4 shrink-0 text-[#138A73]" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/membership")}
                className="mt-8 w-full border border-[#1B355E] bg-white text-[#1B355E] hover:bg-[#F0F5F3]"
              >
                Get Started Free
              </Button>
            </div>

            {/* Professional */}
            <div className="relative rounded-2xl border-2 border-[#138A73] bg-white p-8 shadow-lg">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#138A73] text-white">Most Popular</Badge>
              <h3 className="text-xl font-bold text-[#1B355E]">Professional</h3>
              <p className="mt-2 text-sm text-[#5D7086]">For national organizations</p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-[#1B355E]">PKR 15,000</span>
                <span className="ml-1 text-sm text-[#5D7086]">/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Up to 5,000 members",
                  "Full governance engine",
                  "Elections & plenary",
                  "Finance & analytics",
                  "Priority support",
                  "Custom branding",
                  "API access",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#42566E]">
                    <Check className="h-4 w-4 shrink-0 text-[#138A73]" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/membership")}
                className="mt-8 w-full bg-[#138A73] text-white hover:bg-[#106E5B]"
              >
                Start 14-Day Trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-[#D9E4E1] bg-white p-8">
              <h3 className="text-xl font-bold text-[#1B355E]">Enterprise</h3>
              <p className="mt-2 text-sm text-[#5D7086]">For large federations</p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-[#1B355E]">PKR 45,000</span>
                <span className="ml-1 text-sm text-[#5D7086]">/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Unlimited members",
                  "Everything in Professional",
                  "White-label branding",
                  "Custom integrations",
                  "Dedicated support",
                  "SLA 99.9%",
                  "Training & onboarding",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#42566E]">
                    <Check className="h-4 w-4 shrink-0 text-[#138A73]" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/membership")}
                className="mt-8 w-full border border-[#1B355E] bg-white text-[#1B355E] hover:bg-[#F0F5F3]"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section className="bg-[#F6F9F8] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#106E5B]">Trusted by organizations</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B355E]">What they say</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="border-[#D9E4E1] bg-white">
                <CardContent className="p-8">
                  <p className="text-base italic leading-relaxed text-[#42566E]">"{t.quote}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7F4F0] text-sm font-bold text-[#106E5B]">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1B355E]">{t.name}</p>
                      <p className="text-xs text-[#5D7086]">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="bg-[linear-gradient(135deg,#1B355E_0%,#0E5D4D_100%)] px-4 py-20 text-center text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to modernize your organization?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Join organizations already using the platform. Set up in minutes, not months.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => navigate("/membership")}
              className="bg-[#138A73] px-8 py-6 text-base font-semibold text-white hover:bg-[#106E5B] shadow-lg"
            >
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white hover:border-white/40 hover:bg-white/10"
              onClick={() => navigate("/governance")}
            >
              Explore Governance Features
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-[#D9E4E1] bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <MSAPLogo variant="horizontal-compact" tone="brand" className="w-32" />
              <p className="mt-3 text-sm text-[#5D7086]">World-class organizational management platform.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1B355E]">Product</h4>
              <ul className="mt-3 space-y-2">
                {["Features", "Pricing", "Governance", "API Docs"].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#5D7086] hover:text-[#106E5B]">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1B355E]">Organization</h4>
              <ul className="mt-3 space-y-2">
                {["About", "Blog", "Careers", "Contact"].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#5D7086] hover:text-[#106E5B]">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1B355E]">Support</h4>
              <ul className="mt-3 space-y-2">
                {["Documentation", "Help Center", "Status", "Security"].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#5D7086] hover:text-[#106E5B]">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#D9E4E1] pt-8 sm:flex-row">
            <p className="text-xs text-[#8A9BAE]">© {new Date().getFullYear()} MSA Portal. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-xs text-[#8A9BAE] hover:text-[#106E5B]">Privacy</a>
              <a href="#" className="text-xs text-[#8A9BAE] hover:text-[#106E5B]">Terms</a>
              <a href="#" className="text-xs text-[#8A9BAE] hover:text-[#106E5B]">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
