import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Upload, ArrowLeft } from "lucide-react";

const applicationSchema = z.object({
  localCouncilId: z.number().min(1, "Please select a Local Council"),
  positionId: z.number().min(1, "Please select a Position"),
  resumeUrl: z.string().optional(),
  resumeKey: z.string().optional(),
  coverLetterUrl: z.string().optional(),
  coverLetterKey: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function CandidateApplicationForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);

  const localCouncils = { data: [] }; // TODO: Implement
  const positions = { data: [] }; // TODO: Implement
  const createApplication = { mutateAsync: async () => ({}) }; // TODO: Implement

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
  });

  const selectedPositionId = watch("positionId");

  const onSubmit = async (data: ApplicationFormData) => {
    try {
      const result = await (createApplication.mutateAsync as any)(data);
      toast.success("Application submitted successfully!");
      navigate(`/candidate/applications/${(result as any).applicationId || 1}`);
    } catch (error) {
      toast.error("Failed to submit application. Please try again.");
    }
  };

  if (!user) return null;

  return (
    <div className="msap-page min-h-screen py-12 px-4">
      <div className="container max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/candidate/applications")}
          className="flex items-center gap-2 text-[#106E5B] hover:text-[#0B4E40] mb-8 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </button>

        <Card className="card-cinematic">
          <CardHeader>
            <CardTitle className="text-3xl text-[#1B355E]">Submit Application</CardTitle>
            <CardDescription>
              Apply for a position with MSA Pakistan. Complete all required fields.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Local Council Selection */}
              <div className="space-y-2">
                <Label htmlFor="localCouncilId" className="text-foreground font-semibold">
                  Local Council *
                </Label>
                <Select onValueChange={(value) => setValue("localCouncilId", parseInt(value))}>
                  <SelectTrigger className="input-cinematic">
                    <SelectValue placeholder="Select your Local Council" />
                  </SelectTrigger>
                  <SelectContent>
                    {localCouncils.data?.map((lc: any) => (
                      <SelectItem key={lc.id} value={lc.id.toString()}>
                        {lc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.localCouncilId && (
                  <p className="text-destructive text-sm">{errors.localCouncilId.message}</p>
                )}
              </div>

              {/* Position Selection */}
              <div className="space-y-2">
                <Label htmlFor="positionId" className="text-foreground font-semibold">
                  Position *
                </Label>
                <Select onValueChange={(value) => setValue("positionId", parseInt(value))}>
                  <SelectTrigger className="input-cinematic">
                    <SelectValue placeholder="Select a position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.data?.map((pos: any) => (
                      <SelectItem key={pos.id} value={pos.id.toString()}>
                        {pos.title} ({pos.tier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.positionId && (
                  <p className="text-destructive text-sm">{errors.positionId.message}</p>
                )}
              </div>

              {/* Position Details */}
              {selectedPositionId && positions.data && (
                <div className="bg-[#F6F9F8] border border-[#E7EFEC] rounded-xl p-4">
                  {(() => {
                    const pos = positions.data.find((p: any) => p.id === selectedPositionId);
                    return pos ? (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-[#106E5B]">{(pos as any).title}</h4>
                        <p className="text-sm text-muted-foreground">{(pos as any).description}</p>
                        <div className="flex gap-4 text-xs">
                          <span className="badge-accent">{(pos as any).tier}</span>
                          {(pos as any).department && <span className="text-muted-foreground">{(pos as any).department}</span>}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Resume Upload */}
              <div className="space-y-2">
                <Label htmlFor="resume" className="text-foreground font-semibold">
                  Resume / CV
                </Label>
                <div className="border-2 border-dashed border-[#BFD4CD] rounded-xl p-6 text-center hover:border-[#138A73] hover:bg-[#F3FAF8] transition">
                  <Upload className="h-8 w-8 text-[#106E5B] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your resume here, or click to select
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    id="resume"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Cover Letter */}
              <div className="space-y-2">
                <Label htmlFor="coverLetter" className="text-foreground font-semibold">
                  Cover Letter (Optional)
                </Label>
                <Textarea
                  placeholder="Tell us why you're interested in this position..."
                  className="input-cinematic min-h-32"
                  disabled={isSubmitting}
                />
              </div>

              {/* Additional Documents */}
              <div className="space-y-2">
                <Label htmlFor="additionalDocs" className="text-foreground font-semibold">
                  Additional Documents (Optional)
                </Label>
                <div className="border-2 border-dashed border-[#BFD4CD] rounded-xl p-6 text-center hover:border-[#138A73] hover:bg-[#F3FAF8] transition">
                  <Upload className="h-8 w-8 text-[#106E5B] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Upload any additional supporting documents
                  </p>
                  <Input
                    type="file"
                    className="hidden"
                    id="additionalDocs"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting || uploading}
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/candidate/applications")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                By submitting this application, you agree to our terms and conditions.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
