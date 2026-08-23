import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Calendar,
  MapPin,
  Users,
  Clock,
  ExternalLink,
  Globe,
  MessageSquare,
  Youtube,
  ChevronRight,
  Loader2,
  Shield,
  Vote,
  FileText,
  Gavel,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// ─── NGA Status Lifecycle ──────────────────────────────────────────────
const NGA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-gray-100 text-gray-700" },
  organizing_committee: { label: "Organizing Committee", color: "bg-blue-100 text-blue-700" },
  call_for_participation: { label: "Call for Participation", color: "bg-indigo-100 text-indigo-700" },
  registration: { label: "Registration Open", color: "bg-green-100 text-green-700" },
  credentialing: { label: "Credentialing", color: "bg-yellow-100 text-yellow-700" },
  preparation: { label: "Preparation", color: "bg-orange-100 text-orange-700" },
  opening: { label: "Opening Ceremony", color: "bg-purple-100 text-purple-700" },
  plenary: { label: "Plenary Sessions", color: "bg-red-100 text-red-700" },
  committees: { label: "Standing Committees", color: "bg-cyan-100 text-cyan-700" },
  elections: { label: "Elections", color: "bg-rose-100 text-rose-700" },
  reports: { label: "Reports", color: "bg-amber-100 text-amber-700" },
  bylaw_changes: { label: "Bylaw Changes", color: "bg-teal-100 text-teal-700" },
  closing: { label: "Closing Ceremony", color: "bg-emerald-100 text-emerald-700" },
  certification: { label: "Certification", color: "bg-lime-100 text-lime-700" },
  archive: { label: "Archived", color: "bg-gray-100 text-gray-500" },
};

