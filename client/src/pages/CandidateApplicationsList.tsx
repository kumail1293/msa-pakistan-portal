import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Eye, Download } from "lucide-react";

export default function CandidateApplicationsList() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const applications = { data: [] }; // TODO: Implement applications list

  if (!user || user.role === "admin") {
    navigate("/");
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Interview Scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Selected":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Rejected":
        return "bg-red-100 text-red-700 border-red-200";
      case "No-Show":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "Clarify":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="msap-page min-h-screen py-8 px-4">
      <div className="container max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <FileText className="h-8 w-8 text-[#106E5B]" />
              My Applications
            </h1>
            <p className="text-[#66788D]">Track your application status and interview schedule</p>
          </div>
          <Button className="btn-primary" onClick={() => navigate("/candidate/apply")}>
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </div>

        {/* Applications List */}
        {applications.data && applications.data.length > 0 ? (
          <div className="space-y-4">
            {applications.data.map((app: any) => (
              <Card key={app.id} className="card-cinematic hover:border-[#A8D8CD] transition">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[#1B355E]">Application #{app.id}</h3>
                        <Badge variant="outline" className={`border ${getStatusColor(app.status)}`}>
                          {app.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Position {app.positionId} • Applied {new Date(app.appliedAt).toLocaleDateString()}
                      </p>

                      {/* Status Timeline */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#138A73]"></span>
                        {app.status === "Pending" && "Awaiting review"}
                        {app.status === "Interview Scheduled" && "Interview scheduled"}
                        {app.status === "Selected" && "Congratulations! You've been selected"}
                        {app.status === "Rejected" && "Application reviewed"}
                        {app.status === "No-Show" && "Interview not attended"}
                        {app.status === "Clarify" && "Additional information requested"}
                      </div>

                      {/* Key Dates */}
                      {app.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last updated: {new Date(app.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/candidate/applications/${app.id}`)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      {app.status === "Selected" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 text-accent hover:text-accent/80"
                        >
                          <Download className="h-4 w-4" />
                          Documents
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="card-cinematic">
            <CardContent className="pt-12 pb-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-[#1B355E] mb-2">No Applications Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start your journey by submitting your first application
              </p>
              <Button className="btn-primary" onClick={() => navigate("/candidate/apply")}>
                <Plus className="h-4 w-4 mr-2" />
                Submit Application
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="card-cinematic mt-8">
          <CardHeader>
            <CardTitle className="text-base">Application Status Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <Badge variant="outline" className="border-yellow-300 text-yellow-800 flex-shrink-0">
                Pending
              </Badge>
              <span>Your application is under review by the recruitment team.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-blue-300 text-blue-700 flex-shrink-0">
                Interview
              </Badge>
              <span>You've been selected for an interview. Check your email for details.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 flex-shrink-0">
                Selected
              </Badge>
              <span>Congratulations! You've been selected. Your appointment letter is ready.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-red-300 text-red-700 flex-shrink-0">
                Rejected
              </Badge>
              <span>Unfortunately, you were not selected. You can apply for other positions.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-violet-300 text-violet-700 flex-shrink-0">
                No-Show
              </Badge>
              <span>You did not attend your scheduled interview.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-orange-300 text-orange-800 flex-shrink-0">
                Clarify
              </Badge>
              <span>We need additional information. Please check your email.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
