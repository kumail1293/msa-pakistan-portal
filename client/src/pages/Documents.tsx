import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, ExternalLink, FileText, Award, FileCheck, IdCard, Lock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

type PortalDocument = {
  type: string;
  fileName: string;
  viewUrl: string;
  downloadUrl: string;
};

const TYPE_LABELS: Record<string, string> = {
  "Membership Letter": "Membership Letter",
  "Membership Card": "Membership Card",
  Certificate: "Certificate",
  CV: "CV",
  "Appointment Letter": "Appointment Letter",
  Other: "Other",
};

export default function Documents() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("all");

  const documentsQuery = trpc.member.getDocuments.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const documents = documentsQuery.data ?? [];
  const docTypes = Array.from(new Set(documents.map((d) => d.type)));

  const filteredDocuments =
    selectedTab === "all" ? documents : documents.filter((d) => d.type === selectedTab);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Membership Letter":
        return <FileText className="h-5 w-5" />;
      case "Membership Card":
        return <IdCard className="h-5 w-5" />;
      case "Certificate":
        return <Award className="h-5 w-5" />;
      default:
        return <FileCheck className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Membership Letter":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Membership Card":
        return "bg-[#E7F4F0] text-[#106E5B] border-[#A8D8CD]";
      case "Certificate":
        return "bg-violet-100 text-violet-700 border-violet-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view documents</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Your membership letter and card are only a sign-in away.
              </p>
              <Button
                onClick={() => navigate("/login?next=/documents")}
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

  const letterCount = documents.filter((d) => d.type === "Membership Letter").length;
  const credentialCount = documents.filter(
    (d) => d.type !== "Membership Letter" && d.type !== "CV"
  ).length;

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Your credentials
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            My Documents
          </h1>
          <p className="mt-2 text-[#66788D]">
            Access your membership certificates, letters, and credentials
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="msap-card">
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-[#1B355E]">{documents.length}</p>
              <p className="mt-2 text-sm text-[#66788D]">Total Documents</p>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-blue-600">{letterCount}</p>
              <p className="mt-2 text-sm text-[#66788D]">Membership Letters</p>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-[#106E5B]">{credentialCount}</p>
              <p className="mt-2 text-sm text-[#66788D]">Cards & Certificates</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Documents */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
            <TabsTrigger value="all">All Documents</TabsTrigger>
            {docTypes.map((type) => (
              <TabsTrigger key={type} value={type}>
                {TYPE_LABELS[type] ?? type}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4">
            {documentsQuery.isLoading ? (
              <Card className="msap-card py-16 text-center">
                <CardContent>
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
                  <p className="text-[#5D7086]">Loading documents...</p>
                </CardContent>
              </Card>
            ) : filteredDocuments.length === 0 ? (
              <Card className="msap-card py-12 text-center">
                <CardContent>
                  <FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                  <h3 className="text-lg font-semibold text-[#1B355E]">
                    No documents here yet
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                    Documents are issued after your membership is approved by the MSAP
                    verification team. Check back after approval.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {filteredDocuments.map((doc, index) => (
                  <Card key={`${doc.type}-${index}`} className="msap-card msap-card-hover group">
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex flex-1 items-start gap-4">
                          <div className="rounded-xl bg-[#E7F4F0] p-3 text-[#106E5B] transition-colors group-hover:bg-[#138A73] group-hover:text-white">
                            {getTypeIcon(doc.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-semibold text-[#1B355E]">
                              {doc.fileName || (TYPE_LABELS[doc.type] ?? doc.type)}
                            </h3>
                            <p className="mt-1 text-sm text-[#66788D]">{doc.type}</p>
                          </div>
                        </div>
                        <Badge className={`ml-3 shrink-0 border ${getTypeColor(doc.type)}`}>
                          {TYPE_LABELS[doc.type] ?? doc.type}
                        </Badge>
                      </div>

                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-3">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#106E5B]" />
                        <p className="text-xs text-[#5D7086]">
                          This document is securely stored and can be downloaded anytime.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="msap-btn-outline flex-1"
                          onClick={() => window.open(doc.viewUrl, "_blank")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> View
                        </Button>
                        <Button
                          className="msap-primary-action flex-1 text-white"
                          onClick={() => window.open(doc.downloadUrl, "_blank")}
                        >
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Additional Info */}
        <Card className="msap-card mt-8 bg-[linear-gradient(135deg,#F0F5F9_0%,#F8FBFA_100%)]">
          <CardHeader>
            <CardTitle className="text-[#1B355E]">Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#42566E]">
            <p>
              • <span className="font-semibold text-[#106E5B]">Membership Letters</span> and{" "}
              <span className="font-semibold text-[#106E5B]">Membership Cards</span> are issued
              through the MSAP approval workflow after your membership is verified
            </p>
            <p>
              • <span className="font-semibold text-[#106E5B]">Certificates</span> recognize your
              contributions and achievements
            </p>
            <p>• All documents are digitally signed and can be verified for authenticity</p>
            <p>
              • For any issues with document downloads, please contact support@msapakistan.org
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
