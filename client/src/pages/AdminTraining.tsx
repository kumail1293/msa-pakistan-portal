import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap,
  Loader2,
  Plus,
  Search,
  BookOpen,
  Users,
  Award,
  ChevronRight,
} from "lucide-react";

export default function AdminTraining() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    category: "general",
    duration: "",
    maxEnrollments: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.training.stats.useQuery();
  const courses = adminTrpc.training.courses.useQuery({
    category: categoryFilter || undefined,
    limit: 50,
  });

  const filtered = (courses.data ?? []).filter(
    (c: any) =>
      !searchQuery ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Training & LMS</h1>
          <p className="text-sm text-[#5D7086]">
            Courses, modules, enrollment, assessments, and certificates
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} placeholder="Course title" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Category</label>
                <Select value={newCourse.category} onValueChange={(v) => setNewCourse({ ...newCourse, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="medical">Medical Education</SelectItem>
                    <SelectItem value="public_health">Public Health</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="advocacy">Advocacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Duration</label>
                <Input value={newCourse.duration} onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })} placeholder="e.g. 4 weeks" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => courses.refetch()} disabled={!newCourse.title}>
                  Create Course
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Courses", value: stats.data?.total ?? 0, icon: BookOpen, color: "text-[#138A73]" },
          { label: "Active", value: stats.data?.active ?? 0, icon: GraduationCap, color: "text-green-600" },
          { label: "Enrolled", value: stats.data?.enrolled ?? 0, icon: Users, color: "text-blue-600" },
          { label: "Completed", value: stats.data?.completed ?? 0, icon: Award, color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="leadership">Leadership</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
            <SelectItem value="public_health">Public Health</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Courses ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No courses found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((course: any) => (
                <div key={course.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{course.title}</h3>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-600">
                        {course.category}
                      </span>
                    </div>
                    {course.description && (
                      <p className="text-xs text-[#5D7086] mt-1 truncate">{course.description}</p>
                    )}
                  </div>
                  {course.duration && (
                    <span className="text-xs text-[#5D7086]">{course.duration}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
