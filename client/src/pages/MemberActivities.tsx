import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, Search, Loader2, CheckCircle2, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberActivities() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSc, setFilterSc] = useState<string>("all");

  const activitiesQuery = trpc.activities.list.useQuery({ limit: 50 });
  const myRegsQuery = trpc.activities.myRegistrations.useQuery();
  const register = trpc.activities.register.useMutation({
    onSuccess: () => {
      toast.success("Registration submitted!");
      myRegsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Could not register."),
  });

  const activities = (activitiesQuery.data ?? []) as any[];
  const myRegistrations = (myRegsQuery.data ?? []) as any[];
  const registeredIds = new Set(myRegistrations.map((r: any) => r.activityId));

  const types = Array.from(new Set(activities.map((a) => a.type).filter(Boolean)));
  const levels = Array.from(new Set(activities.map((a) => a.activityLevel).filter(Boolean)));
  const standingCommittees = Array.from(new Set(activities.map((a) => a.standingCommittee).filter(Boolean)));

  const filtered = activities.filter((a) => {
    const matchesSearch = (a.title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || a.type === filterType;
    const matchesLevel = filterLevel === "all" || a.activityLevel === filterLevel;
    const matchesSc = filterSc === "all" || a.standingCommittee === filterSc;
    return matchesSearch && matchesType && matchesLevel && matchesSc;
  });

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case "workshop": return "bg-blue-100 text-blue-700 border-blue-200";
      case "seminar": return "bg-violet-100 text-violet-700 border-violet-200";
      case "conference": return "bg-amber-100 text-amber-700 border-amber-200";
      case "training": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-[#E7F4F0] text-[#106E5B] border-[#A8D8CD]";
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view activities</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Browse and register for MSAP activities after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/activities")} className="msap-primary-action mt-6 px-8 text-white">
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Get involved</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Activities</h1>
          <p className="mt-2 text-[#66788D]">Discover workshops, seminars, and training opportunities</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A9BAE]" />
              <Input placeholder="Search activities..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-12 pl-10" />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>{type?.charAt(0).toUpperCase() + (type?.slice(1) ?? "")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="national">National</SelectItem>
              <SelectItem value="regional">Regional</SelectItem>
              <SelectItem value="international">International</SelectItem>
            </SelectContent>
          </Select>
          {standingCommittees.length > 0 && (
            <Select value={filterSc} onValueChange={setFilterSc}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Standing Committee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SCs</SelectItem>
                {standingCommittees.map((sc) => (
                  <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {activitiesQuery.isLoading ? (
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading activities...</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Calendar className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <p className="text-[#5D7086]">No activities available right now. Check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((activity: any) => {
              const isRegistered = registeredIds.has(activity.id);
              return (
                <Card key={activity.id} className="msap-card msap-card-hover">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#1B355E]">{activity.title}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.type && (
                            <Badge className={`border ${getTypeColor(activity.type)}`}>
                              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                            </Badge>
                          )}
                          {activity.activityLevel && (
                            <Badge className="border bg-blue-50 text-blue-700 border-blue-200">
                              {activity.activityLevel} (§16)
                            </Badge>
                          )}
                          {activity.standingCommittee && (
                            <Badge className="border bg-purple-50 text-purple-700 border-purple-200">
                              {activity.standingCommittee}
                            </Badge>
                          )}
                          {activity.certificateIssued && (
                            <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200">
                              ✓ Certified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {activity.description && (
                      <p className="text-sm leading-6 text-[#5D7086] mb-4 line-clamp-2">{activity.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm text-[#5D7086] mb-4">
                      {activity.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-[#138A73]" />
                          {new Date(activity.startDate).toLocaleDateString()}
                        </div>
                      )}
                      {activity.venue && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-[#138A73]" />
                          {activity.venue}
                        </div>
                      )}
                      {activity.maxParticipants && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-[#138A73]" />
                          {activity.currentParticipants ?? 0}/{activity.maxParticipants}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => register.mutate({ activityId: activity.id })}
                      disabled={isRegistered || register.isPending}
                      className={`w-full ${isRegistered ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "msap-primary-action text-white"} disabled:opacity-50`}
                      variant={isRegistered ? "outline" : "default"}
                    >
                      {isRegistered ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Registered</>
                      ) : register.isPending ? "Registering..." : "Register"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
