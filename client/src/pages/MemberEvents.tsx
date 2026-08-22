import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, Search, Loader2, CheckCircle2, Lock, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberEvents() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const eventsQuery = (trpc as any).events?.list?.useQuery?.({ limit: 50 }) ?? { data: [], isLoading: false };
  const myRegsQuery = (trpc as any).events?.myRegistrations?.useQuery?.() ?? { data: [], isLoading: false };
  const register = (trpc as any).events?.register?.useMutation?.({
    onSuccess: () => {
      toast.success("Registration submitted!");
      myRegsQuery.refetch?.();
    },
    onError: (err: Error) => toast.error(err.message || "Could not register."),
  }) ?? { mutate: () => {}, isPending: false };

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
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view events</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Browse and register for MSAP events after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/events")} className="msap-primary-action mt-6 px-8 text-white">
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
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Mark your calendar</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Events</h1>
          <p className="mt-2 text-[#66788D]">Conferences, workshops, and gatherings across Pakistan</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
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
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading events...</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Calendar className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <p className="text-[#5D7086]">No events available right now. Check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-bold text-[#1B355E]">Upcoming Events</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map((event: any) => {
                    const isRegistered = registeredIds.has(event.id);
                    const isFull = event.maxCapacity && (event.currentRegistrations ?? 0) >= event.maxCapacity;
                    return (
                      <Card key={event.id} className="msap-card msap-card-hover">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-lg font-semibold text-[#1B355E] flex-1">{event.title}</h3>
                            {event.type && (
                              <Badge className={`ml-2 shrink-0 border ${getTypeColor(event.type)}`}>
                                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm leading-6 text-[#5D7086] mb-4 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-sm text-[#5D7086] mb-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-[#138A73]" />
                              {new Date(event.startDate).toLocaleDateString()}
                            </div>
                            {event.venue && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-[#138A73]" />
                                {event.venue}{event.city ? `, ${event.city}` : ""}
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
                            disabled={isRegistered || register.isPending || isFull}
                            className={`w-full ${isRegistered ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "msap-primary-action text-white"} disabled:opacity-50`}
                            variant={isRegistered ? "outline" : "default"}
                          >
                            {isRegistered ? (
                              <><CheckCircle2 className="mr-2 h-4 w-4" /> Registered</>
                            ) : isFull ? "Full" : register.isPending ? "Registering..." : "Register Now"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-bold text-[#1B355E]">Past Events</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {past.map((event: any) => (
                    <Card key={event.id} className="msap-card opacity-75">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-[#1B355E]">{event.title}</h3>
                        <div className="flex items-center gap-1 mt-2 text-sm text-[#5D7086]">
                          <Clock className="h-4 w-4" />
                          {new Date(event.startDate).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
