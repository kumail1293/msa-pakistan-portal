import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Loader2 } from "lucide-react";

export default function MemberProjects() {
  const projects = trpc.projects.list.useQuery({ limit: 50 });

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Projects</h1>
        <p className="text-sm text-[#5D7086]">
          §75-77: Active projects, milestones, and tasks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Projects ({projects.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (projects.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No projects available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(projects.data ?? []).map((project: any) => (
                <div key={project.id} className="rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-50 p-2.5">
                      <FolderKanban className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1B355E]">{project.name}</h3>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-600">
                          {project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-xs text-[#5D7086] mt-1">{project.description}</p>
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
