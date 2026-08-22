import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import MemberLayout from "./components/MemberLayout";
import OfficialLayout from "./components/OfficialLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import MemberDashboard from "./pages/MemberDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCardQueue from "./pages/AdminCardQueue";
import AdminConfig from "./pages/AdminConfig";
import AdminFeatureFlags from "./pages/AdminFeatureFlags";
import AdminAudit from "./pages/AdminAudit";
import AdminLifecycle from "./pages/AdminLifecycle";
import MembershipForm from "./pages/MembershipForm";
import Opportunities from "./pages/Opportunities";
import Voting from "./pages/Voting";
import CVMaker from "./pages/CVMaker";
import MemberDirectory from "./pages/MemberDirectory";
import Documents from "./pages/Documents";
import SettingsPage from "./pages/Settings";
import MembershipCardGenerator from "./pages/MembershipCardGenerator";
import MembershipSubmitted from "./pages/MembershipSubmitted";
import Login from "./pages/Login";
import OfficialLogin from "./pages/OfficialLogin";
import OfficialHome from "./pages/OfficialHome";
import OfficialsManagement from "./pages/OfficialsManagement";
import AdminGovernanceConfig from "./pages/AdminGovernanceConfig";
import AdminGovernanceDashboard from "./pages/AdminGovernanceDashboard";
import GovernanceTransparency from "./pages/GovernanceTransparency";
// PublicLanding moved to WordPress public website (msapakistan.org)
import AdminModules from "./pages/AdminModules";
import AdminActivities from "./pages/AdminActivities";
import AdminEvents from "./pages/AdminEvents";
import AdminElections from "./pages/AdminElections";
import AdminFinance from "./pages/AdminFinance";
import AdminDocuments from "./pages/AdminDocuments";
import AdminCommunications from "./pages/AdminCommunications";
import MemberActivities from "./pages/MemberActivities";
import MemberEvents from "./pages/MemberEvents";
import MemberElections from "./pages/MemberElections";
import MemberFinance from "./pages/MemberFinance";
import MemberCommunications from "./pages/MemberCommunications";
import AdminPlenary from "./pages/AdminPlenary";
import AdminNEF from "./pages/AdminNEF";
import MemberPlenary from "./pages/MemberPlenary";
import MemberNEF from "./pages/MemberNEF";
import SetPassword from "./pages/SetPassword";
import VerifyCard from "./pages/VerifyCard";
import SSOCallback from "./pages/SSOCallback";

function Router() {
  return (
    <Switch>
      {/* Member Portal Routes */}
      <Route path="/" component={Home} />
      <Route path={"/login"} component={Login} />
      {/* Official Portal has its OWN sign-in pathway — members and officials
          never share a login form. Officials are provisioned by the Super
          Admin only; there is no sign-up anywhere. */}
      <Route path={"/official/login"} component={OfficialLogin} />
      <Route path={"/set-password"} component={SetPassword} />
      <Route path={"/verify"} component={VerifyCard} />
      {/* SSO Callback from WordPress */}
      <Route path={"/sso/callback"} component={SSOCallback} />

      {/* Member Routes (shared sidebar shell) — public visitors only get the
          landing page, sign in, set-password and the membership form */}
      <Route path={"/join"} component={MembershipForm} />
      <Route path={"/membership"} component={MembershipForm} />
      <Route path={"/membership/submitted"} component={MembershipSubmitted} />

      <Route path={"/dashboard"}>
        <MemberLayout>
          <MemberDashboard />
        </MemberLayout>
      </Route>
      <Route path={"/opportunities"}>
        <MemberLayout>
          <Opportunities />
        </MemberLayout>
      </Route>
      <Route path={"/voting"}>
        <MemberLayout>
          <Voting />
        </MemberLayout>
      </Route>
      <Route path={"/cv-maker"}>
        <MemberLayout>
          <CVMaker />
        </MemberLayout>
      </Route>
      <Route path={"/directory"}>
        <MemberLayout>
          <MemberDirectory />
        </MemberLayout>
      </Route>
      <Route path={"/documents"}>
        <MemberLayout>
          <Documents />
        </MemberLayout>
      </Route>
      <Route path={"/activities"}>
        <MemberLayout>
          <MemberActivities />
        </MemberLayout>
      </Route>
      <Route path={"/events"}>
        <MemberLayout>
          <MemberEvents />
        </MemberLayout>
      </Route>
      <Route path={"/elections"}>
        <MemberLayout>
          <MemberElections />
        </MemberLayout>
      </Route>
      <Route path={"/plenary"}>
        <MemberLayout>
          <MemberPlenary />
        </MemberLayout>
      </Route>
      <Route path={"/nef-nrf"}>
        <MemberLayout>
          <MemberNEF />
        </MemberLayout>
      </Route>
      <Route path={"/finance"}>
        <MemberLayout>
          <MemberFinance />
        </MemberLayout>
      </Route>
      <Route path={"/communications"}>
        <MemberLayout>
          <MemberCommunications />
        </MemberLayout>
      </Route>
      <Route path={"/settings"}>
        <MemberLayout>
          <SettingsPage />
        </MemberLayout>
      </Route>
      <Route path={"/membership-card"}>
        <MemberLayout>
          <MembershipCardGenerator />
        </MemberLayout>
      </Route>

      {/* Official Portal Routes — a distinct shell from the member portal.
          The layout guards access: members are pushed to /dashboard and
          unauthenticated visitors to /official/login. */}
      <Route path={"/official"}>
        <OfficialLayout>
          <OfficialHome />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/dashboard"}>
        <OfficialLayout>
          <AdminDashboard />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/cards"}>
        <OfficialLayout>
          <AdminCardQueue />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/config"}>
        <OfficialLayout>
          <AdminConfig />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/feature-flags"}>
        <OfficialLayout>
          <AdminFeatureFlags />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/audit"}>
        <OfficialLayout>
          <AdminAudit />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/lifecycle"}>
        <OfficialLayout>
          <AdminLifecycle />
        </OfficialLayout>
      </Route>
      {/* Super Admin only (server-enforced too). */}
      <Route path={"/admin/officials"}>
        <OfficialLayout>
          <OfficialsManagement />
        </OfficialLayout>
      </Route>
      <Route path={"/governance"} component={GovernanceTransparency} />
      <Route path={"/admin/modules"}>
        <OfficialLayout>
          <AdminModules />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/governance"}>
        <OfficialLayout>
          <AdminGovernanceDashboard />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/governance-config"}>
        <OfficialLayout>
          <AdminGovernanceConfig />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/activities"}>
        <OfficialLayout>
          <AdminActivities />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/events"}>
        <OfficialLayout>
          <AdminEvents />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/elections"}>
        <OfficialLayout>
          <AdminElections />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/finance"}>
        <OfficialLayout>
          <AdminFinance />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/documents"}>
        <OfficialLayout>
          <AdminDocuments />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/communications"}>
        <OfficialLayout>
          <AdminCommunications />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/plenary"}>
        <OfficialLayout>
          <AdminPlenary />
        </OfficialLayout>
      </Route>
      <Route path={"/admin/nef-nrf"}>
        <OfficialLayout>
          <AdminNEF />
        </OfficialLayout>
      </Route>

      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
