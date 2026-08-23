import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Loader2, MapPin, Users } from "lucide-react";

export default function MemberChapters() {
  const chapters = trpc.chapters.list.useQuery({ limit: 50 });

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Chapters</h1>
        <p className="text-sm text-[#5D7086]">
          Local councils and regional chapters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            All Chapters ({chapters.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chapters.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (chapters.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No chapters found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(chapters.data ?? []).map((chapter: any) => (
                <div key={chapter.id} className="rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#E7F4F0] p-2.5">
                      <Building className="h-5 w-5 text-[#138A73]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1B355E]">{chapter.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-[#5D7086] mt-1">
                        {chapter.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {chapter.city}
                          </span>
                        )}
                        {chapter.memberCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {chapter.memberCount} members
                          </span>
                        )}
                      </div>
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