// ─── Landing Page (No Active NGA) ─────────────────────────────────────
function NgaLandingPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Hero */}
      <div className="max-w-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1B355E] to-[#138A73] shadow-lg">
          <Flag className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#1B355E]">
          National General Assembly
        </h1>
        <p className="mt-3 text-lg text-[#5D7086]">
          MSA-Pakistan's supreme governing body
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">
            No active NGA at this time
          </span>
        </div>
      </div>

      {/* Bylaw Reference */}
      <Card className="mt-10 max-w-xl w-full border-[#E7F4F0]">
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
            <Gavel className="h-5 w-5 text-[#138A73]" /> Bylaw Reference — §8.1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#5D7086]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-[#138A73] shrink-0" />
              <div>
                <p className="font-semibold text-[#1B355E]">Annual Meeting</p>
                <p>B-8.1.3: NGA at least once per year</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-[#138A73] shrink-0" />
              <div>
                <p className="font-semibold text-[#1B355E]">NGA Window</p>
                <p>C-6.3: Between July 20 – August 20</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-[#138A73] shrink-0" />
              <div>
                <p className="font-semibold text-[#1B355E]">Quorum</p>
                <p>B-8.1.8: 1/3 Permanent + Temporary LCs</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-[#138A73] shrink-0" />
              <div>
                <p className="font-semibold text-[#1B355E]">In-Person Required</p>
                <p>B-8.1.12: NGA must be held in person</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Happens at NGA */}
      <Card className="mt-6 max-w-xl w-full border-[#E7F4F0]">
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">What Happens at NGA?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Gavel, label: "Plenary Sessions", desc: "Motions, debates, resolutions" },
              { icon: Vote, label: "Elections", desc: "National officers elected" },
              { icon: FileText, label: "Bylaw Changes", desc: "Constitutional amendments" },
              { icon: Shield, label: "Reports", desc: "Standing committee reports" },
              { icon: Users, label: "Delegations", desc: "LC representatives participate" },
              { icon: Flag, label: "Decisions", desc: "Binding organizational decisions" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-lg border border-[#E7F4F0] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F0]">
                  <item.icon className="h-4 w-4 text-[#106E5B]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1B355E]">{item.label}</p>
                  <p className="text-xs text-[#5D7086]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stay Connected */}
      <div className="mt-10 max-w-xl w-full">
        <h3 className="text-lg font-bold text-[#1B355E] mb-4">Stay Connected</h3>
        <p className="text-sm text-[#5D7086] mb-6">
          Follow MSA-Pakistan for updates on the next NGA and other activities.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://msapakistan.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E7F4F0] bg-white px-5 py-3 text-sm font-semibold text-[#1B355E] hover:bg-[#F0F5F3] transition-colors"
          >
            <Globe className="h-4 w-4" /> Website
            <ExternalLink className="h-3 w-3 text-[#5D7086]" />
          </a>
          <a
            href="https://facebook.com/msapakistan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E7F4F0] bg-white px-5 py-3 text-sm font-semibold text-[#1B355E] hover:bg-[#F0F5F3] transition-colors"
          >
            <svg className="h-4 w-4" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a
            href="https://instagram.com/msapakistan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E7F4F0] bg-white px-5 py-3 text-sm font-semibold text-[#1B355E] hover:bg-[#F0F5F3] transition-colors"
          >
            <svg className="h-4 w-4" fill="#E4405F" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </a>
          <a
            href="https://youtube.com/@msapakistan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E7F4F0] bg-white px-5 py-3 text-sm font-semibold text-[#1B355E] hover:bg-[#F0F5F3] transition-colors"
          >
            <Youtube className="h-4 w-4 text-red-600" /> YouTube
          </a>
          <a
            href="https://wa.me/923000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E7F4F0] bg-white px-5 py-3 text-sm font-semibold text-[#1B355E] hover:bg-[#F0F5F3] transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-green-600" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Active NGA Dashboard ──────────────────────────────────────────────
function ActiveNgaDashboard({ meeting }: { meeting: any }) {
  const [, setLocation] = useLocation();
  const statusInfo = NGA_STATUS_LABELS[meeting.status] ?? {
    label: meeting.status,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            National General Assembly
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">
            {meeting.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#5D7086]">
            {meeting.edition && <span>{meeting.edition}</span>}
            {meeting.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {meeting.venue}
                {meeting.city ? `, ${meeting.city}` : ""}
              </span>
            )}
            {meeting.scheduledStart && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />{" "}
                {new Date(meeting.scheduledStart).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
        <Badge className={`${statusInfo.color} text-sm px-3 py-1`}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F0]">
                <Users className="h-5 w-5 text-[#106E5B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1B355E]">
                  {meeting.quorumMet ? "Met" : "Pending"}
                </p>
                <p className="text-xs text-[#66788D]">Quorum Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Flag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1B355E]">
                  {meeting.mode === "in_person" ? "In Person" : meeting.mode === "hybrid" ? "Hybrid" : "Online"}
                </p>
                <p className="text-xs text-[#66788D]">Meeting Mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1B355E]">
                  {meeting.participationFee ? `PKR ${meeting.participationFee.toLocaleString()}` : "Free"}
                </p>
                <p className="text-xs text-[#66788D]">Participation Fee</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Gavel className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1B355E]">§8.1</p>
                <p className="text-xs text-[#66788D]">Bylaw Reference</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Delegations", desc: "View registered LC delegations", path: "/nga/delegations", icon: Users },
          { label: "Agenda", desc: "NGA session agenda", path: "/nga/agenda", icon: FileText },
          { label: "Roll Call", desc: "Attendance and voting credentials", path: "/nga/roll-call", icon: ClipboardList },
          { label: "Plenary Console", desc: "Motions, debates, and votes", path: "/nga/plenary", icon: Gavel },
          { label: "Elections", desc: "NGA election proceedings", path: "/elections", icon: Vote },
          { label: "Decisions & Minutes", desc: "Official NGA decisions", path: "/nga/decisions", icon: ScrollText },
        ].map((item) => (
          <Card
            key={item.path}
            className="cursor-pointer border-[#E7F4F0] hover:border-[#138A73] hover:shadow-md transition-all"
            onClick={() => setLocation(item.path)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F0]">
                <item.icon className="h-5 w-5 text-[#106E5B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1B355E]">{item.label}</p>
                <p className="text-xs text-[#5D7086] truncate">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#5D7086] shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Need these imports for the quick links
import { ClipboardList, ScrollText } from "lucide-react";

// ─── Main Component ────────────────────────────────────────────────────
export default function NgaPortal() {
  const ngaQuery = (trpc as any).admin?.nga?.isActive?.useQuery?.();
  const isLoading = ngaQuery?.isLoading ?? true;
  const data = ngaQuery?.data;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
          <p className="text-sm text-[#5D7086]">Checking NGA status…</p>
        </div>
      </div>
    );
  }

  if (data?.active && data?.meeting) {
    return <ActiveNgaDashboard meeting={data.meeting} />;
  }

  return <NgaLandingPage />;
}
