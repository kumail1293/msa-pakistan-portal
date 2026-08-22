import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MSAPLogo } from "@/components/MSAPLogo";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();

  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  const quickLinks = [
    { label: "Member Dashboard", path: "/dashboard" },
    { label: "Official Portal", path: "/official" },
    { label: "Activities", path: "/activities" },
    { label: "Events", path: "/events" },
    { label: "Governance", path: "/governance" },
  ];

  return (
    <div className="msap-page flex min-h-screen w-full items-center justify-center px-4">
      <Card className="msap-card w-full max-w-lg shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
        <CardContent className="pb-8 pt-8 text-center">
          <MSAPLogo variant="horizontal-compact" tone="brand" className="mx-auto w-56" />

          <div className="mt-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-red-100" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-[#1B355E]">404</h1>

          <h2 className="mt-2 text-xl font-semibold text-[#1B355E]">Page Not Found</h2>

          <p className="mb-6 mt-3 leading-relaxed text-[#5D7086]">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {canGoBack && (
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="border-[#BFD4CD] px-6 py-2.5 text-[#106E5B] hover:bg-[#E7F4F0]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
            <Button
              onClick={() => setLocation("/")}
              className="msap-primary-action px-6 py-2.5 text-white transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>

          <div className="mt-6 border-t border-[#E7EFEC] pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8A9BAE]">Quick links</p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => setLocation(link.path)}
                  className="rounded-lg border border-[#D9E4E1] bg-white px-3 py-1.5 text-xs font-medium text-[#1B355E] transition-colors hover:border-[#A8D8CD] hover:bg-[#F0F5F3]"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
