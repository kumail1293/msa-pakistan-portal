import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Calendar, Clock, Users, Video, Mail } from "lucide-react";

const interviewSchema = z.object({
  applicationId: z.number().min(1, "Please select an application"),
  scheduledAt: z.string().min(1, "Please select date and time"),
  interviewerEmails: z.string().min(1, "Please enter at least one interviewer email"),
  ccEmails: z.string().optional(),
  notes: z.string().optional(),
  meetingType: z.enum(["Google Meet", "Zoom", "Phone", "In-Person"]),
});

type InterviewFormData = z.infer<typeof interviewSchema>;

export default function InterviewScheduling() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const applications = { data: [] }; // TODO: Implement application list
  const scheduleInterview = { mutateAsync: async () => ({ interviewId: 1 }) }; // TODO: Implement interview scheduling

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
  });

  const selectedApplicationId = watch("applicationId");
  const meetingType = watch("meetingType");

  const onSubmit = async (data: InterviewFormData) => {
    try {
      const result = await (scheduleInterview.mutateAsync as any)({
        applicationId: data.applicationId,
        scheduledAt: new Date(data.scheduledAt),
        interviewerEmail: data.interviewerEmails.split(",")[0].trim(),
      });

      toast.success("Interview scheduled successfully!");
      navigate(`/admin/interviews/${result.interviewId}`);
    } catch (error) {
      toast.error("Failed to schedule interview. Please try again.");
    }
  };

  // Wait for the session before deciding access — otherwise the first render
  // (user still undefined) redirects admins to "/".
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  if (!user || !canAccessModule(user, "interviews")) {
    navigate("/official");
    return null;
  }

  return (
    <div className="py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-[#106E5B]" />
            Schedule Interview
          </h1>
          <p className="text-[#66788D]">Schedule a new interview with candidates</p>
        </div>

        <Card className="card-cinematic">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Application Selection */}
              <div className="space-y-2">
                <Label htmlFor="applicationId" className="text-foreground font-semibold">
                  Select Application *
                </Label>
                <Select onValueChange={(value) => setValue("applicationId", parseInt(value))}>
                  <SelectTrigger className="input-cinematic">
                    <SelectValue placeholder="Choose an application" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.data?.map((app: any) => (
                      <SelectItem key={app.id} value={app.id.toString()}>
                        Application #{app.id} - Candidate {app.candidateId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.applicationId && (
                  <p className="text-destructive text-sm">{errors.applicationId.message}</p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt" className="text-foreground font-semibold">
                    Date & Time *
                  </Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    className="input-cinematic"
                    {...register("scheduledAt")}
                  />
                  {errors.scheduledAt && (
                    <p className="text-destructive text-sm">{errors.scheduledAt.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meetingType" className="text-foreground font-semibold">
                    Meeting Type *
                  </Label>
                  <Select onValueChange={(value) => setValue("meetingType", value as any)}>
                    <SelectTrigger className="input-cinematic">
                      <SelectValue placeholder="Select meeting type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google Meet">Google Meet</SelectItem>
                      <SelectItem value="Zoom">Zoom</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="In-Person">In-Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Meeting Type Info */}
              {meetingType && (
                <div className="bg-[#F6F9F8] border border-[#E7EFEC] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    {meetingType === "Google Meet" && <Video className="h-5 w-5 text-[#106E5B] mt-1" />}
                    {meetingType === "Zoom" && <Video className="h-5 w-5 text-[#106E5B] mt-1" />}
                    {meetingType === "Phone" && <Phone className="h-5 w-5 text-[#106E5B] mt-1" />}
                    {meetingType === "In-Person" && <Users className="h-5 w-5 text-[#106E5B] mt-1" />}
                    <div>
                      <p className="font-semibold text-[#1B355E]">{meetingType} Interview</p>
                      <p className="text-sm text-muted-foreground">
                        {meetingType === "Google Meet" && "A Google Meet link will be automatically generated and shared with participants."}
                        {meetingType === "Zoom" && "Please provide Zoom meeting details in the notes section."}
                        {meetingType === "Phone" && "Ensure all participants have the phone number in the interview invitation."}
                        {meetingType === "In-Person" && "Provide location details in the notes section."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Interviewer Emails */}
              <div className="space-y-2">
                <Label htmlFor="interviewerEmails" className="text-foreground font-semibold">
                  Interviewer Emails * <span className="text-xs text-muted-foreground">(comma-separated)</span>
                </Label>
                <Input
                  id="interviewerEmails"
                  type="text"
                  placeholder="interviewer1@example.com, interviewer2@example.com"
                  className="input-cinematic"
                  {...register("interviewerEmails")}
                />
                {errors.interviewerEmails && (
                  <p className="text-destructive text-sm">{errors.interviewerEmails.message}</p>
                )}
              </div>

              {/* CC Emails */}
              <div className="space-y-2">
                <Label htmlFor="ccEmails" className="text-foreground font-semibold">
                  CC Emails (Optional) <span className="text-xs text-muted-foreground">(comma-separated)</span>
                </Label>
                <Input
                  id="ccEmails"
                  type="text"
                  placeholder="cc@example.com"
                  className="input-cinematic"
                  {...register("ccEmails")}
                />
              </div>

              {/* Interview Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground font-semibold">
                  Interview Notes (Optional)
                </Label>
                <textarea
                  id="notes"
                  placeholder="Add any specific instructions, location details, or interview guidelines..."
                  className="input-cinematic min-h-32"
                  {...register("notes")}
                />
              </div>

              {/* Pre-Interview Screening */}
              <div className="bg-[#F6F9F8] border border-[#E7EFEC] rounded-xl p-4">
                <h3 className="font-semibold text-[#1B355E] mb-3">Pre-Interview Screening Notes</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Interviewers will have access to the candidate's application and screening notes before the interview.
                </p>
                <div className="space-y-2">
                <p className="text-xs text-[#106E5B] font-semibold">Key Points to Review:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Candidate's resume and qualifications</li>
                    <li>Application responses and cover letter</li>
                    <li>Any previous screening feedback</li>
                    <li>Position requirements and responsibilities</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "Scheduling..." : "Schedule Interview"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/admin/interviews")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="card-cinematic mt-8">
          <CardHeader>
            <CardTitle className="text-base">Interview Scheduling Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">• Schedule in advance:</strong> Provide at least 48 hours notice to candidates and interviewers.
            </p>
            <p>
              <strong className="text-foreground">• Confirm details:</strong> Ensure all participants have the correct date, time, and meeting link.
            </p>
            <p>
              <strong className="text-foreground">• Prepare interviewers:</strong> Share candidate information and interview guidelines beforehand.
            </p>
            <p>
              <strong className="text-foreground">• Follow up:</strong> Send interview feedback forms immediately after the interview.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Phone({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}
