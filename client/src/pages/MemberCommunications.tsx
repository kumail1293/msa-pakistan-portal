import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Bell, Megaphone, Settings, Lock, Loader2, AlertCircle, Info, Star } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberCommunications() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("announcements");

  const announcementsQuery = (trpc as any).communications?.announcements?.useQuery?.({ limit: 50 }) ?? { data: [], isLoading: false };
  const prefsQuery = (trpc as any).communications?.preferences?.useQuery?.() ?? { data: null, isLoading: false };
  const updatePrefs = (trpc as any).communications?.updatePreferences?.useMutation?.({
    onSuccess: () => toast.success("Preferences updated!"),
    onError: (err: Error) => toast.error(err.message || "Could not update preferences."),
  }) ?? { mutate: () => {}, isPending: false };

  const announcements = (announcementsQuery.data ?? []) as any[];
  const prefs = prefsQuery.data as any;

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["general", "events", "activities"]);

  // Sync prefs when loaded
  const prefsLoaded = Boolean(prefs && !prefsQuery.isLoading);
  if (prefsLoaded && prefs && !updatePrefs.isPending) {
    // We'll use initial state from prefs via useEffect-like pattern
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-amber-100 text-amber-700 border-amber-200";
      case "medium": return "bg-blue-100 text-blue-700 border-blue-200";
      case "low": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-[#E7F4F0] text-[#106E5B] border-[#A8D8CD]";
    }
  };

  const getPriorityIcon = (priority: string | null) => {
    switch (priority) {
      case "urgent": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "high": return <Star className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-[#138A73]" />;
    }
  };

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case "event": return "📅";
      case "activity": return "🎯";
      case "election": return "🗳️";
      case "finance": return "💰";
      case "urgent": return "🚨";
      default: return "📢";
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSavePreferences = () => {
    updatePrefs.mutate({
      emailEnabled,
      smsEnabled,
      pushEnabled,
      categories: selectedCategories,
    });
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view announcements</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Stay updated with MSAP announcements after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/communications")} className="msap-primary-action mt-6 px-8 text-white">
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Stay informed</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Communications</h1>
          <p className="mt-2 text-[#66788D]">Announcements, updates, and your notification preferences</p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
            <TabsTrigger value="announcements">
              <Megaphone className="mr-2 h-4 w-4" /> Announcements
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Settings className="mr-2 h-4 w-4" /> Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            {announcementsQuery.isLoading ? (
              <Card className="msap-card py-16 text-center">
                <CardContent>
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
                  <p className="text-[#5D7086]">Loading announcements...</p>
                </CardContent>
              </Card>
            ) : announcements.length === 0 ? (
              <Card className="msap-card py-12 text-center">
                <CardContent>
                  <Bell className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                  <h3 className="text-lg font-semibold text-[#1B355E]">No announcements yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                    Announcements from the MSAP leadership will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann: any) => (
                  <Card key={ann.id} className="msap-card msap-card-hover">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F0] text-lg">
                          {getTypeIcon(ann.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-[#1B355E]">{ann.title}</h3>
                            {ann.priority && (
                              <Badge className={`border ${getPriorityColor(ann.priority)}`}>
                                <div className="flex items-center gap-1">
                                  {getPriorityIcon(ann.priority)}
                                  {ann.priority}
                                </div>
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm leading-6 text-[#5D7086]">{ann.content}</p>
                          <div className="mt-3 flex items-center gap-3 text-xs text-[#8A9BAE]">
                            <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                            {ann.type && (
                              <Badge variant="outline" className="border-[#D9E4E1] text-[#66788D]">
                                {ann.type}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#344A61]">Channels</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] p-4">
                      <div>
                        <p className="font-medium text-[#1B355E]">Email Notifications</p>
                        <p className="text-xs text-[#66788D]">Receive updates via email</p>
                      </div>
                      <Checkbox
                        checked={emailEnabled}
                        onCheckedChange={(v) => setEmailEnabled(Boolean(v))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] p-4">
                      <div>
                        <p className="font-medium text-[#1B355E]">SMS Notifications</p>
                        <p className="text-xs text-[#66788D]">Get text messages for urgent updates</p>
                      </div>
                      <Checkbox
                        checked={smsEnabled}
                        onCheckedChange={(v) => setSmsEnabled(Boolean(v))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] p-4">
                      <div>
                        <p className="font-medium text-[#1B355E]">Push Notifications</p>
                        <p className="text-xs text-[#66788D]">In-app notification alerts</p>
                      </div>
                      <Checkbox
                        checked={pushEnabled}
                        onCheckedChange={(v) => setPushEnabled(Boolean(v))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#344A61]">Categories</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["general", "events", "activities", "elections", "finance", "governance"].map((cat) => (
                      <div key={cat} className="flex items-center gap-3 rounded-xl border border-[#E7EFEC] p-3">
                        <Checkbox
                          checked={selectedCategories.includes(cat)}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        <Label className="cursor-pointer text-sm text-[#1B355E] capitalize">{cat}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleSavePreferences}
                  disabled={updatePrefs.isPending}
                  className="msap-primary-action w-full text-white disabled:opacity-50"
                >
                  {updatePrefs.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
