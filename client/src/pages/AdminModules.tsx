import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, FileText, Users, DollarSign, MessageSquare, FolderKanban, BarChart3, Building, Activity, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <Card className="card-cinematic">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#66788D]">{label}</p>
            <p className="text-2xl font-bold text-[#1B355E]">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color ?? "bg-[#138A73]/10"}`}>
            <Icon className="h-5 w-5 text-[#138A73]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleSection({ title, description, icon: Icon, count, color }: { title: string; description: string; icon: any; count?: number; color?: string }) {
  return (
    <Card className="card-cinematic">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color ?? "bg-[#138A73]/10"}`}>
            <Icon className="h-6 w-6 text-[#138A73]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#1B355E]">{title}</h3>
            <p className="text-xs text-[#8A9BAE]">{description}</p>
          </div>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs font-mono">{count}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminModules() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const actStats = trpc.enterprise.activities.stats.useQuery();
  const docStats = trpc.enterprise.documents.stats.useQuery();
  const evtStats = trpc.enterprise.events.stats.useQuery();
  const chStats = trpc.enterprise.chapters.stats.useQuery();
  const finSummary = trpc.enterprise.finance.summary.useQuery();
  const projStats = trpc.enterprise.projects.stats.useQuery();
  const commStats = trpc.enterprise.communications.stats.useQuery();
  const analytics = trpc.enterprise.analytics.dashboard.useQuery();
  const volStats = trpc.enterprise.volunteers.stats.useQuery();
  const trainStats = trpc.enterprise.training.stats.useQuery();
  const awardStats = trpc.enterprise.recognition.stats.useQuery();
  const appStats = trpc.enterprise.applications.stats.useQuery();
  const mtgStats = trpc.enterprise.meetings.stats.useQuery();
  const appLifecycle = trpc.enterprise.memberLifecycle.stats.useQuery();
  const instStats = trpc.enterprise.institutions.stats.useQuery();
  const integrStats = trpc.enterprise.integrations.stats.useQuery();

  if (loading) {
    return <div className="msap-page min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" /></div>;
  }
  if (!user || !canAccessModule(user, "config")) { navigate("/official"); return null; }

  const act = actStats.data;
  const doc = docStats.data;
  const evt = evtStats.data;
  const ch = chStats.data;
  const fin = finSummary.data;
  const proj = projStats.data;
  const comm = commStats.data;

  return (
    <div>
      <div className="">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
            <Activity className="h-8 w-8 text-[#106E5B]" />
            Platform Modules
          </h1>
          <p className="text-[#66788D]">Manage all platform modules — activities, documents, events, chapters, finance, communications, and projects</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border border-[#D9E4E1] p-1 flex flex-wrap">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="activities" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Activities</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Documents</TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />Events</TabsTrigger>
            <TabsTrigger value="chapters" className="gap-1.5 text-xs"><Building className="h-3.5 w-3.5" />Chapters</TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" />Finance</TabsTrigger>
            <TabsTrigger value="communications" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" />Communications</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 text-xs"><FolderKanban className="h-3.5 w-3.5" />Projects</TabsTrigger>
            <TabsTrigger value="governance" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Governance</TabsTrigger>
            <TabsTrigger value="training" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Training</TabsTrigger>
            <TabsTrigger value="recognition" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Recognition</TabsTrigger>
            <TabsTrigger value="applications" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Applications</TabsTrigger>
            <TabsTrigger value="meetings" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />Meetings</TabsTrigger>
            <TabsTrigger value="membership" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Membership</TabsTrigger>
            <TabsTrigger value="platform" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Platform</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Activity} label="Activities" value={act?.total ?? 0} />
                <StatCard icon={FileText} label="Documents" value={Object.values(doc ?? {}).reduce((a: number, b: any) => a + (b as number), 0)} />
                <StatCard icon={Calendar} label="Events" value={evt?.total ?? 0} />
                <StatCard icon={Building} label="Chapters" value={ch?.total ?? 0} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={DollarSign} label="Transactions" value={fin?.transactions ?? 0} color="bg-amber-500/10" />
                <StatCard icon={FolderKanban} label="Projects" value={proj?.projects ?? 0} color="bg-blue-500/10" />
                <StatCard icon={CheckCircle2} label="Completed Tasks" value={proj?.completedTasks ?? 0} color="bg-green-500/10" />
                <StatCard icon={TrendingUp} label="Notifications Sent" value={comm?.sent ?? 0} color="bg-purple-500/10" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModuleSection title="Activities (§61-70)" description="Workshops, seminars, NEF/NRF, community service" icon={Activity} count={act?.total ?? 0} />
                <ModuleSection title="Documents (§54-58)" description="Policy library, versioning, approval workflows" icon={FileText} count={Object.values(doc ?? {}).reduce((a: number, b: any) => a + (b as number), 0)} color="bg-blue-500/10" />
                <ModuleSection title="Events (§78-82)" description="Conferences, assemblies, check-in, certificates" icon={Calendar} count={evt?.total ?? 0} color="bg-indigo-500/10" />
                <ModuleSection title="Chapters (§21-27)" description="LC management, lifecycle, leadership, compliance" icon={Building} count={ch?.total ?? 0} color="bg-violet-500/10" />
                <ModuleSection title="Finance (§120-126)" description="Budgets, expenses, procurement, financial controls" icon={DollarSign} count={fin?.transactions ?? 0} color="bg-amber-500/10" />
                <ModuleSection title="Communications (§83-88)" description="Announcements, notifications, templates, email queue" icon={MessageSquare} count={(comm?.sent ?? 0) + (comm?.queued ?? 0)} color="bg-pink-500/10" />
                <ModuleSection title="Projects (§75-77)" description="Project management, tasks, milestones, governance" icon={FolderKanban} count={proj?.projects ?? 0} color="bg-cyan-500/10" />
              </div>
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><Activity className="h-5 w-5 text-[#106E5B]" />Activities Module</CardTitle>
                <CardDescription>§61-70: Plan, approve, execute, report, and evaluate activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]"><p className="text-2xl font-bold text-[#1B355E]">{act?.total ?? 0}</p><p className="text-xs text-[#66788D]">Total</p></div>
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{act?.active ?? 0}</p><p className="text-xs text-[#66788D]">Active</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{act?.completed ?? 0}</p><p className="text-xs text-[#66788D]">Completed</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Activity lifecycle: draft → submitted → under_review → approved → preparation → registration → in_progress → reporting → evaluation → completed</p>
                  <p>✅ Participant registration with waitlists</p>
                  <p>✅ QR attendance tracking</p>
                  <p>✅ Activity reporting and evaluation</p>
                  <p>✅ Impact/performance scoring</p>
                  <p>✅ NEF/NRF support</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><FileText className="h-5 w-5 text-[#106E5B]" />Document Management</CardTitle>
                <CardDescription>§54-58: Storage, versioning, approval, policy library, retention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-4">
                  {Object.entries(doc ?? {}).map(([status, count]) => (
                    <div key={status} className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                      <p className="text-xl font-bold text-[#1B355E]">{count as number}</p>
                      <p className="text-[10px] text-[#66788D] capitalize">{String(status).replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Document lifecycle: draft → under_review → approved → published → superseded → archived</p>
                  <p>✅ Version control with change tracking</p>
                  <p>✅ Visibility controls (public, members_only, leadership_only, private)</p>
                  <p>✅ Policy library for constitutions, bylaws, SOPs</p>
                  <p>✅ Records retention configuration</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><Calendar className="h-5 w-5 text-[#106E5B]" />Event Management</CardTitle>
                <CardDescription>§78-82: Conferences, assemblies, check-in, certificates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]"><p className="text-2xl font-bold text-[#1B355E]">{evt?.total ?? 0}</p><p className="text-xs text-[#66788D]">Total</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{evt?.upcoming ?? 0}</p><p className="text-xs text-[#66788D]">Upcoming</p></div>
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{evt?.active ?? 0}</p><p className="text-xs text-[#66788D]">Active</p></div>
                  <div className="text-center p-3 rounded-lg bg-gray-50"><p className="text-2xl font-bold text-gray-600">{evt?.completed ?? 0}</p><p className="text-xs text-[#66788D]">Completed</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Event types: conference, assembly, meeting, workshop, webinar, training, social, campaign</p>
                  <p>✅ Session management with speakers and rooms</p>
                  <p>✅ Registration with waitlists and capacity management</p>
                  <p>✅ QR/manual check-in</p>
                  <p>✅ Certificate generation based on attendance</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chapters Tab */}
          <TabsContent value="chapters">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><Building className="h-5 w-5 text-[#106E5B]" />Chapter Management</CardTitle>
                <CardDescription>§21-27: LC lifecycle, leadership, compliance, terms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-5 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]"><p className="text-2xl font-bold text-[#1B355E]">{ch?.total ?? 0}</p><p className="text-xs text-[#66788D]">Total</p></div>
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{ch?.permanent ?? 0}</p><p className="text-xs text-[#66788D]">Permanent</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{ch?.temporary ?? 0}</p><p className="text-xs text-[#66788D]">Temporary</p></div>
                  <div className="text-center p-3 rounded-lg bg-amber-50"><p className="text-2xl font-bold text-amber-700">{ch?.candidate ?? 0}</p><p className="text-xs text-[#66788D]">Candidate</p></div>
                  <div className="text-center p-3 rounded-lg bg-red-50"><p className="text-2xl font-bold text-red-700">{ch?.suspended ?? 0}</p><p className="text-xs text-[#66788D]">Suspended</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Chapter types: permanent, temporary, candidate, coordinator_institute</p>
                  <p>✅ Chapter lifecycle: application → assessment → recognition → renewal/suspension</p>
                  <p>✅ Leadership assignment with terms and succession</p>
                  <p>✅ Financial status tracking and debt management</p>
                  <p>✅ Compliance scoring</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><DollarSign className="h-5 w-5 text-[#106E5B]" />Finance Module</CardTitle>
                <CardDescription>§120-126: Budgets, expenses, procurement, financial controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">PKR {Number(fin?.totalIncome ?? 0).toLocaleString()}</p><p className="text-xs text-[#66788D]">Income</p></div>
                  <div className="text-center p-3 rounded-lg bg-red-50"><p className="text-2xl font-bold text-red-700">PKR {Number(fin?.totalExpenses ?? 0).toLocaleString()}</p><p className="text-xs text-[#66788D]">Expenses</p></div>
                  <div className="text-center p-3 rounded-lg bg-amber-50"><p className="text-2xl font-bold text-amber-700">{fin?.pendingExpenses ?? 0}</p><p className="text-xs text-[#66788D]">Pending Claims</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{fin?.activeBudgets ?? 0}</p><p className="text-xs text-[#66788D]">Active Budgets</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Budget management with line items and fiscal year tracking</p>
                  <p>✅ Transaction recording (income, expense, transfer, reimbursement)</p>
                  <p>✅ Expense claims with receipt upload and approval chain</p>
                  <p>✅ Financial controls (separate request, approval, payment permissions)</p>
                  <p>✅ Audit trail for all financial transactions</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#106E5B]" />Communication Center</CardTitle>
                <CardDescription>§83-88: Announcements, notifications, templates, email queue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{comm?.sent ?? 0}</p><p className="text-xs text-[#66788D]">Sent</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{comm?.delivered ?? 0}</p><p className="text-xs text-[#66788D]">Delivered</p></div>
                  <div className="text-center p-3 rounded-lg bg-red-50"><p className="text-2xl font-bold text-red-700">{comm?.failed ?? 0}</p><p className="text-xs text-[#66788D]">Failed</p></div>
                  <div className="text-center p-3 rounded-lg bg-amber-50"><p className="text-2xl font-bold text-amber-700">{comm?.queued ?? 0}</p><p className="text-xs text-[#66788D]">Queued</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Multi-channel: in-app, email, SMS, push</p>
                  <p>✅ Announcement system with audience targeting</p>
                  <p>✅ Notification templates with variables</p>
                  <p>✅ Email queue with retries and delivery tracking</p>
                  <p>✅ Notification preferences per member</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><FolderKanban className="h-5 w-5 text-[#106E5B]" />Project & Task Management</CardTitle>
                <CardDescription>§75-77: Projects, tasks, milestones, governance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]"><p className="text-2xl font-bold text-[#1B355E]">{proj?.projects ?? 0}</p><p className="text-xs text-[#66788D]">Projects</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{proj?.tasks ?? 0}</p><p className="text-xs text-[#66788D]">Tasks</p></div>
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{proj?.completedTasks ?? 0}</p><p className="text-xs text-[#66788D]">Completed</p></div>
                  <div className="text-center p-3 rounded-lg bg-red-50"><p className="text-2xl font-bold text-red-700">{proj?.overdueTasks ?? 0}</p><p className="text-xs text-[#66788D]">Overdue</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Project lifecycle: draft → planning → active → on_hold → completed</p>
                  <p>✅ Task management: todo → in_progress → review → done</p>
                  <p>✅ Assignment, due dates, priorities, tags</p>
                  <p>✅ Progress tracking and budget management</p>
                  <p>✅ Project governance with approval workflows</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Disciplinary (§116)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Conflict resolution, misconduct, investigation, hearings</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Safeguarding (§117)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Incident reporting, designated officers, escalation</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Feedback (§118)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Complaints, suggestions, service requests, satisfaction</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Helpdesk (§119)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Ticketing, SLA tracking, resolution workflows</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Inventory (§125)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Assets, equipment, checkout/return, maintenance</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Travel (§126)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Travel requests, approval, reimbursement</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Volunteers (§127)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Opportunities, signups, hour tracking</p><p className="text-lg font-bold text-[#1B355E] mt-2">{Object.values(volStats.data ?? {}).reduce((a: number, b: any) => a + (b as number), 0)}</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">MFA (§35)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">TOTP, recovery codes, verification logs</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Impersonation (§33)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Admin impersonation with full audit trail</p></CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><Activity className="h-5 w-5 text-[#106E5B]" />Training & Skills</CardTitle>
                <CardDescription>§128-129: LMS, courses, enrollment, skills registry</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4 mb-4">
                  {Object.entries(trainStats.data ?? {}).map(([key, val]) => (
                    <div key={key} className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                      <p className="text-2xl font-bold text-[#1B355E]">{val as number}</p>
                      <p className="text-xs text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                    </div>
                  ))}
                  {Object.keys(trainStats.data ?? {}).length === 0 && <p className="text-sm text-[#66788D]">No courses yet</p>}
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Course types: self_paced, instructor_led, hybrid, workshop</p>
                  <p>✅ Enrollment and progress tracking</p>
                  <p>✅ Scoring with configurable passing threshold</p>
                  <p>✅ Skills registry with proficiency levels and endorsements</p>
                  <p>✅ Certificate generation on completion</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recognition Tab */}
          <TabsContent value="recognition">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#106E5B]" />Recognition System</CardTitle>
                <CardDescription>§130: Awards, nominations, judging, certificates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  {Object.entries(awardStats.data ?? {}).map(([key, val]) => (
                    <div key={key} className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                      <p className="text-2xl font-bold text-[#1B355E]">{val as number}</p>
                      <p className="text-xs text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                    </div>
                  ))}
                  {Object.keys(awardStats.data ?? {}).length === 0 && <p className="text-sm text-[#66788D]">No awards yet</p>}
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Award categories: excellence, service, leadership, innovation, humanitarian, academic</p>
                  <p>✅ Nomination workflow with justification</p>
                  <p>✅ Judging/decision with audit trail</p>
                  <p>✅ Frequency: annual, quarterly, one-time</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><FileText className="h-5 w-5 text-[#106E5B]" />Application Platform</CardTitle>
                <CardDescription>§49-53: Application definitions, submissions, review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  {Object.entries(appStats.data ?? {}).map(([key, val]) => (
                    <div key={key} className="text-center p-3 rounded-lg bg-[#F0FAF7]">
                      <p className="text-2xl font-bold text-[#1B355E]">{val as number}</p>
                      <p className="text-xs text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                    </div>
                  ))}
                  {Object.keys(appStats.data ?? {}).length === 0 && <p className="text-sm text-[#66788D]">No applications yet</p>}
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Application types: membership, leadership, event, project, custom</p>
                  <p>✅ Configurable form schemas per definition</p>
                  <p>✅ Submission inbox with review workflow</p>
                  <p>✅ Conflict of interest tracking</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings">
            <Card className="card-cinematic">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2"><Calendar className="h-5 w-5 text-[#106E5B]" />Meetings & Committees</CardTitle>
                <CardDescription>§113-115: Board meetings, committee sessions, workspaces</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#F0FAF7]"><p className="text-2xl font-bold text-[#1B355E]">{Object.values(mtgStats.data ?? {}).reduce((a: number, b: any) => a + (b as number), 0)}</p><p className="text-xs text-[#66788D]">Total Meetings</p></div>
                  <div className="text-center p-3 rounded-lg bg-green-50"><p className="text-2xl font-bold text-green-700">{mtgStats.data?.completed ?? 0}</p><p className="text-xs text-[#66788D]">Completed</p></div>
                  <div className="text-center p-3 rounded-lg bg-blue-50"><p className="text-2xl font-bold text-blue-700">{mtgStats.data?.scheduled ?? 0}</p><p className="text-xs text-[#66788D]">Scheduled</p></div>
                </div>
                <div className="space-y-2 text-xs text-[#66788D]">
                  <p>✅ Meeting types: board, committee, task_force, general, special, working_group</p>
                  <p>✅ Agenda management with item statuses</p>
                  <p>✅ Minutes and decision recording</p>
                  <p>✅ Committee membership with roles and terms</p>
                  <p>✅ Quorum tracking</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Membership Tab */}
          <TabsContent value="membership">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Membership Applications (§9)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 grid-cols-3 mb-3">
                    {Object.entries(appLifecycle.data ?? {}).map(([key, val]) => (
                      <div key={key} className="text-center p-2 rounded-lg bg-[#F0FAF7]">
                        <p className="text-lg font-bold text-[#1B355E]">{val as number}</p>
                        <p className="text-[10px] text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#66788D]">Submit → Review → Approve → Activate lifecycle</p>
                </CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Onboarding (§12)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Configurable onboarding tasks, progress tracking, completion verification</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Institutions (§7)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 grid-cols-2 mb-3">
                    {Object.entries(instStats.data ?? {}).map(([key, val]) => (
                      <div key={key} className="text-center p-2 rounded-lg bg-[#F0FAF7]">
                        <p className="text-lg font-bold text-[#1B355E]">{val as number}</p>
                        <p className="text-[10px] text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#66788D]">University/college directory with LC associations</p>
                </CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Privacy Controls (§19)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Profile visibility, contact preferences, data retention settings</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Consent Management (§20)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">GDPR-style consent tracking, revocation, audit trail</p></CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Saved Filters (§60)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">Custom views, filter presets, column preferences, shared filters</p></CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platform Tab */}
          <TabsContent value="platform">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">API Platform (§135)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1 text-xs text-[#66788D]">
                    <p>✅ API key generation with prefix display</p>
                    <p>✅ Key validation and usage tracking</p>
                    <p>✅ Rate limiting (configurable per key)</p>
                    <p>✅ Revocation and expiry</p>
                    <p>✅ Usage logs with method, path, status, timing</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">External Integrations (§137)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 grid-cols-2 mb-3">
                    {Object.entries(integrStats.data ?? {}).map(([key, val]) => (
                      <div key={key} className="text-center p-2 rounded-lg bg-[#F0FAF7]">
                        <p className="text-lg font-bold text-[#1B355E]">{val as number}</p>
                        <p className="text-[10px] text-[#66788D] capitalize">{String(key).replace(/_/g, " ")}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#66788D]">Email, SMS, payment, storage, analytics, auth integrations</p>
                </CardContent>
              </Card>
              <Card className="card-cinematic">
                <CardHeader><CardTitle className="text-sm text-[#1B355E]">Import/Export (§138)</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-[#66788D]">CSV, XLSX, JSON import with mapping; PDF, CSV, XLSX export</p></CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
