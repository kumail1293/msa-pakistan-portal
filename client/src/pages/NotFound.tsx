import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MSAPLogo } from "@/components/MSAPLogo";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

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

          <p className="mb-8 mt-3 leading-relaxed text-[#5D7086]">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col justify-center gap-3 sm:flex-row"
          >
            <Button
              onClick={handleGoHome}
              className="msap-primary-action px-6 py-2.5 text-white transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
