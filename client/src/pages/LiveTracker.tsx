import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Target, TrendingUp } from "lucide-react";

export default function LiveTracker() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // Wait for the session before deciding access — otherwise the first render
  // (user still undefined) redirects admins to "/".
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  const localCouncils = [
    { id: 1, name: "Karachi LC", city: "Karachi", members: 45, filled: 8 },
    { id: 2, name: "Lahore LC", city: "Lahore", members: 52, filled: 10 },
    { id: 3, name: "Islamabad LC", city: "Islamabad", members: 38, filled: 6 },
  ];

  const totalPositions = 24;
  const filledPositions = 24;
  const completionPercentage = (filledPositions / totalPositions) * 100;

  return (
    <div className="msap-page min-h-screen py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        <AdminHeader />
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2">Live Tracker</h1>
          <p className="text-[#66788D]">Real-time Local Council position tracking</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="msap-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#66788D]">Total Positions</p>
                  <p className="text-3xl font-bold text-[#1B355E]">{totalPositions}</p>
                </div>
                <Target className="w-8 h-8 text-[#138A73]" />
              </div>
            </CardContent>
          </Card>

          <Card className="msap-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#66788D]">Filled</p>
                  <p className="text-3xl font-bold text-[#1B355E]">{filledPositions}</p>
                </div>
                <Users className="w-8 h-8 text-[#138A73]" />
              </div>
            </CardContent>
          </Card>

          <Card className="msap-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#66788D]">Vacant</p>
                  <p className="text-3xl font-bold text-[#1B355E]">{totalPositions - filledPositions}</p>
                </div>
                <MapPin className="w-8 h-8 text-[#138A73]" />
              </div>
            </CardContent>
          </Card>

          <Card className="msap-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#66788D]">Completion</p>
                  <p className="text-3xl font-bold text-[#1B355E]">{Math.round(completionPercentage)}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-[#138A73]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        <Card className="msap-card mb-8">
          <CardHeader>
            <CardTitle className="text-[#1B355E]">Overall Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-sm text-[#66788D] mt-2">
              {filledPositions} of {totalPositions} positions filled
            </p>
          </CardContent>
        </Card>

        {/* Local Councils */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[#1B355E] mb-4">Local Councils</h2>
          {localCouncils.map((lc: any) => (
            <LocalCouncilCard key={lc.id} council={lc} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LocalCouncilCard({ council }: { council: any }) {
  const fillPercentage = (council.filled / 8) * 100;

  return (
    <Card className="msap-card msap-card-hover">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#1B355E]">{council.name}</h3>
            <p className="text-sm text-[#66788D]">{council.city}</p>
          </div>
          <Badge variant="outline" className="border-[#A8D8CD] text-[#106E5B]">
            {council.members} Members
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#66788D]">Positions Filled</span>
            <span className="text-[#1B355E] font-semibold">
              {council.filled} / 8
            </span>
          </div>
          <Progress value={fillPercentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
