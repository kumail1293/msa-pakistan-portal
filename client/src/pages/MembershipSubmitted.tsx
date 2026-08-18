import { Link } from "wouter";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";

export default function MembershipSubmitted() {
  return (
    <main className="msap-page min-h-screen px-4 py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#E7F4F0] text-[#106E5B]">
          <CheckCircle2 size={30} />
        </div>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
          Application received
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B355E]">
          Thank you for applying to MSAP.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#5D7086]">
          Your application has been sent to the MSAP membership workflow. The verification team
          will review your information and payment documents.
        </p>
        <div className="mt-8 space-y-3 text-left">
          <div className="msap-card flex gap-3 p-4">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#106E5B]" size={19} />
            <div>
              <p className="font-semibold text-[#1B355E]">Approval comes first</p>
              <p className="mt-1 text-sm text-[#5D7086]">
                Your membership ID and membership letter are issued through the existing MSAP
                approval workflow.
              </p>
            </div>
          </div>
          <div className="msap-card flex gap-3 p-4">
            <Mail className="mt-0.5 shrink-0 text-[#106E5B]" size={19} />
            <div>
              <p className="font-semibold text-[#1B355E]">Watch your email</p>
              <p className="mt-1 text-sm text-[#5D7086]">
                After approval, you will receive a secure link to create your portal password.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="msap-primary-action rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            Back to MSAP
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-[#BFD4CD] bg-white px-5 py-3 text-sm font-semibold text-[#106E5B] transition-colors hover:bg-[#E7F4F0]"
          >
            Member login
          </Link>
        </div>
      </div>
    </main>
  );
}
