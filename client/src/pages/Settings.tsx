import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { User, Lock, Bell, Shield, LogOut, Save, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Settings() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const profileQuery = trpc.member.getProfile.useQuery();
  const updateProfile = trpc.member.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      profileQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Could not update your profile."),
  });
  const profile = profileQuery.data;
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phone: "",
    institution: "",
    degree: "",
    localCouncil: "",
    bio: "",
  });

  useEffect(() => {
    if (!profile) return;
    setProfileData({
      fullName: profile.name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      institution: profile.institution ?? "",
      degree: profile.degree ?? "",
      localCouncil: profile.localCouncil ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile]);

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    opportunityAlerts: true,
    votingReminders: true,
    weeklyDigest: true,
    eventInvitations: true,
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({
      name: profileData.fullName,
      phone: profileData.phone,
      bio: profileData.bio,
      institution: profileData.institution,
      degree: profileData.degree,
      localCouncil: profileData.localCouncil,
    });
  };

  const handleChangePassword = () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    toast.success("Password changed successfully!");
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (profileQuery.isLoading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Your account
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 text-[#66788D]">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="msap-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-[#1B355E]">Profile Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant="outline"
                  className="msap-btn-outline"
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                      Full Name
                    </label>
                    <Input
                      value={profileData.fullName}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, fullName: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Email</label>
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Phone</label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                      Local Council
                    </label>
                    <Input
                      value={profileData.localCouncil}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, localCouncil: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                      Institution
                    </label>
                    <Input
                      value={profileData.institution}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, institution: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Degree</label>
                    <Input
                      value={profileData.degree}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, degree: e.target.value }))}
                      disabled={!isEditing}
                      className="disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">Bio</label>
                  <Textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, bio: e.target.value }))}
                    disabled={!isEditing}
                    className="min-h-24 disabled:opacity-50"
                  />
                </div>

                {isEditing && (
                  <Button
                    onClick={handleSaveProfile}
                    className="msap-primary-action w-full text-white"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to receive updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Email Notifications</p>
                    <p className="text-sm text-[#66788D]">Receive important updates via email</p>
                  </div>
                  <Switch
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Opportunity Alerts</p>
                    <p className="text-sm text-[#66788D]">Get notified about new opportunities</p>
                  </div>
                  <Switch
                    checked={notifications.opportunityAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, opportunityAlerts: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Voting Reminders</p>
                    <p className="text-sm text-[#66788D]">Reminders for upcoming votes</p>
                  </div>
                  <Switch
                    checked={notifications.votingReminders}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, votingReminders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Weekly Digest</p>
                    <p className="text-sm text-[#66788D]">Summary of weekly activities</p>
                  </div>
                  <Switch
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, weeklyDigest: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Event Invitations</p>
                    <p className="text-sm text-[#66788D]">Invitations to MSAP events</p>
                  </div>
                  <Switch
                    checked={notifications.eventInvitations}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, eventInvitations: checked }))
                    }
                  />
                </div>

                <Button
                  onClick={() => toast.success("Notification preferences saved!")}
                  className="msap-primary-action mt-4 w-full text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Change Password</CardTitle>
                <CardDescription>Update your password regularly for security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter current password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                    New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1B355E]">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  className="msap-primary-action w-full text-white"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Logout</CardTitle>
                <CardDescription>Sign out from your account</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-100"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="text-[#1B355E]">Privacy Settings</CardTitle>
                <CardDescription>Control your privacy and visibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Profile Visibility</p>
                    <p className="text-sm text-[#66788D]">Allow other members to see your profile</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Show Contact Info</p>
                    <p className="text-sm text-[#66788D]">Display email and phone in directory</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                  <div>
                    <p className="font-semibold text-[#1B355E]">Show Position History</p>
                    <p className="text-sm text-[#66788D]">Display your past positions</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">
                    Your data is encrypted and stored securely. We never share your information with
                    third parties.
                  </p>
                </div>

                <Button
                  onClick={() => toast.success("Privacy settings saved!")}
                  className="msap-primary-action mt-4 w-full text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
