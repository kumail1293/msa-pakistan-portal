import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { Calendar, MapPin, Users, Search, CheckCircle2, Lock } from "lucide-react";
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
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view activities</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Browse and register for MSAP activities after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/activities")} className="mt-6 bg-[#138A73] px-8 text-white hover:bg-[#106E5B]">
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          label="Get involved"
          title="Activities"
          description="Discover workshops, seminars, and training opportunities"
          className="mb-8"
        />

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
          <LoadingState message="Loading activities..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No activities available right now"
            description="Check back soon for new workshops, seminars, and training opportunities."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((activity: any) => {
              const isRegistered = registeredIds.has(activity.id);
              return (
                <Card key={activity.id} className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#A8D8CD]">
                  <CardContent className="p-6">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#1B355E]">{activity.title}</h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {activity.type && (
                            <Badge className={`border ${getTypeColor(activity.type)}`}>
                              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                            </Badge>
                          )}
                          {activity.activityLevel && (
                            <Badge className="border border-blue-200 bg-blue-50 text-blue-700">
                              {activity.activityLevel} (§16)
                            </Badge>
                          )}
                          {activity.standingCommittee && (
                            <Badge className="border border-purple-200 bg-purple-50 text-purple-700">
                              {activity.standingCommittee}
                            </Badge>
                          )}
                          {activity.certificateIssued && (
                            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                              ✓ Certified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {activity.description && (
                      <p className="mb-4 text-sm leading-6 text-[#5D7086] line-clamp-2">{activity.description}</p>
                    )}
                    <div className="mb-4 flex flex-wrap gap-3 text-sm text-[#5D7086]">
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
                      className={`w-full disabled:opacity-50 ${isRegistered ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-[#138A73] text-white hover:bg-[#106E5B]"}`}
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
