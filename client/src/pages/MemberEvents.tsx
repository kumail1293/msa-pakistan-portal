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
import { Calendar, MapPin, Users, Search, CheckCircle2, Lock, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberEvents() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const eventsQuery = trpc.events.list.useQuery({ limit: 50 });
  const myRegsQuery = trpc.events.myRegistrations.useQuery();
  const register = trpc.events.register.useMutation({
    onSuccess: () => {
      toast.success("Registration submitted!");
      myRegsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Could not register."),
  });

  const events = (eventsQuery.data ?? []) as any[];
  const myRegistrations = (myRegsQuery.data ?? []) as any[];
  const registeredIds = new Set(myRegistrations.map((r: any) => r.eventId));

  const types = Array.from(new Set(events.map((e) => e.type).filter(Boolean)));

  const filtered = events.filter((e) => {
    const matchesSearch = (e.title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || e.type === filterType;
    return matchesSearch && matchesType;
  });

  const upcoming = filtered.filter((e) => new Date(e.startDate) > new Date());
  const past = filtered.filter((e) => new Date(e.startDate) <= new Date());

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case "conference": return "bg-blue-100 text-blue-700 border-blue-200";
      case "workshop": return "bg-violet-100 text-violet-700 border-violet-200";
      case "webinar": return "bg-amber-100 text-amber-700 border-amber-200";
      case "social": return "bg-pink-100 text-pink-700 border-pink-200";
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
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view events</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Browse and register for MSAP events after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/events")} className="mt-6 bg-[#138A73] px-8 text-white hover:bg-[#106E5B]">
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
          label="Mark your calendar"
          title="Events & Conferences"
          description="Upcoming and past MSAP events, conferences, and gatherings"
          className="mb-8"
        />

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A9BAE]" />
              <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-12 pl-10" />
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
        </div>

        {eventsQuery.isLoading ? (
          <LoadingState message="Loading events..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No events found"
            description="Check back soon for upcoming conferences, workshops, and gatherings."
          />
        ) : (
          <>
            {/* Upcoming Events */}
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-lg font-bold text-[#1B355E]">Upcoming Events</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map((event: any) => {
                    const isRegistered = registeredIds.has(event.id);
                    return (
                      <Card key={event.id} className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#A8D8CD]">
                        <CardContent className="p-6">
                          <div className="mb-3 flex items-start justify-between">
                            <h3 className="text-lg font-semibold text-[#1B355E]">{event.title}</h3>
                            {event.type && (
                              <Badge className={`border ${getTypeColor(event.type)}`}>
                                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="mb-3 text-sm leading-6 text-[#5D7086] line-clamp-2">{event.description}</p>
                          )}
                          <div className="mb-4 flex flex-wrap gap-3 text-sm text-[#5D7086]">
                            {event.startDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-[#138A73]" />
                                {new Date(event.startDate).toLocaleDateString()}
                              </div>
                            )}
                            {event.venue && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-[#138A73]" />
                                {event.venue}
                              </div>
                            )}
                            {event.maxCapacity && (
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-[#138A73]" />
                                {event.currentRegistrations ?? 0}/{event.maxCapacity}
                              </div>
                            )}
                            {event.fee != null && event.fee > 0 && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-[#138A73]" />
                                PKR {event.fee.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() => register.mutate({ eventId: event.id })}
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
              </section>
            )}

            {/* Past Events */}
            {past.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold text-[#1B355E]">Past Events</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {past.map((event: any) => (
                    <Card key={event.id} className="opacity-75 transition-all hover:opacity-100 hover:shadow-md">
                      <CardContent className="p-6">
                        <div className="mb-3 flex items-start justify-between">
                          <h3 className="text-lg font-semibold text-[#1B355E]">{event.title}</h3>
                          {event.type && (
                            <Badge className={`border ${getTypeColor(event.type)}`}>
                              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                            </Badge>
                          )}
                        </div>
                        {event.description && (
                          <p className="mb-3 text-sm leading-6 text-[#5D7086] line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-sm text-[#5D7086]">
                          {event.startDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-[#8A9BAE]" />
                              {new Date(event.startDate).toLocaleDateString()}
                            </div>
                          )}
                          {event.venue && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-[#8A9BAE]" />
                              {event.venue}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
