import { trpc } from "@/lib/trpc";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TRPCClientError } from "@trpc/client";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";

/** Official Google "G" mark (four-color). */
function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account:
    "This Google account isn't linked to a provisioned official account. " +
    "Contact the Super Admin to grant you portal access.",
  no_email: "Google didn't return an email address for this account.",
  failed: "Google sign-in failed. Please try again.",
  unconfigured:
    "Google sign-in is not available right now. Use your official email and password.",
};

const LOGIN_FAILED_MESSAGE =
  "Invalid email or password. If you haven't set a password yet, use the " +
  "setup link emailed to you by the Super Admin — or request a new one below.";

/**
 * Official Portal sign-in. SEPARATE pathway from the member login: members use
 * /login, officials (SUPCO, National President, VPs, LC Presidents, admins)
 * use this page. Accounts are provisioned ONLY by the Super Admin — there is
 * no sign-up anywhere. The server rejects member credentials here and official
 * credentials on the member form.
 */
export default function OfficialLogin() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const rawNext = params.get("next") || "";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/official";
  const oauthErrorKey = params.get("oauth_error") || "";
  const oauthError = oauthErrorKey
    ? OAUTH_ERROR_MESSAGES[oauthErrorKey] ?? OAUTH_ERROR_MESSAGES.failed
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendNotice, setResendNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Dev-only "seed a super admin" helper (never rendered in prod builds).
  const [devOpen, setDevOpen] = useState(false);
  const [devEmail, setDevEmail] = useState("superadmin@msapakistan.org");
  const [devName, setDevName] = useState("Super Admin");
  const [devSetupUrl, setDevSetupUrl] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  const oauthLoginUrl = trpc.auth.oAuthLoginUrl.useQuery(
    { next },
    { retry: false, staleTime: 60_000 }
  );
  const oauthUrl = oauthLoginUrl.data?.available ? oauthLoginUrl.data.url : null;

  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(next);
    },
    onError: (err) => {
      const code =
        err instanceof TRPCClientError ? err.data?.code : undefined;
      setError(
        code === "TOO_MANY_REQUESTS" ? err.message : LOGIN_FAILED_MESSAGE
      );
    },
  });

  const requestSetup = trpc.auth.officialRequestSetup.useMutation({
    onSuccess: (data) => {
      setError(null);
      setResendNotice({ kind: "success", text: data.message });
    },
    onError: (err) => setResendNotice({ kind: "error", text: err.message }),
  });

  const createSuperAdmin = trpc.auth.devCreateSuperAdmin.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/set-password?token=${data.setupToken}`;
      setDevSetupUrl(url);
      setDevError(null);
      setEmail(data.email ?? "");
    },
    onError: (err) => setDevError(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your official email and password.");
      return;
    }
    login.mutate({ identifier: email.trim(), password, portal: "official" });
  };

  const handleResendSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendNotice(null);
    requestSetup.mutate({ email: resendEmail.trim() });
  };

  const handleCreateSuperAdmin = (e: FormEvent) => {
    e.preventDefault();
    setDevError(null);
    setDevSetupUrl(null);
    createSuperAdmin.mutate({ email: devEmail.trim(), name: devName.trim() });
  };

  return (
    <div className="msap-page min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border border-[#D9E4E1] bg-white shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0E2547_0%,#1B355E_46%,#106E5B_100%)] px-6 py-8 text-center">
            <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[#138A73]/25 blur-2xl" />
            <MSAPLogo variant="horizontal-expanded" tone="white" className="relative z-10 mx-auto w-52" />
            <div className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" /> Official Portal
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1B355E]">
                Official Sign In
              </h1>
              <p className="mt-1.5 text-sm text-[#66788D]">
                For SUPCO, National Office, Vice Presidents and Local Council
                Presidents. Access is provisioned by the Super Admin only.
              </p>
            </div>

            {(error || oauthError) && (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-700">
                  {error || oauthError}
                </AlertDescription>
              </Alert>
            )}

            {oauthUrl && (
              <div className="mb-6">
                <a
                  href={oauthUrl}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#D9E4E1] bg-white text-sm font-semibold text-[#1B355E] shadow-sm transition-all hover:border-[#B9CBC6] hover:bg-[#F7FAF9] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#106E5B]/40"
                >
                  <GoogleIcon />
                  Sign in with Google
                </a>
                <div className="mt-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-[#9AA9B8]">
                  <span className="h-px flex-1 bg-[#E7EFEC]" />
                  or use your official email
                  <span className="h-px flex-1 bg-[#E7EFEC]" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="official-email" className="text-sm font-semibold text-[#1B355E]">
                  Official Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66788D]" />
                  <Input
                    id="official-email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@msapakistan.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="official-password" className="text-sm font-semibold text-[#1B355E]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="official-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66788D] transition-colors hover:text-[#1B355E]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="h-12 w-full bg-[#1B355E] text-white transition-colors hover:bg-[#294A78] disabled:opacity-60"
              >
                {login.isPending ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Request a fresh setup link (officials who never set a password) */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setResendOpen((v) => !v);
                  setResendNotice(null);
                  setResendEmail(email);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#106E5B] transition-colors hover:text-[#0B4E40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#106E5B]/40 rounded"
              >
                <KeyRound className="h-4 w-4" />
                {resendOpen ? "Hide" : "Forgot password or need a setup link?"}
              </button>

              {resendOpen && (
                <form
                  onSubmit={handleResendSubmit}
                  className="mt-4 space-y-3 rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-4 text-left"
                >
                  <p className="text-xs leading-5 text-[#5D7086]">
                    Enter the email your official account was provisioned with.
                    If it matches, a fresh single-use setup link is emailed to you.
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66788D]" />
                    <Input
                      type="email"
                      autoComplete="username"
                      placeholder="you@msapakistan.org"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                  {resendNotice && (
                    <Alert
                      variant={resendNotice.kind === "error" ? "destructive" : "default"}
                      className={
                        resendNotice.kind === "error"
                          ? "border-red-200 bg-red-50"
                          : "border-[#BBD8CF] bg-[#E7F4F0]"
                      }
                    >
                      <AlertDescription
                        className={`text-xs ${
                          resendNotice.kind === "error"
                            ? "text-red-700"
                            : "text-[#106E5B]"
                        }`}
                      >
                        {resendNotice.text}
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    disabled={requestSetup.isPending || !resendEmail.trim()}
                    variant="secondary"
                    className="h-10 w-full text-[#106E5B] disabled:opacity-60"
                  >
                    {requestSetup.isPending ? "Sending…" : "Email me a new setup link"}
                  </Button>
                </form>
              )}
            </div>

            <div className="mt-6 space-y-3 border-t border-[#E7EFEC] pt-5 text-sm">
              <p className="leading-relaxed text-[#5D7086]">
                Are you a <span className="font-semibold text-[#1B355E]">member</span>?
                <Link
                  href="/login"
                  className="ml-1 font-semibold text-[#106E5B] hover:text-[#0B4E40]"
                >
                  Sign in to the Member Portal
                </Link>
              </p>
              <p className="text-[#5D7086]">
                Don&apos;t have an official account? Contact the{" "}
                <span className="font-semibold text-[#1B355E]">Super Admin</span> —
                there is no public sign-up.
              </p>
            </div>
          </div>
        </div>

        {/* Dev tools: seed a super admin to exercise the official pathway locally. */}
        {true && (
          <div className="mt-6 rounded-2xl border border-dashed border-[#B9CBC6] bg-white/70 p-4">
            <button
              type="button"
              onClick={() => setDevOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#5D7086]">
                <Wrench className="h-4 w-4" /> Dev tools — seed super admin
              </span>
              <span className="text-xs font-semibold text-[#106E5B]">
                {devOpen ? "Hide" : "Show"}
              </span>
            </button>

            {devOpen && (
              <form onSubmit={handleCreateSuperAdmin} className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dev-sa-name" className="text-xs font-semibold text-[#1B355E]">
                      Name
                    </Label>
                    <Input
                      id="dev-sa-name"
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dev-sa-email" className="text-xs font-semibold text-[#1B355E]">
                      Email
                    </Label>
                    <Input
                      id="dev-sa-email"
                      type="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                {devError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 py-2.5">
                    <AlertDescription className="text-xs text-red-700">{devError}</AlertDescription>
                  </Alert>
                )}

                {devSetupUrl && (
                  <div className="rounded-xl border border-[#BBD8CF] bg-[#E7F4F0] p-3">
                    <p className="text-xs font-semibold text-[#0B4E40]">
                      Super admin created. Open the setup link to set a password:
                    </p>
                    <a
                      href={devSetupUrl}
                      className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#1B355E] text-xs font-bold text-white transition-colors hover:bg-[#294A78]"
                    >
                      Open setup link
                    </a>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={createSuperAdmin.isPending}
                  variant="outline"
                  className="h-10 w-full border-[#B9CBC6] text-xs font-semibold text-[#1B355E] disabled:opacity-60"
                >
                  {createSuperAdmin.isPending
                    ? "Creating…"
                    : "Create super admin & get setup link"}
                </Button>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[#66788D]">
          Medical Students' Association of Pakistan · Official Portal
        </p>
      </div>
    </div>
  );
}
