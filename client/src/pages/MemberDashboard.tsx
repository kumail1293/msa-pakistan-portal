import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  Phone,
  Users,
  Wallet,
} from "lucide-react";
import { useLocation } from "wouter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function initialsOf(name: string | null | undefined): string {
  if (!name) return "M";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MemberDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const bannerRef = useScrollReveal<HTMLDivElement>();
  const membershipRef = useScrollReveal<HTMLDivElement>();
  const profile = trpc.member.portalProfile.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  if (loading || (isAuthenticated && profile.isLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#138A73]" />
      </div>
    );
  }

  if (!user || !isAuthenticated) return null;

  const data = profile.data;
  const memberName = data?.name || user?.name || "Member";
  const membershipId = data?.membership.membershipId || user?.membershipId;
  const status = data?.membership.status || "Pending";
  const isActive = status === "Active";

  const letter = data?.documents.find((d) => d.type === "Membership Letter");
  const card = data?.documents.find((d) => d.type === "Membership Card");

  const details: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Email", value: data?.email || "—", icon: <Mail className="h-4 w-4" /> },
    { label: "Phone", value: data?.phone || "—", icon: <Phone className="h-4 w-4" /> },
    { label: "Institute", value: data?.institution || "—", icon: <Building2 className="h-4 w-4" /> },
    { label: "Local Council", value: data?.localCouncil || "—", icon: <Users className="h-4 w-4" /> },
    { label: "Discipline", value: data?.discipline || "—", icon: <BookOpen className="h-4 w-4" /> },
    { label: "Year of Study", value: data?.yearOfStudy || "—", icon: <GraduationCap className="h-4 w-4" /> },
    { label: "Graduation Year", value: data?.graduationYear ? String(data.graduationYear) : "—", icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          label="Member dashboard"
          title={`Welcome back, ${memberName}`}
          description="Your membership and documents, all in one place."
          className="mb-8"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ===== Profile ===== */}
          <section ref={bannerRef} className="msap-reveal rounded-xl border border-[#E7F4F0] bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-5 border-b border-[#E7EFEC] pb-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1B355E,#138A73)] text-2xl font-bold text-white">
                {initialsOf(memberName)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-[#1B355E]">{memberName}</h2>
                <p className="mt-0.5 truncate text-sm text-[#66788D]">
                  {data?.email || user?.email}
                </p>
                {membershipId && (
                  <p className="mt-1.5 inline-block rounded-lg bg-[#E7F4F0] px-2.5 py-1 font-mono text-xs font-semibold text-[#106E5B]">
                    {membershipId}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {details.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 text-[#138A73]">{row.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-[#8A9BAE]">{row.label}</p>
                    <p className="truncate text-sm font-medium text-[#344A61]">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== Membership ===== */}
          <section ref={membershipRef} className="msap-reveal rounded-xl border border-[#E7F4F0] bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#5D7086]">
              <IdCard className="h-4 w-4 text-[#106E5B]" /> Membership
            </h3>
            <div className="mt-4 rounded-xl border border-[#D9E4E1] bg-gradient-to-br from-[#F7FAF9] to-[#EEF5F2] p-5">
              <p className="text-xs uppercase tracking-wide text-[#66788D]">Membership ID</p>
              <p className="mt-1 font-mono text-lg font-semibold text-[#1B355E]">
                {membershipId || "—"}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Badge
                  className={
                    isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  {status}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#5D7086]">
                {data?.membership.validity || "Pending approval."}
              </p>
            </div>
            {data && !data.setupComplete && (
              <p className="mt-4 text-xs leading-5 text-amber-600/90">
                Tip: use your password setup email to create a login password.
              </p>
            )}
          </section>
        </div>

        {/* ===== Documents ===== */}
        <section className="mt-8">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1B355E]">
            <FileText className="h-5 w-5 text-[#138A73]" /> Your Documents
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Membership Letter */}
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#A8D8CD]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E7F4F0]">
                    <FileText className="h-6 w-6 text-[#106E5B]" />
                  </div>
                  <Badge variant="outline" className="border-[#D9E4E1] text-[#66788D]">
                    PDF
                  </Badge>
                </div>
                <h4 className="mt-4 font-semibold text-[#1B355E]">Membership Letter</h4>
                <p className="mt-1 text-sm text-[#5D7086]">
                  Official letter confirming your MSAP membership.
                </p>
                {letter ? (
                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#BFD4CD] text-[#106E5B] hover:bg-[#E7F4F0]"
                      onClick={() => window.open(letter.viewUrl, "_blank")}
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" /> View
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#138A73] text-white hover:bg-[#106E5B]"
                      onClick={() => window.open(letter.downloadUrl, "_blank")}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-[#8A9BAE]">
                    Not available yet — issued on approval.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Membership Card */}
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#A8D8CD]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E7F4F0]">
                    <Wallet className="h-6 w-6 text-[#106E5B]" />
                  </div>
                  <Badge variant="outline" className="border-[#D9E4E1] text-[#66788D]">
                    PDF
                  </Badge>
                </div>
                <h4 className="mt-4 font-semibold text-[#1B355E]">Membership Card</h4>
                <p className="mt-1 text-sm text-[#5D7086]">
                  Your official digital membership card.
                </p>
                {card ? (
                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#BFD4CD] text-[#106E5B] hover:bg-[#E7F4F0]"
                      onClick={() => window.open(card.viewUrl, "_blank")}
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" /> View
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#138A73] text-white hover:bg-[#106E5B]"
                      onClick={() => window.open(card.downloadUrl, "_blank")}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-[#8A9BAE]">
                    Not available yet — issued on approval.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ===== Quick links ===== */}
        <section className="mt-10">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1B355E]">
            <Award className="h-5 w-5 text-[#138A73]" /> Quick Access
          </h3>
          <div className="msap-reveal-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Activities", desc: "View & join activities", icon: <Calendar className="h-5 w-5" />, to: "/activities" },
              { label: "Events", desc: "Browse upcoming events", icon: <Calendar className="h-5 w-5" />, to: "/events" },
              { label: "Elections", desc: "Vote in elections", icon: <Users className="h-5 w-5" />, to: "/elections" },
              { label: "Finance", desc: "Expenses & claims", icon: <Wallet className="h-5 w-5" />, to: "/finance" },
              { label: "NEF/NRF", desc: "Activity enrollment", icon: <FileText className="h-5 w-5" />, to: "/nef-nrf" },
              { label: "Plenary", desc: "Sessions & resolutions", icon: <BookOpen className="h-5 w-5" />, to: "/plenary" },
              { label: "Communications", desc: "Announcements", icon: <Mail className="h-5 w-5" />, to: "/communications" },
              { label: "Documents", desc: "Public documents", icon: <FileText className="h-5 w-5" />, to: "/documents" },
              { label: "Directory", desc: "Find members", icon: <Users className="h-5 w-5" />, to: "/directory" },
              { label: "Settings", desc: "Account preferences", icon: <GraduationCap className="h-5 w-5" />, to: "/settings" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.to)}
                className="msap-reveal rounded-xl border border-[#E7F4F0] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#A8D8CD] hover:shadow-md group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F0] text-[#106E5B] transition-colors group-hover:bg-[#138A73] group-hover:text-white">
                  {item.icon}
                </div>
                <h5 className="mt-3 text-sm font-semibold text-[#1B355E]">{item.label}</h5>
                <p className="mt-0.5 text-xs text-[#66788D]">{item.desc}</p>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
