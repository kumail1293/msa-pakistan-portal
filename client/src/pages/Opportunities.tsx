import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Calendar, Search, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const APPLY_TEXT =
  "I would like to apply for this opportunity through my MSAP membership.";

export default function Opportunities() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const opportunitiesQuery = trpc.opportunity.list.useQuery({ limit: 100, offset: 0 });
  const apply = trpc.opportunity.submitApplication.useMutation({
    onSuccess: () => toast.success("Application submitted successfully!"),
    onError: (err) =>
      toast.error(err.message || "Could not submit your application. Please try again."),
  });

  const opportunities = opportunitiesQuery.data ?? [];
  const types = Array.from(
    new Set(opportunities.map((o) => o.type).filter((t): t is string => Boolean(t)))
  );

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      (opp.title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || opp.type === filterType;
    return matchesSearch && matchesType;
  });

  const openNow = filteredOpportunities.filter((o) => o.status === "Open");
  const otherOpportunities = filteredOpportunities.filter((o) => o.status !== "Open");

  const handleApply = (opportunityId: number, title: string) => {
    if (!isAuthenticated) {
      toast.error("Please sign in to apply for opportunities.");
      navigate("/login?next=/opportunities");
      return;
    }
    apply.mutate({ opportunityId, applicationText: `"${title}" - ${APPLY_TEXT}` });
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case "internship":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "position":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "project":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "scholarship":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-[#E7F4F0] text-[#106E5B] border-[#A8D8CD]";
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Open":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Closed":
        return "bg-red-100 text-red-700 border-red-200";
      case "Completed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getTypeLabel = (type: string | null) =>
    type ? type.charAt(0).toUpperCase() + type.slice(1) : "Opportunity";

  const OpportunityCard = ({ opp }: { opp: (typeof opportunities)[number] }) => (
    <Card className="msap-card msap-card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[#1B355E]">{opp.title}</h3>
              <Badge className={`border ${getTypeColor(opp.type)}`}>
                {getTypeLabel(opp.type)}
              </Badge>
              <Badge className={`border ${getStatusColor(opp.status)}`}>
                {opp.status ?? "Unknown"}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-[#5D7086]">{opp.description}</p>

            {opp.applicationDeadline && (
              <div className="mt-4 flex items-center text-sm text-[#5D7086]">
                <Calendar className="mr-2 h-4 w-4 text-[#138A73]" />
                Deadline: {new Date(opp.applicationDeadline).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <Button
            onClick={() => handleApply(opp.id, opp.title)}
            disabled={apply.isPending || opp.status !== "Open"}
            className="msap-primary-action w-full text-white disabled:opacity-50"
          >
            {apply.isPending ? "Submitting..." : opp.status === "Open" ? "Apply Now" : "Applications Closed"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <Card className="msap-card py-12 text-center">
      <CardContent>
        <Briefcase className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
        <p className="text-[#5D7086]">{message}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Member benefits
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            Opportunities
          </h1>
          <p className="mt-2 text-[#66788D]">
            Discover internships, positions, projects, and scholarships
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A9BAE]" />
              <Input
                placeholder="Search opportunities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pl-10"
              />
            </div>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-12">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {getTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {opportunitiesQuery.isLoading ? (
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading opportunities...</p>
            </CardContent>
          </Card>
        ) : opportunities.length === 0 ? (
          <EmptyState message="No opportunities are available right now. Check back soon." />
        ) : filteredOpportunities.length === 0 ? (
          <EmptyState message="No opportunities match your filters." />
        ) : (
          <>
            {openNow.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-bold text-[#1B355E]">Open now</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {openNow.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp} />
                  ))}
                </div>
              </div>
            )}

            {otherOpportunities.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-bold text-[#1B355E]">
                  All opportunities ({filteredOpportunities.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {otherOpportunities.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp} />
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
