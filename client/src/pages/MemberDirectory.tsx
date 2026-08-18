import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Filter, Mail, MapPin, Lock, Loader2, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";

type DirectoryMember = {
  id: number;
  name: string | null;
  email: string | null;
  membershipId: string | null;
  degree: string | null;
  discipline: string | null;
  yearOfStudy: string | null;
  institution: string | null;
  localCouncil: string | null;
  membershipStatus: string | null;
  profilePhotoUrl: string | null;
};

function initialsOf(name: string | null): string {
  if (!name) return "M";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MemberDirectory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLC, setFilterLC] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const membersQuery = trpc.directory.listMembers.useQuery(
    { query: "", limit: 200 },
    { enabled: isAuthenticated }
  );

  const members = membersQuery.data ?? [];

  const localCouncils = useMemo(
    () => Array.from(new Set(members.map((m) => m.localCouncil).filter((lc): lc is string => Boolean(lc)))),
    [members]
  );

  const filteredMembers = members.filter((member) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [member.name, member.email, member.institution, member.localCouncil, member.membershipId]
        .some((v) => (v ?? "").toLowerCase().includes(q));

    const matchesLC = filterLC === "all" || member.localCouncil === filterLC;
    const matchesStatus = filterStatus === "all" || member.membershipStatus === filterStatus;

    return matchesSearch && matchesLC && matchesStatus;
  });

  const activeCount = members.filter((m) => m.membershipStatus === "Active").length;

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to browse the directory</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                The member directory is reserved for verified MSAP members.
              </p>
              <Button
                onClick={() => navigate("/login?next=/directory")}
                className="msap-primary-action mt-6 px-8 text-white"
              >
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            The MSAP network
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            Member Directory
          </h1>
          <p className="mt-2 text-[#66788D]">Connect with members across all Local Councils</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A9BAE]" />
              <Input
                placeholder="Search members by name, email, or institution..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pl-10"
              />
            </div>
          </div>

          <Select value={filterLC} onValueChange={setFilterLC}>
            <SelectTrigger className="h-12">
              <MapPin className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Local Council" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Councils</SelectItem>
              {localCouncils.map((lc) => (
                <SelectItem key={lc} value={lc}>
                  {lc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-12">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Members Grid */}
        {membersQuery.isLoading ? (
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading members...</p>
            </CardContent>
          </Card>
        ) : members.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Users className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h3 className="text-lg font-semibold text-[#1B355E]">No members yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                The directory fills with members as they join the portal after approval. Check
                back soon.
              </p>
            </CardContent>
          </Card>
        ) : filteredMembers.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Users className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <p className="text-[#5D7086]">No members found matching your criteria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <Card key={member.id} className="msap-card msap-card-hover group">
                <CardContent className="p-6">
                  {/* Member Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1B355E,#138A73)] text-sm font-bold text-white">
                        {initialsOf(member.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-[#1B355E] transition-colors group-hover:text-[#106E5B]">
                          {member.name || "MSAP Member"}
                        </h3>
                        <p className="truncate text-sm text-[#66788D]">
                          {member.degree || member.discipline || "Member"}
                        </p>
                      </div>
                    </div>
                    {member.membershipStatus && (
                      <Badge
                        className={
                          member.membershipStatus === "Active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }
                      >
                        {member.membershipStatus}
                      </Badge>
                    )}
                  </div>

                  {member.membershipId && (
                    <p className="mb-3 inline-block rounded-lg bg-[#E7F4F0] px-2.5 py-1 font-mono text-xs font-semibold text-[#106E5B]">
                      {member.membershipId}
                    </p>
                  )}

                  {/* Local Council + Study info */}
                  <div className="space-y-2">
                    {member.localCouncil && (
                      <div className="flex items-center text-sm text-[#5D7086]">
                        <MapPin className="mr-2 h-4 w-4 text-[#138A73]" />
                        <span className="truncate">{member.localCouncil}</span>
                      </div>
                    )}
                    {member.institution && (
                      <p className="truncate text-sm text-[#344A61]">{member.institution}</p>
                    )}
                    {member.discipline && (
                      <div className="flex items-center text-sm text-[#5D7086]">
                        <GraduationCap className="mr-2 h-4 w-4 text-[#138A73]" />
                        {member.discipline}
                        {member.yearOfStudy ? ` · ${member.yearOfStudy}` : ""}
                      </div>
                    )}
                  </div>

                  {/* Contact Button */}
                  {member.email && (
                    <Button
                      onClick={() => {
                        window.location.href = `mailto:${member.email}`;
                      }}
                      className="msap-primary-action mt-5 w-full text-white"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contact
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="msap-card">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-[#1B355E]">{members.length}</p>
              <p className="mt-2 text-sm text-[#66788D]">Portal Members</p>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
              <p className="mt-2 text-sm text-[#66788D]">Active Members</p>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-violet-600">{localCouncils.length}</p>
              <p className="mt-2 text-sm text-[#66788D]">Local Councils</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
