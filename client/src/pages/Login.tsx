import { trpc } from "@/lib/trpc";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TRPCClientError } from "@trpc/client";
import {
  ExternalLink,
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

/**
 * Member login failure guidance. The server deliberately returns one generic
 * message for every bad credential (never reveals whether an identifier
 * exists), so the hint below is shown for all of them.
 */
const LOGIN_FAILED_MESSAGE =
  "Invalid Membership ID or password. If you haven't set a password yet, " +
  "use the setup link from your email — or request a new one below.";

/**
 * MEMBER sign-in. Officials and the National Office sign in on the separate
 * /official/login pathway (members and officials never share a login form,
 * and the server rejects cross-portal credentials). Accounts are provisioned
 * by the Super Admin — there is no sign-up here.
 */
export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  // Only allow same-origin relative paths as the post-login destination.
  const rawNext = params.get("next") || "";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Request a new setup link" flow (members who never set a password).
  const [resendOpen, setResendOpen] = useState(false);
  const [resendIdentifier, setResendIdentifier] = useState("");
  const [resendNotice, setResendNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Dev-only "create a test member" helper (never rendered in prod builds).
  const [devOpen, setDevOpen] = useState(false);
  const [devId, setDevId] = useState("MSAP-DEV-0001");
  const [devEmail, setDevEmail] = useState("dev.member@example.com");
  const [devName, setDevName] = useState("Dev Test Member");
  const [devSetupUrl, setDevSetupUrl] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate(next);
    },
    onError: (err) => {
      // Distinguish lockout (TOO_MANY_REQUESTS) from every other failure;
      // anything else gets the guidance message.
      const code =
        err instanceof TRPCClientError ? err.data?.code : undefined;
      setError(
        code === "TOO_MANY_REQUESTS"
          ? err.message
          : LOGIN_FAILED_MESSAGE
      );
    },
  });

  const requestSetup = trpc.auth.requestPasswordSetup.useMutation({
    onSuccess: (data) => {
      setError(null); // the login failure is resolved by the fresh link
      setResendNotice({ kind: "success", text: data.message });
    },
    onError: (err) =>
      setResendNotice({ kind: "error", text: err.message }),
  });

  const createTestMember = trpc.auth.devCreateTestMember.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/set-password?token=${data.setupToken}`;
      setDevSetupUrl(url);
      setDevError(null);
      // Pre-fill the login form so the tester can log straight in after setup.
      setIdentifier(data.membershipId ?? "");
    },
    onError: (err) => setDevError(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Please enter your Membership ID/email and password.");
      return;
    }
    login.mutate({ identifier: identifier.trim(), password, portal: "member" });
  };

  const handleResendSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!resendIdentifier.trim()) return;
    setResendNotice(null);
    requestSetup.mutate({ identifier: resendIdentifier.trim() });
  };

  const handleCreateTestMember = (e: FormEvent) => {
    e.preventDefault();
    setDevError(null);
    setDevSetupUrl(null);
    createTestMember.mutate({
      membershipId: devId.trim(),
      email: devEmail.trim(),
      name: devName.trim(),
    });
  };

  return (
    <div className="msap-page min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border border-[#D9E4E1] bg-white shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1B355E_0%,#1B355E_46%,#106E5B_100%)] px-6 py-8 text-center">
            <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[#138A73]/25 blur-2xl" />
            <MSAPLogo variant="horizontal-expanded" tone="white" className="relative z-10 mx-auto w-52" />
          </div>

          <div className="px-6 py-8 sm:px-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1B355E]">
                Member Sign In
              </h1>
              <p className="mt-1.5 text-sm text-[#66788D]">
                Use your Membership ID or email to access your portal.
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-semibold text-[#1B355E]">
                  Membership ID or Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66788D]" />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. MSAP-K1-0042 or you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-[#1B355E]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
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
                className="msap-primary-action h-12 w-full text-white disabled:opacity-60"
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

            {/* Request a new setup link (members who never set a password) */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setResendOpen((v) => !v);
                  setResendNotice(null);
                  setResendIdentifier(identifier);
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
                    Enter your Membership ID or registered email. If it matches an
                    approved member, a fresh single-use setup link is emailed to you.
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66788D]" />
                    <Input
                      type="text"
                      autoComplete="username"
                      placeholder="Membership ID or email"
                      value={resendIdentifier}
                      onChange={(e) => setResendIdentifier(e.target.value)}
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
                    disabled={requestSetup.isPending || !resendIdentifier.trim()}
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
                Newly approved member? Check your email for your{" "}
                <span className="font-semibold text-[#1B355E]">password setup link</span>.
              </p>
              <p className="text-[#5D7086]">
                Not a member yet?{" "}
                <Link
                  href="/membership"
                  className="font-semibold text-[#106E5B] hover:text-[#0B4E40]"
                >
                  Apply for membership
                </Link>
              </p>
              <p className="flex items-center gap-1.5 border-t border-[#E7EFEC] pt-4 text-[#5D7086]">
                <ShieldCheck className="h-4 w-4 text-[#106E5B]" />
                Official or National Office?{" "}
                <Link
                  href="/official/login"
                  className="font-semibold text-[#106E5B] hover:text-[#0B4E40]"
                >
                  Sign in on the Official Portal
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Dev tools: create a test member to exercise setup -> login locally. */}
        {true && (
          <div className="mt-6 rounded-2xl border border-dashed border-[#B9CBC6] bg-white/70 p-4">
            <button
              type="button"
              onClick={() => setDevOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#5D7086]">
                <Wrench className="h-4 w-4" /> Dev tools — test member
              </span>
              <span className="text-xs font-semibold text-[#106E5B]">
                {devOpen ? "Hide" : "Show"}
              </span>
            </button>

            {devOpen && (
              <form onSubmit={handleCreateTestMember} className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dev-id" className="text-xs font-semibold text-[#1B355E]">
                      Membership ID
                    </Label>
                    <Input
                      id="dev-id"
                      value={devId}
                      onChange={(e) => setDevId(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dev-name" className="text-xs font-semibold text-[#1B355E]">
                      Name
                    </Label>
                    <Input
                      id="dev-name"
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-email" className="text-xs font-semibold text-[#1B355E]">
                    Email
                  </Label>
                  <Input
                    id="dev-email"
                    type="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    className="h-10"
                  />
                </div>

                {devError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 py-2.5">
                    <AlertDescription className="text-xs text-red-700">{devError}</AlertDescription>
                  </Alert>
                )}

                {devSetupUrl && (
                  <div className="rounded-xl border border-[#BBD8CF] bg-[#E7F4F0] p-3">
                    <p className="text-xs font-semibold text-[#0B4E40]">
                      Account created. Open the setup link to set a password:
                    </p>
                    <div className="mt-2 flex gap-2">
                      <a
                        href={devSetupUrl}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#106E5B] text-xs font-bold text-white transition-colors hover:bg-[#0B4E40]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open setup link
                      </a>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={createTestMember.isPending}
                  variant="outline"
                  className="h-10 w-full border-[#B9CBC6] text-xs font-semibold text-[#1B355E] disabled:opacity-60"
                >
                  {createTestMember.isPending
                    ? "Creating…"
                    : "Create test member & get setup link"}
                </Button>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[#66788D]">
          Medical Students' Association of Pakistan · Member Portal
        </p>
      </div>
    </div>
  );
}
