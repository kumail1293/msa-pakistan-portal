import { trpc } from "@/lib/trpc";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  Scale,
  Search,
  BookOpen,
  FileText,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Landmark,
  Shield,
  Gavel,
  Vote,
  ExternalLink,
} from "lucide-react";

// ── Section Card ─────────────────────────────────────────────────
function SectionCard({
  section,
  defaultExpanded = false,
}: {
  section: {
    id: string;
    number: string;
    title: string;
    content: string;
    level: string;
    clauseId?: string;
  };
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const levelBadge: Record<string, { label: string; color: string }> = {
    constitution: { label: "Constitution", color: "bg-blue-50 text-blue-700 border-blue-200" },
    bylaws: { label: "Bylaws", color: "bg-green-50 text-green-700 border-green-200" },
    annex: { label: "Annex", color: "bg-purple-50 text-purple-700 border-purple-200" },
  };

  const badge = levelBadge[section.level] ?? levelBadge.bylaws;

  return (
    <div className="border border-[#E7F4F0] rounded-lg overflow-hidden hover:border-[#138A73]/30 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#F8FDFB] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[#138A73] font-mono">
              §{section.number}
            </span>
            <h3 className="text-sm font-semibold text-[#1B355E]">{section.title}</h3>
            <Badge variant="outline" className={`text-[9px] ${badge.color}`}>
              {badge.label}
            </Badge>
          </div>
          {!expanded && (
            <p className="text-xs text-[#8A9BAE] truncate">{section.content}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[#8A9BAE] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#8A9BAE] shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#E7F4F0]">
          <p className="text-sm text-[#1B355E] leading-relaxed mt-3 whitespace-pre-line">
            {section.content}
          </p>
          {section.clauseId && (
            <p className="text-[10px] text-[#B0BEC5] font-mono mt-2">
              Reference: {section.clauseId}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function GovernanceTransparency() {
  const [searchQuery, setSearchQuery] = useState("");

  const overviewQuery = trpc.governance.overview.useQuery();
  const searchQuery_result = trpc.governance.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );

  const overview = overviewQuery.data;
  const searchResults = searchQuery_result.data ?? [];

  return (
    <div className="msap-page min-h-screen bg-[#FAFCFB]">
      {/* Header */}
      <header className="border-b border-[#D9E4E1] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MSAPLogo />
            <div>
              <h1 className="text-lg font-bold text-[#1B355E]">Governance Transparency</h1>
              <p className="text-xs text-[#8A9BAE]">Active Constitution & Bylaws</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9BAE]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bylaws..."
                className="pl-9 w-48 sm:w-64 text-sm"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {overviewQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
          </div>
        ) : !overview ? (
          <div className="text-center py-16">
            <Scale className="h-12 w-12 mx-auto mb-3 text-[#8A9BAE] opacity-40" />
            <p className="text-[#8A9BAE]">Loading governance data...</p>
          </div>
        ) : (
          <>
            {/* Document Header */}
            <Card className="card-cinematic mb-8">
              <CardContent className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <Badge variant="outline" className="text-xs mb-3">
                    {overview.documentVersion}
                  </Badge>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B355E] mb-2">
                    {overview.documentTitle}
                  </h2>
                  <p className="text-sm text-[#66788D]">
                    {overview.organizationName} · Amended {overview.lastAmended} · Effective {overview.effectiveFrom}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                    <Landmark className="h-5 w-5 mx-auto mb-1 text-[#138A73]" />
                    <p className="text-xs text-[#66788D]">Constitution</p>
                    <p className="text-lg font-bold text-[#1B355E]">
                      {overview.sections.filter((s) => s.level === "constitution").length}
                    </p>
                    <p className="text-[10px] text-[#8A9BAE]">sections</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                    <Gavel className="h-5 w-5 mx-auto mb-1 text-[#138A73]" />
                    <p className="text-xs text-[#66788D]">Bylaws</p>
                    <p className="text-lg font-bold text-[#1B355E]">
                      {overview.sections.filter((s) => s.level === "bylaws").length}
                    </p>
                    <p className="text-[10px] text-[#8A9BAE]">sections</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                    <Shield className="h-5 w-5 mx-auto mb-1 text-[#138A73]" />
                    <p className="text-xs text-[#66788D]">Active Rules</p>
                    <p className="text-lg font-bold text-[#1B355E]">{overview.activeRules.length}</p>
                    <p className="text-[10px] text-[#8A9BAE]">configured</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                    <Users className="h-5 w-5 mx-auto mb-1 text-[#138A73]" />
                    <p className="text-xs text-[#66788D]">Positions</p>
                    <p className="text-lg font-bold text-[#1B355E]">{overview.positions.length}</p>
                    <p className="text-[10px] text-[#8A9BAE]">defined</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <Card className="card-cinematic mb-6">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                    <Search className="h-5 w-5 text-[#106E5B]" />
                    Search Results ({searchResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-[#8A9BAE]">
                      No results found for "{searchQuery}"
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((section) => (
                        <SectionCard key={section.id} section={section} defaultExpanded={false} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Main Content Tabs */}
            <Tabs defaultValue="constitution" className="space-y-6">
              <TabsList className="bg-white border border-[#D9E4E1] p-1">
                <TabsTrigger value="constitution" className="gap-1.5 text-xs">
                  <Landmark className="h-3.5 w-3.5" />
                  Constitution
                  <Badge variant="secondary" className="text-[9px] px-1.5 ml-1">
                    {overview.sections.filter((s) => s.level === "constitution").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="bylaws" className="gap-1.5 text-xs">
                  <Gavel className="h-3.5 w-3.5" />
                  Bylaws
                  <Badge variant="secondary" className="text-[9px] px-1.5 ml-1">
                    {overview.sections.filter((s) => s.level === "bylaws").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="positions" className="gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  Positions
                </TabsTrigger>
                <TabsTrigger value="rules" className="gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  Active Rules
                  <Badge variant="secondary" className="text-[9px] px-1.5 ml-1">
                    {overview.activeRules.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Constitution Tab */}
              <TabsContent value="constitution">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Landmark className="h-5 w-5 text-[#138A73]" />
                    <h3 className="text-lg font-bold text-[#1B355E]">Constitution of MSA-Pakistan</h3>
                  </div>
                  {overview.sections
                    .filter((s) => s.level === "constitution")
                    .map((section) => (
                      <SectionCard key={section.id} section={section} />
                    ))}
                </div>
              </TabsContent>

              {/* Bylaws Tab */}
              <TabsContent value="bylaws">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Gavel className="h-5 w-5 text-[#138A73]" />
                    <h3 className="text-lg font-bold text-[#1B355E]">Bylaws of MSA-Pakistan</h3>
                  </div>
                  {overview.sections
                    .filter((s) => s.level === "bylaws")
                    .map((section) => (
                      <SectionCard key={section.id} section={section} />
                    ))}
                </div>
              </TabsContent>

              {/* Positions Tab */}
              <TabsContent value="positions">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-[#138A73]" />
                    <h3 className="text-lg font-bold text-[#1B355E]">Official Positions</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {overview.positions.map((pos, i) => (
                      <Card key={i} className="card-cinematic">
                        <CardContent className="p-4">
                          <h4 className="text-sm font-semibold text-[#1B355E] mb-2">{pos.title}</h4>
                          <div className="space-y-1">
                            <p className="text-xs text-[#66788D]">
                              <span className="font-medium">Body:</span> {pos.body}
                            </p>
                            <p className="text-xs text-[#66788D]">
                              <span className="font-medium">Election:</span> {pos.electionMethod}
                            </p>
                            <p className="text-xs text-[#66788D]">
                              <span className="font-medium">Term:</span> {pos.termDuration}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="card-cinematic mt-4">
                    <CardHeader>
                      <CardTitle className="text-sm text-[#1B355E]">Standing Committees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {overview.committees.map((c, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-[#66788D]">
                            <ChevronRight className="h-3 w-3 text-[#138A73] shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Active Rules Tab */}
              <TabsContent value="rules">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-[#138A73]" />
                    <h3 className="text-lg font-bold text-[#1B355E]">
                      Active Governance Rules
                      <span className="text-sm font-normal text-[#8A9BAE] ml-2">
                        ({overview.activeRules.length} rules configured)
                      </span>
                    </h3>
                  </div>

                  {overview.activeRules.length === 0 ? (
                    <Card className="card-cinematic">
                      <CardContent className="py-8 text-center text-[#8A9BAE]">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No active governance rules configured yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {overview.activeRules.map((rule, i) => (
                        <div
                          key={i}
                          className="border border-[#E7F4F0] rounded-lg p-3 hover:bg-[#F8FDFB] transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-[#138A73] font-mono">
                              {rule.ruleKey}
                            </span>
                            <Badge variant="outline" className="text-[9px]">
                              {rule.ruleType}
                            </Badge>
                            {rule.clauseId && (
                              <Badge variant="secondary" className="text-[9px]">
                                {rule.clauseId}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(rule.parameters).map(([key, value]) => (
                              <Badge
                                key={key}
                                variant="outline"
                                className="text-[9px] font-mono"
                              >
                                {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-[#D9E4E1] text-center">
              <p className="text-xs text-[#8A9BAE]">
                This page provides public access to the active governance documents of {overview.organizationName}.
              </p>
              <p className="text-xs text-[#B0BEC5] mt-1">
                {overview.documentVersion} · Amended {overview.lastAmended} · Effective {overview.effectiveFrom}
              </p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <a href="/" className="text-xs text-[#138A73] hover:underline">
                  ← Back to Portal
                </a>
                <a href="/login" className="text-xs text-[#138A73] hover:underline">
                  Sign In
                </a>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
