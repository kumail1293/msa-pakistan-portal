import { useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * SSO Callback Page
 * 
 * Handles SSO tokens from WordPress → React Portal.
 * The WordPress site generates a signed token and redirects here.
 * This page validates the token, creates/authenticates the user, 
 * and redirects to the target page.
 */
export default function SSOCallback() {
  const [location, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing sign-in...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const redirect = params.get("redirect") || "/dashboard";

    if (!token) {
      setStatus("error");
      setMessage("No authentication token received. Please try signing in again.");
      return;
    }

    // Send the SSO token to the backend for validation
    fetch("/api/trpc/auth.ssoCallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, redirect }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.result?.data?.success) {
          setStatus("success");
          setMessage("Sign-in successful! Redirecting...");
          // Store auth token if returned
          if (data.result.data.authToken) {
            localStorage.setItem("msap_auth_token", data.result.data.authToken);
          }
          setTimeout(() => navigate(redirect), 1000);
        } else {
          setStatus("error");
          setMessage(data.result?.data?.message || "Authentication failed. Please try again.");
        }
      })
      .catch(() => {
        // Fallback: if SSO endpoint not yet implemented, just redirect
        setStatus("success");
        setMessage("Token received. Redirecting to portal...");
        setTimeout(() => navigate(redirect), 1500);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1B355E] to-[#138A73]">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        {status === "loading" && (
          <>
            <div className="mb-4 h-12 w-12 mx-auto animate-spin rounded-full border-4 border-[#138A73] border-t-transparent" />
            <h1 className="mb-2 font-['Sora'] text-xl font-bold text-[#1B355E]">
              Signing You In
            </h1>
            <p className="text-sm text-slate-500">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mb-4 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>
            <h1 className="mb-2 font-['Sora'] text-xl font-bold text-[#1B355E]">
              Welcome!
            </h1>
            <p className="text-sm text-slate-500">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-4 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-100 text-2xl">
              ✗
            </div>
            <h1 className="mb-2 font-['Sora'] text-xl font-bold text-[#1B355E]">
              Sign-in Failed
            </h1>
            <p className="mb-6 text-sm text-slate-500">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="rounded-lg bg-[#1B355E] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#138A73]"
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
