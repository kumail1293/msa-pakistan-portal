import { useAuth } from "@/_core/hooks/useAuth";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileCheck,
  KeyRound,
  LogIn,
  ShieldCheck,
  Sparkles,
  Vote,
} from "lucide-react";
import { useLocation } from "wouter";

const STEPS = [
  {
    icon: FileCheck,
    step: "01",
    title: "Apply for Membership",
    text: "Complete the guided online application form in a few minutes.",
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Get Verified",
    text: "Our team reviews and approves your application, then issues your ID.",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "Sign In & Access",
    text: "Set your password and unlock documents, voting and opportunities.",
  },
];

/**
 * Member portal landing page.
 *
 * This is a member-only portal — public visitors only get the sign-in and
 * membership application entry points. All marketing lives on the dedicated
 * MSAP website.
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen flex flex-col overflow-x-hidden">
      {/* Top bar */}
      <header className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
        <div className="msap-landing-rise flex items-center justify-between rounded-2xl border border-[#D9E4E1] bg-white/85 px-4 py-3 shadow-[0_16px_40px_-32px_rgba(27,53,94,.45)] backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MSAPLogo variant="horizontal-compact" tone="brand" className="w-36 sm:w-44" />
            <span className="hidden rounded-full bg-[#E7F4F0] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#106E5B] sm:inline-block">
              Member Portal
            </span>
          </div>
          {isAuthenticated ? (
            <Button
              onClick={() => navigate("/dashboard")}
              className="msap-primary-action text-white"
            >
              Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/login")}
              variant="outline"
              className="border-[#BFD4CD] text-[#106E5B] hover:bg-[#E7F4F0]"
            >
              <LogIn className="mr-2 h-4 w-4" /> Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <section
          className="msap-hero relative w-full overflow-hidden rounded-[2rem] border border-[#D9E4E1] shadow-[0_36px_100px_-50px_rgba(27,53,94,.55)]"
          aria-label="MSAP Member Portal"
        >
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1B355E_0%,#1B355E_46%,#106E5B_100%)] px-5 py-14 text-center text-white sm:px-10 sm:py-16 lg:py-20">
            {/* Symmetric decorative rings */}
            <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full border-[30px] border-white/10" />
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border-[30px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#138A73]/25 blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full border border-dashed border-white/15 animate-[msapSpin_40s_linear_infinite]" />
            <div className="pointer-events-none absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full border border-dashed border-white/10 animate-[msapSpin_60s_linear_infinite_reverse]" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="msap-landing-rise flex h-20 w-full max-w-md items-center justify-center px-2 sm:h-24" style={{ animationDelay: "0.05s" }}>
                <MSAPLogo
                  variant="horizontal-expanded"
                  tone="white"
                  className="block h-full w-full"
                  style={{ maxHeight: "100%" }}
                />
              </div>

              <p className="msap-landing-rise mt-6 text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#A8D8CD] sm:text-xs" style={{ animationDelay: "0.12s" }}>
                Medical Students' Association of Pakistan
              </p>
              <h1 className="msap-landing-rise mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ animationDelay: "0.18s" }}>
                Member Portal
              </h1>
              <p className="msap-landing-rise mt-4 max-w-xl text-sm leading-7 text-white/80 sm:text-base" style={{ animationDelay: "0.24s" }}>
                Manage your MSAP membership — access documents, participate in
                voting, explore opportunities and track your positions.
              </p>

              {/* Symmetric CTAs */}
              <div className="msap-landing-rise mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row" style={{ animationDelay: "0.3s" }}>
                {isAuthenticated ? (
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="msap-landing-cta bg-[#138A73] px-8 py-6 text-base text-white hover:bg-[#106E5B]"
                  >
                    Open Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => navigate("/login")}
                      className="msap-landing-cta border border-white/30 bg-white/10 px-8 py-6 text-base text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/20"
                    >
                      <LogIn className="mr-2 h-5 w-5" /> Member Sign In
                    </Button>
                    <Button
                      onClick={() => navigate("/membership")}
                      className="msap-landing-cta bg-[#138A73] px-8 py-6 text-base text-white hover:bg-[#106E5B]"
                    >
                      Apply for Membership <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>

              {!isAuthenticated && (
                <p className="msap-landing-rise mt-6 flex items-center gap-2 text-xs font-medium text-white/60" style={{ animationDelay: "0.36s" }}>
                  <Sparkles className="h-3.5 w-3.5 text-[#A8D8CD]" />
                  This portal is reserved for verified MSAP members
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Symmetric steps */}
        <section className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-3" aria-label="How it works">
          {STEPS.map((item, index) => (
            <div
              key={item.step}
              className="msap-card msap-card-hover msap-landing-rise group relative p-6 text-center"
              style={{ animationDelay: `${0.36 + index * 0.09}s` }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1B355E,#138A73)] text-white shadow-[0_14px_30px_-14px_rgba(16,110,91,.6)] transition-transform duration-300 group-hover:-translate-y-1">
                <item.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-[11px] font-extrabold tracking-[0.2em] text-[#106E5B]">
                STEP {item.step}
              </p>
              <h2 className="mt-1.5 text-lg font-bold text-[#1B355E]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5D7086]">{item.text}</p>
            </div>
          ))}
        </section>

        {/* Members-only strip */}
        <div className="msap-landing-rise mt-10 flex items-center justify-center gap-2 rounded-full border border-[#D9E4E1] bg-white/80 px-5 py-2.5 text-center text-xs font-semibold text-[#5D7086] backdrop-blur-sm sm:text-sm" style={{ animationDelay: "0.6s" }}>
          <Vote className="h-4 w-4 text-[#106E5B]" />
          Member-only area — sign in or apply for membership to continue
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D9E4E1] py-6 text-center text-xs text-[#66788D]">
        © {new Date().getFullYear()} Medical Students' Association of Pakistan. All rights reserved.
      </footer>
    </div>
  );
}
