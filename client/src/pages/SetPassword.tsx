import { trpc } from "@/lib/trpc";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";

type Strength = 0 | 1 | 2 | 3;

function passwordStrength(password: string): Strength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && password.length >= 10) score += 1;
  return Math.max(1, Math.min(3, score)) as Strength;
}

const STRENGTH_LABELS = ["", "Weak", "Okay", "Strong"] as const;
const STRENGTH_COLORS = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"] as const;

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="msap-page min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function AuthCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#D9E4E1] bg-white shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1B355E_0%,#1B355E_46%,#106E5B_100%)] px-6 py-8 text-center">
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[#138A73]/25 blur-2xl" />
        <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-white backdrop-blur-sm">
          {icon}
        </div>
        <h1 className="relative z-10 mt-5 text-2xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        <div className="relative z-10 mt-2 text-sm text-white/80">{subtitle}</div>
      </div>
      {children && <div className="px-6 py-7 sm:px-8">{children}</div>}
    </div>
  );
}

export default function SetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tokenInfo = trpc.auth.setupTokenInfo.useQuery(
    { token },
    { retry: false, enabled: Boolean(token) }
  );
  const setup = trpc.auth.setupPassword.useMutation({
    onSuccess: async () => {
      setDone(true);
    },
    onError: (err) => {
      setError(err.message || "Could not set your password. Please try again.");
    },
  });

  const strength = useMemo(() => passwordStrength(password), [password]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password should contain at least one letter and one number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setup.mutate({ token, password });
  };

  // --- Success screen -------------------------------------------------------
  if (done) {
    return (
      <AuthShell>
        <AuthCard
          icon={<CheckCircle2 className="h-8 w-8 text-[#A8D8CD]" />}
          title="Password set successfully"
          subtitle="Your member portal account is ready. You have been signed in automatically."
        >
          <Button
            onClick={() => navigate("/dashboard")}
            className="msap-primary-action h-12 w-full text-white"
          >
            Go to My Dashboard
          </Button>
        </AuthCard>
      </AuthShell>
    );
  }

  // --- Missing / invalid token ----------------------------------------------
  if (!token || tokenInfo.isError || (tokenInfo.data && !tokenInfo.data.valid)) {
    return (
      <AuthShell>
        <AuthCard
          icon={<AlertCircle className="h-8 w-8 text-[#F4B8A8]" />}
          title="Link invalid or expired"
          subtitle={
            <span>
              This password setup link is invalid, expired, or has already been used.
              <br />
              Contact your Local Council president or the VPM at{" "}
              <a href="mailto:vpm@msapakistan.org" className="font-semibold text-[#A8D8CD] hover:text-white">
                vpm@msapakistan.org
              </a>{" "}
              to request a new link.
            </span>
          }
        />
      </AuthShell>
    );
  }

  // --- Loading token info ---------------------------------------------------
  if (tokenInfo.isLoading || !tokenInfo.data) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  const { name, membershipId, expiresAt } = tokenInfo.data;

  // --- Password form ---------------------------------------------------------
  return (
    <AuthShell>
      <div className="overflow-hidden rounded-[2rem] border border-[#D9E4E1] bg-white shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1B355E_0%,#1B355E_46%,#106E5B_100%)] px-6 py-8 text-center">
          <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border-[24px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[#138A73]/25 blur-2xl" />
          <MSAPLogo variant="horizontal-expanded" tone="white" className="relative z-10 mx-auto w-52" />
          <h1 className="relative z-10 mt-6 text-2xl font-extrabold tracking-tight text-white">
            Set Up Your Password
          </h1>
          {name && (
            <p className="relative z-10 mt-2 text-sm text-white/80">
              Welcome, <span className="font-semibold text-white">{name}</span>
              {membershipId && (
                <>
                  {" "}
                  · <span className="font-mono text-[#A8D8CD]">{membershipId}</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="px-6 py-7 sm:px-8">
          {error && (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
              <AlertDescription className="text-sm text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-[#1B355E]">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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

              {/* Strength meter */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex flex-1 gap-1.5">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        strength >= level ? STRENGTH_COLORS[strength] : "bg-[#E9F0EE]"
                      }`}
                    />
                  ))}
                </div>
                <span className="w-12 text-right text-xs text-[#66788D]">
                  {strength > 0 ? STRENGTH_LABELS[strength] : ""}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-semibold text-[#1B355E]">
                Confirm Password
              </Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={setup.isPending}
              className="msap-primary-action h-12 w-full text-white disabled:opacity-60"
            >
              {setup.isPending ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" />
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Set My Password
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-4 text-xs leading-5 text-[#5D7086]">
            <p>
              <span className="font-semibold text-[#1B355E]">Security note:</span> MSAP staff will
              never ask for your password. This link is single-use
              {expiresAt && (
                <>
                  {" "}
                  and expires on <span className="font-semibold text-[#1B355E]">
                    {new Date(expiresAt).toLocaleString()}
                  </span>
                </>
              )}
              .
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
