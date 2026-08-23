import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2, Clock } from "lucide-react";

export default function MemberMeetings() {
  const meetings = trpc.meetings.list.useQuery({ limit: 50 });

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Meetings</h1>
        <p className="text-sm text-[#5D7086]">
          §113-115: Board meetings, committee meetings, and agendas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Meetings ({meetings.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meetings.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (meetings.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No meetings scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(meetings.data ?? []).map((meeting: any) => (
                <div key={meeting.id} className="rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-50 p-2.5">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1B355E]">{meeting.title}</h3>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-600">
                          {meeting.type}
                        </span>
                      </div>
                      {meeting.scheduledDate && (
                        <p className="text-xs text-[#5D7086] mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(meeting.scheduledDate).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
