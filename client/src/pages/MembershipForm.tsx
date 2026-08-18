import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MSAPLogo } from "@/components/MSAPLogo";
import "@/styles/msap-brand.css";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileUp,
  Info,
  LockKeyhole,
  Loader2,
  Search,
  ShieldCheck,
  UploadCloud,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

type UploadValue = { fileName: string; mimeType: string; base64: string };

type Gender = "Male" | "Female" | "Prefer not to say" | "Others";
type CourseLevel = "Undergraduate (UG)" | "Postgraduate (PG)";

type FormState = {
  email: string;
  fullName: string;
  contactNumber: string;
  dateOfBirth: string;
  age: string;
  graduationDate: string;
  cnic: string;
  gender: Gender | "";
  cityOfResidence: string;
  address: string;
  profilePhoto?: UploadValue;
  reasonForJoining: string;
  courseLevel: CourseLevel | "";
  courseOfStudy: string;
  otherCourse: string;
  yearOfStudy: string;
  institute: string;
  otherInstitute: string;
  collegeRollNumber: string;
  conflictOfInterest: string;
  conflictOrganization: string;
  conflictRole: string;
  discoverySources: string[];
  otherDiscoverySource: string;
  paymentAccountName: string;
  feeReceipt?: UploadValue;
  cnicCopy?: UploadValue;
  undertakingAccepted: boolean;
  undertakingChoice: string;
  incompleteAcknowledgement: boolean;
  termsAccepted: boolean;
  introductionAcknowledged: boolean;
};

const initialState: FormState = {
  email: "",
  fullName: "",
  contactNumber: "",
  dateOfBirth: "",
  age: "",
  graduationDate: "",
  cnic: "",
  gender: "",
  cityOfResidence: "",
  address: "",
  reasonForJoining: "",
  courseLevel: "",
  courseOfStudy: "",
  otherCourse: "",
  yearOfStudy: "",
  institute: "",
  otherInstitute: "",
  collegeRollNumber: "",
  conflictOfInterest: "No",
  conflictOrganization: "",
  conflictRole: "",
  discoverySources: [],
  otherDiscoverySource: "",
  paymentAccountName: "",
  undertakingAccepted: false,
  undertakingChoice: "",
  incompleteAcknowledgement: false,
  termsAccepted: false,
  introductionAcknowledged: false,
};

const steps = [
  { title: "Before you apply", short: "Start", icon: Info },
  { title: "Personal details", short: "Personal", icon: UserRound },
  { title: "Academic details", short: "Academic", icon: FileCheck2 },
  { title: "Payment", short: "Payment", icon: WalletCards },
  { title: "Documents & undertaking", short: "Documents", icon: ShieldCheck },
  { title: "Review & submit", short: "Review", icon: CheckCircle2 },
];

const discoveryOptions = [
  "Social Media",
  "Institute",
  "Local Council / LC President",
  "Friends / Family / Colleagues",
  "Other",
];

const courseOptions = [
  "Bachelor of Medicine and Bachelor of Surgery (MBBS)",
  "Bachelor of Dental Surgery (BDS)",
  "Doctor of Physical Therapy (DPT)",
  "Bachelor of Pharmacy (BPharm)",
  "Medical Lab Technician (MLT)",
  "Bachelor of Science in Nursing (BSN)",
  "MS or MD",
  "House Officer (HO)",
  "Postgraduate Resident (PGR)",
  "Other",
];

const yearOptions = ["1st year", "2nd year", "3rd year", "4th year", "5th year", "Other"];

// Transcribed from the attached MSAP National Membership Form, pages 7–12.
const collegeOptions = [
  "Abbottabad International Medical College, Abbottabad",
  "Abu Umara Medical and Dental College, Lahore",
  "Abwa Medical College, Faisalabad",
  "Aga Khan University Medical College, Karachi",
  "Akhtar Saeed Medical College, Lahore",
  "Akhtar Saeed Medical College, Rawalpindi",
  "Al-Aleem Medical College, Lahore",
  "Al-Nafees Medical College, Islamabad",
  "Al-Razi Medical College, Peshawar",
  "Al-Tibri Medical College, Karachi",
  "Allama Iqbal Medical College, Lahore",
  "Ameer Uddin Medical College, Lahore",
  "Amna Inayat Medical College, Sheikhupura",
  "Army Medical College, Rawalpindi",
  "Avicenna Medical College, Lahore",
  "Ayub Medical College, Abbottabad",
  "Azad Jammu Kashmir Medical College, Muzaffarabad",
  "Aziz Fatima Medical and Dental College, Faisalabad",
  "Azra Naheed Medical College, Lahore",
  "Bacha Khan Medical College, Mardan",
  "Bahria University Health Sciences Campus, Karachi",
  "Bakhtawar Amin Medical and Dental College, Multan",
  "Bannu Medical College, Bannu",
  "Baqai Medical College, Karachi",
  "Bolan University of Medical & Health Sciences, Quetta",
  "CMH Institute of Medical Sciences, Bahawalpur",
  "CMH Kharian Medical College, Kharian",
  "CMH Lahore Medical College, Lahore",
  "CMH Multan Institute of Medical Sciences, Multan",
  "Central Park Medical College, Lahore",
  "Chandka Medical College, Larkana",
  "Continental Medical College, Lahore",
  "Dera Ghazi Khan Medical College, D.G. Khan",
  "Dow International Medical College, Karachi",
  "Dow Medical College, Karachi",
  "FMH College of Medicine & Dentistry, Lahore",
  "Faisalabad Medical University, Faisalabad",
  "Faryal Dental College, Lahore",
  "Fatima Jinnah Medical University, Lahore",
  "Fazaia Medical College, Islamabad",
  "Fazaia Ruth Pfau Medical College, Karachi",
  "Federal Medical College (SZABMU), Islamabad",
  "Foundation University Medical College, Rawalpindi",
  "Frontier Medical College, Abbottabad",
  "Gajju Khan Medical College, Swabi",
  "Gambat Institute of Medical Sciences, Khairpur",
  "Ghulam Muhammad Mahar Medical College, Sukkur",
  "Gomal Medical College, Dera Ismail Khan",
  "Gujranwala Medical College, Gujranwala",
  "HBS Medical & Dental College, Islamabad",
  "HITEC Institute of Medical Sciences, Taxila",
  "Hamdard College of Medicine and Dentistry, Karachi",
  "Independent Medical College, Faisalabad",
  "Indus Medical College, Tando Muhammad Khan",
  "Islam Medical College, Sialkot",
  "Islamabad Medical & Dental College, Islamabad",
  "Islamic International Dental College (RIU), Islamabad",
  "Islamic International Medical College (RIU), Rawalpindi",
  "Jhalawan Medical College, Khuzdar",
  "Jinnah Medical & Dental College, Karachi",
  "Jinnah Sindh Medical University, Karachi",
  "KMU Institute of Medical Sciences, Kohat",
  "Kabir Medical College, Peshawar",
  "Karachi Institute of Medical Sciences, Karachi",
  "Karachi Medical and Dental College, Karachi",
  "Khawaja Muhammad Safdar Medical College, Sialkot",
  "Khyber Girls Medical College, Peshawar",
  "Khyber Medical University, Peshawar",
  "King Edward Medical University, Lahore",
  "Lahore Medical & Dental College, Lahore",
  "Liaquat College of Medicine & Dentistry, Karachi",
  "Liaquat National Hospital & Medical College, Karachi",
  "Liaquat University of Medical and Health Sciences, Jamshoro",
  "Loralai Medical College, Loralai",
  "M. Islam Medical College, Gujranwala",
  "Makran Medical College, Turbat",
  "Mohi-ud-Din Islamic Medical College, Mirpur",
  "Mohtarma Benazir Bhutto Medical College, Mirpur",
  "Muhammad Medical College, Mirpurkhas",
  "Multan Medical and Dental College, Multan",
  "Nawaz Sharif Medical College, Gujrat",
  "Niazi Medical & Dental College, Sargodha",
  "Nishtar Medical University, Multan",
  "Nowshera Medical College, Nowshera",
  "NUST School of Health Sciences, Islamabad",
  "Pak Red Crescent Medical & Dental College, Lahore",
  "Peoples University of Medical & Health Sciences for Women, Nawabshah",
  "Poonch Medical College, Rawalakot",
  "Quaid-e-Azam Medical College, Bahawalpur",
  "Queens Medical College, Kasur",
  "Quetta Institute of Medical Sciences, Quetta",
  "Rahbar Medical and Dental College, Lahore",
  "Rai Medical College, Sargodha",
  "Rashid Latif Khan University Medical College, Lahore",
  "Rashid Latif Medical College, Lahore",
  "Rawal Institute of Health Sciences, Rawalpindi",
  "Rawalpindi Medical University, Rawalpindi",
  "Riphah International University",
  "Sahara Medical College, Narowal",
  "Sahiwal Medical College, Sahiwal",
  "Saidu Medical College, Swat",
  "Sargodha Medical College, Sargodha",
  "School of Dentistry, (SZABMU) - Islamabad",
  "Services Institute of Medical Sciences (SIMS), Lahore",
  "Shaheed Mohtarma Benazir Bhutto Medical College, Lyari",
  "Shahida Islam Medical College, Lodhran",
  "Shaikh Khalifa Bin Zayed Al-Nahyan Medical & Dental College, Lahore",
  "Shalamar Medical and Dental College, Lahore",
  "Sharif Medical & Dental College, Lahore",
  "Sheikh Zayed Medical College, Rahim Yar Khan",
  "Shifa College of Medicine, Islamabad",
  "Sialkot Medical College, Sialkot",
  "Sir Syed College of Medical Sciences for Girls, Karachi",
  "Suleman Roshan Medical College, Tando Adam",
  "Superior University, Lahore",
  "United Medical & Dental College, Karachi",
  "University College of Medicine & Dentistry, Lahore",
  "University Medical and Dental College, Faisalabad",
  "Wah Medical College, Wah Cantt",
  "Watim Medical and Dental College, Rawalpindi",
  "Women Medical College, Abbottabad",
  "Ziauddin Medical College, Karachi",
  "Other",
];

const agreementPoints = [
  "I am a student of a WHO and PMDC-recognized medical school/university or an HEC-recognized university.",
  "I am an undergraduate/postgraduate student pursuing a medical or paramedical degree, including MBBS, BDS, DPT, BSN, DPharm, MLT, or other postgraduate degrees, in an educational institution recognized by the Higher Education Commission of Pakistan, or I am completing one of these degrees while on an approved academic leave.",
  "I have attached proof of the Membership Fee payable to MSA-Pakistan. The submitted membership fee is non-refundable.",
  "MSA-Pakistan will not be responsible for any personal or political activities of the member.",
  "My form will not be processed until the Membership Fee is verified.",
  "The MSA-Pakistan Executive Board reserves the right to cancel the membership.",
  "If I am found involved in any activity against the organization, country of origin, host country for external opportunities, or host college/university, my membership will be cancelled and MSA-Pakistan will not be responsible for any losses incurred.",
  "I have never been implicated in activity that would result in my expulsion from medical school on behavioral grounds.",
  "I will abide by the rules and regulations laid down by the MSA-Pakistan Executive Board regarding issues pertaining to the functioning of the organization.",
  "I agree that MSA-Pakistan are non-political, non-religious, and non-ethnic organizations.",
  "I agree to abide by the Constitutional Bylaws of MSA-Pakistan.",
];

const conductSections = [
  {
    title: "1. I acknowledge the principles of MSA-Pakistan",
    items: [
      "I will respect MSA-Pakistan’s Constitution, Bylaws, regulations, policies, the Code of Conduct, and any agreements I undertake, adhering to their respective accountability mechanisms.",
      "I will avoid actions that may harm the reputation of MSA-Pakistan, the hosting LC of any MSA-Pakistan activity, other participating organizations, or medical students.",
    ],
  },
  {
    title: "2. I will demonstrate mindfulness, respect, & tolerance",
    items: [
      "I will exhibit respect for diverse individuals, cultures, values, and perspectives.",
      "I will treat everyone impartially, irrespective of gender, age, ethnic or national origin, nationality, language, religion, belief, opinion, physical attributes, state of health, sexual orientation, or other personal factors.",
      "I will be conscious of my thoughts, words, and actions to prevent contributing to social exclusion and inequality.",
      "I will oppose the promotion of hatred, hate speech, and violence.",
      "I will refrain from actions intended to shame, humiliate, belittle, or degrade fellow members and non-member individuals.",
    ],
  },
  {
    title: "3. I will engage actively & meaningfully",
    items: [
      "I will be considerate of time and refrain from causing distractions or interruptions during ongoing activities.",
      "I will ensure that communication with others is a reciprocal process involving both speaking up and actively listening to allow exchange of thoughts and views.",
      "I will promote interaction that is supportive and encouraging, grounded in mutual assistance.",
      "I will welcome new ideas, knowledge, and feedback, and continuously assess my own approaches to thinking and working.",
      "I will contribute by sharing my knowledge and skills with others.",
    ],
  },
  {
    title: "4. I will conduct myself openly & responsibly",
    items: [
      "I will abstain from engaging in illegal, unethical, or human-rights-compromising activities.",
      "I will commit to prioritizing the safety and health of myself and all participants in MSA-Pakistan activities, avoiding actions that may undermine them.",
    ],
  },
  {
    title: "5. I will respect people, privacy, property, and the environment",
    items: [
      "I will strive to adopt environmentally friendly practices to minimize negative environmental impact.",
      "I will refrain from smoking or alcohol consumption where and when prohibited.",
      "I will respect the privacy of individuals involved in MSA-Pakistan activities and handle information obtained through activities with care.",
      "I will contribute to maintaining the organization and cleanliness of facilities and areas where MSA-Pakistan activities occur.",
      "I will respect public and private property, including property belonging to meeting facilities, and refrain from damaging or removing it.",
      "I will respect the instructions of the Organizing Committee, Team of Officials, hotel staff, or other authorities.",
    ],
  },
  {
    title: "6. I will report wrongdoing",
    items: [
      "Every member of MSA-Pakistan has the right and obligation to report instances of wrongdoing, and there must be no negative consequences for the reporting party.",
      "If I witness misconduct, I will make an effort to inform the Code of Conduct Committee, which will handle the notification appropriately.",
      "I acknowledge that failure to comply with this Code of Conduct may result in disciplinary action as outlined in the Code of Conduct Framework.",
    ],
  },
];

function normalizeCnic(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function calculateAge(date: string) {
  if (!date) return "";
  const dob = new Date(`${date}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const month = today.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 && age < 100 ? String(age) : "";
}

async function readUpload(file: File): Promise<UploadValue> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Please keep each uploaded file under 5 MB.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, mimeType: file.type || "application/octet-stream", base64 };
}

async function readProfilePhoto(file: File): Promise<UploadValue> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file for your profile picture.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Please keep your profile picture under 2 MB.");
  }
  return readUpload(file);
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="msap-section-heading relative mb-9 overflow-hidden rounded-2xl border border-[#D9E4E1] bg-[linear-gradient(135deg,#F8FBFA_0%,#EEF7F4_100%)] px-5 py-5 sm:px-6 sm:py-6">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-[linear-gradient(180deg,#1B355E,#138A73)]" />
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#1B355E] sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#42566E]">{description}</p>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-[#1B355E]">{label} {required && <span className="msap-required">*</span>}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-[#66788D]">{hint}</p>}
    </div>
  );
}

function CollegePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collegeOptions.slice(0, 12);
    return collegeOptions.filter((college) => college.toLowerCase().includes(q)).slice(0, 15);
  }, [query]);

  useEffect(() => setQuery(value), [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#66788D]" />
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); if (!event.target.value) onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Search your medical college / institute"
          className="h-12 pl-10 pr-10"
        />
        <ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#66788D]" />
      </div>
      {open && (
        <>
          <button aria-label="Close college list" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[#D9E4E1] bg-white p-2 shadow-xl">
            {filtered.length === 0 ? (
              <button type="button" onClick={() => { onChange(query); setOpen(false); }} className="w-full rounded-xl p-3 text-left text-sm hover:bg-[#F6F9F8]">
                Use “{query}” as your institute
              </button>
            ) : filtered.map((college) => (
              <button
                key={college}
                type="button"
                onClick={() => { onChange(college); setQuery(college); setOpen(false); }}
                className={`w-full rounded-xl p-3 text-left text-sm transition hover:bg-[#E7F4F0] ${value === college ? "bg-[#E7F4F0] font-semibold text-[#0E5D4D]" : "text-[#334B61]"}`}
              >
                {college}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MembershipForm() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [draftFound, setDraftFound] = useState(false);
  const submit = trpc.membershipForm.submit.useMutation();

  const completion = Math.round(((step + 1) / steps.length) * 100);

  useEffect(() => {
    const saved = localStorage.getItem("msap-membership-draft-v2");
    if (saved) setDraftFound(true);
  }, []);

  useEffect(() => {
    const linkId = "msap-font-montserrat";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const { feeReceipt, cnicCopy, profilePhoto, ...draft } = form;
    localStorage.setItem("msap-membership-draft-v2", JSON.stringify(draft));
  }, [form]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const toggleDiscovery = (value: string) => setForm((current) => ({
    ...current,
    discoverySources: current.discoverySources.includes(value) ? current.discoverySources.filter((item) => item !== value) : [...current.discoverySources, value],
  }));

  const loadDraft = () => {
    const saved = localStorage.getItem("msap-membership-draft-v2");
    if (!saved) return;
    try { setForm({ ...initialState, ...JSON.parse(saved) }); setDraftFound(false); toast.success("Your saved application has been restored."); } catch { toast.error("The saved draft could not be restored."); }
  };

  const clearDraft = () => { localStorage.removeItem("msap-membership-draft-v2"); setDraftFound(false); setForm(initialState); setStep(0); toast.success("Saved draft cleared."); };

  const validateStep = () => {
    if (step === 0 && !form.introductionAcknowledged) { toast.error("Please confirm that you have read the membership information before continuing."); return false; }
    if (step === 1) {
      if (!form.email || !form.fullName || !form.contactNumber || !form.dateOfBirth || !form.graduationDate || !form.cnic || !form.gender || !form.cityOfResidence || !form.address || !form.profilePhoto) { toast.error("Please complete all required personal details, including your profile picture."); return false; }
      if (!/^\d{5}-\d{7}-\d$/.test(form.cnic)) { toast.error("Please enter a valid 13-digit CNIC."); return false; }
      if (!form.age) { toast.error("Please check your date of birth."); return false; }
    }
    if (step === 2) {
      if (!form.courseLevel || !form.courseOfStudy || !form.yearOfStudy || !form.institute || !form.collegeRollNumber || !form.reasonForJoining.trim()) { toast.error("Please complete the required academic details."); return false; }
      if (form.reasonForJoining.trim().length < 10) { toast.error("Please provide at least 10 characters explaining why you want to join MSAP."); return false; }
      if (form.courseOfStudy === "Other" && !form.otherCourse.trim()) { toast.error("Please specify your course."); return false; }
      if (form.institute === "Other" && !form.otherInstitute.trim()) { toast.error("Please specify your institute."); return false; }
    }
    if (step === 3) {
      if (!form.discoverySources.length || !form.paymentAccountName.trim()) { toast.error("Please complete the discovery and payment details."); return false; }
      if (form.discoverySources.includes("Other") && !form.otherDiscoverySource.trim()) { toast.error("Please specify how you heard about MSAP."); return false; }
    }
    if (step === 4) {
      if (!form.feeReceipt || !form.cnicCopy) { toast.error("Please upload both the fee receipt and CNIC copy."); return false; }
      if (form.conflictOfInterest === "Yes" && (!form.conflictOrganization.trim() || !form.conflictRole.trim())) { toast.error("Please provide the organization name and role for the conflict-of-interest declaration."); return false; }
      if (!form.incompleteAcknowledgement || !form.undertakingAccepted) { toast.error("Please complete the required declarations and accept the Code of Conduct undertaking."); return false; }
    }
    return true;
  };

  const next = () => { if (validateStep()) setStep((current) => Math.min(current + 1, steps.length - 1)); };
  const previous = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep() || !form.termsAccepted) {
      toast.error("Please confirm the final declaration before submitting.");
      return;
    }
    if (form.courseLevel !== "Undergraduate (UG)" && form.courseLevel !== "Postgraduate (PG)") {
      toast.error("Please select your course level.");
      return;
    }
    if (
      form.gender !== "Male" &&
      form.gender !== "Female" &&
      form.gender !== "Others" &&
      form.gender !== "Prefer not to say"
    ) {
      toast.error("Please select your gender.");
      return;
    }
    if (!form.undertakingAccepted) {
      toast.error("Please accept the undertaking.");
      return;
    }
    if (!form.introductionAcknowledged) {
      toast.error("Please confirm you've read the membership information.");
      return;
    }
    if (!form.incompleteAcknowledgement) {
      toast.error("Please confirm the required declarations.");
      return;
    }

    const profilePhoto = form.profilePhoto;
    const feeReceipt = form.feeReceipt;
    const cnicCopy = form.cnicCopy;

    if (!profilePhoto || !feeReceipt || !cnicCopy) {
      toast.error(
        "Please upload your profile picture, CNIC copy and membership fee receipt."
      );
      return;
    }

    try {
      const result = await submit.mutateAsync({
        ...form,
        gender: form.gender,
        courseLevel: form.courseLevel,
        profilePhoto,
        feeReceipt,
        cnicCopy,
        termsAccepted: true,
        undertakingAccepted: true,
        introductionAcknowledged: true,
        incompleteAcknowledgement: true,
        age: Number(form.age),
        otherCourse: form.otherCourse || undefined,
        otherInstitute: form.otherInstitute || undefined,
        otherDiscoverySource: form.otherDiscoverySource || undefined,
        graduationDate: form.graduationDate || undefined,
      });

      const downloadRecord = {
        ...form,
        age: Number(form.age),
        applicationRef: result.applicationRef || "",
        submittedAt: new Date().toISOString(),
        feeReceipt: form.feeReceipt ? { fileName: form.feeReceipt.fileName } : undefined,
        cnicCopy: form.cnicCopy ? { fileName: form.cnicCopy.fileName } : undefined,
      };
      sessionStorage.setItem("msap-membership-submission-v1", JSON.stringify(downloadRecord));
      localStorage.removeItem("msap-membership-draft-v2");
      navigate("/membership/submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not submit your application. Please try again.");
    }
  };

  return (
    <main className="msap-membership-form min-h-screen bg-[#F3F7F6] text-[#1B355E]" style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="msap-hero mb-8 overflow-hidden rounded-[2rem] border border-[#D9E4E1] bg-white shadow-[0_28px_80px_-45px_rgba(27,53,94,.42)]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1B355E_0%,#1B355E_46%,#106E5B_100%)] px-5 py-5 text-white sm:px-8 sm:py-7">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[32px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-20 left-1/2 h-48 w-48 rounded-full bg-[#138A73]/20 blur-2xl" />
            <button onClick={() => navigate("/")} className="relative z-10 mb-5 text-sm font-semibold text-white/80 hover:text-white">← Back to MSAP Pakistan</button>
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-24 w-full items-center justify-center px-1 py-1 sm:h-28 sm:w-[360px] sm:px-2">
                  <MSAPLogo
                    variant="horizontal-expanded"
                    tone="white"
                    className="block h-full w-full"
                    style={{ maxHeight: "100%" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/80">MSAP National Membership</p>
                  <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Membership Application</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">A guided digital application for the official MSA-Pakistan National Membership Form.</p>
                </div>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm font-bold"><LockKeyhole size={16} className="text-[#A8D8CD]" /> Secure application</div>
                <p className="mt-1 text-xs text-white/65">Required fields are marked with *</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-[#E7EFEC] bg-[#F7FAF9] px-5 py-4 text-sm text-[#42566E] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>Keep your <span className="font-bold text-[#1B355E]">CNIC copy</span> and <span className="font-bold text-[#1B355E]">PKR 1,000 payment receipt</span> ready.</p>
            <span className="inline-flex w-fit items-center rounded-full bg-[#E7F4F0] px-3 py-1 text-xs font-bold text-[#106E5B]">Student membership</span>
          </div>
        </div>

        {draftFound && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#A8D8CD] bg-[#E7F4F0] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-[#0B4E40]">You have a saved application draft.</p><p className="text-sm text-[#0E5D4D]/80">We saved your text fields locally on this device. Uploaded files are not saved in the draft.</p></div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={clearDraft}>Start over</Button><Button type="button" onClick={loadDraft} className="msap-primary-action text-white">Continue draft</Button></div>
          </div>
        )}

        <div className="msap-progress-shell mb-6 overflow-hidden rounded-[1.5rem] border border-[#D9E4E1] bg-white/95 shadow-[0_18px_45px_-32px_rgba(27,53,94,.45)]">
          <div className="flex items-center justify-between border-b border-[#E7EFEC] px-4 py-3 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-widest text-[#66788D]">Application progress</p><p className="mt-1 text-sm font-semibold text-[#1B355E]">Step {step + 1} of {steps.length}</p></div><p className="text-sm font-bold text-[#106E5B]">{completion}%</p></div>
          <div className="h-1.5 bg-[#E9F0EE]"><div className="msap-progress-fill h-full transition-all duration-500" style={{ width: `${completion}%` }} /></div>
          <div className="grid grid-cols-3 gap-1 p-3 sm:grid-cols-6 sm:p-4">
            {steps.map((item, index) => { const Icon = item.icon; const active = index === step; const done = index < step; return <button key={item.title} type="button" onClick={() => index <= step && setStep(index)} disabled={index > step} className="rounded-xl p-2 text-center disabled:cursor-default"><div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${done ? "msap-step-complete bg-[#138A73] text-white" : active ? "msap-step-active bg-[#1B355E] text-white" : "bg-[#E9F0EE] text-[#66788D]"}`}>{done ? <Check size={17} /> : <Icon size={17} />}</div><div className={`mt-2 text-[11px] font-semibold leading-4 sm:text-xs ${active ? "text-[#1B355E]" : "text-[#66788D]"}`}>{item.short}</div></button>; })}
          </div>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-[#D9E4E1] bg-white shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)]">
          <CardHeader className="border-b border-[#E7EFEC] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAF9_100%)] px-5 py-7 sm:px-9 sm:py-8">
            <CardTitle className="msap-section-title text-xl font-extrabold tracking-tight sm:text-2xl">{steps[step].title}</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-[#42566E]">{step === 0 ? "Please read the official membership information and agreement before beginning your application." : step === 1 ? "Enter your personal information exactly as you want it recorded in MSAP records." : step === 2 ? "Tell us about your current course, year, institute and academic goals." : step === 3 ? "Complete the membership discovery and payment information." : step === 4 ? "Upload the required documents, declare any organizational affiliation, and complete the Code of Conduct undertaking." : "Review every important detail before sending your application for verification."}</CardDescription>
          </CardHeader>

          <CardContent key={step} className="px-5 py-7 sm:px-9 sm:py-9">
            {step === 0 && (
              <div className="msap-step-content space-y-8">
                <SectionHeading eyebrow="Welcome" title="Join the Medical Students’ Association of Pakistan" description="MSA-Pakistan is a national organization representing medical and allied health students across the regions of Pakistan." />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#66788D]">Membership fee</p><p className="mt-2 text-2xl font-bold text-[#1B355E]">PKR 1,000</p><p className="mt-1 text-sm text-[#42566E]">One-time registration fee.</p></div>
                  <div className="rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#66788D]">Validity</p><p className="mt-2 text-2xl font-bold text-[#1B355E]">Student status</p><p className="mt-1 text-sm text-[#42566E]">Valid until the end of your student status, as stated in the form.</p></div>
                  <div className="rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#66788D]">What you need</p><p className="mt-2 text-2xl font-bold text-[#1B355E]">CNIC + receipt</p><p className="mt-1 text-sm text-[#42566E]">Keep both clear and ready for upload.</p></div>
                </div>
                <div className="msap-payment-card rounded-2xl border p-5 sm:p-6"><p className="msap-section-title font-extrabold">Payment information</p><p className="mt-2 text-sm leading-6 text-[#334B61]">Transfer the membership fee to the account below and attach your payment screenshot/receipt with the application.</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase text-[#42566E]">Account name</p><p className="msap-bank-value mt-1 font-bold">SHAYAN GUL</p></div><div><p className="text-xs font-semibold uppercase text-[#42566E]">Bank</p><p className="msap-bank-value mt-1 font-bold">Meezan Bank</p></div><div><p className="text-xs font-semibold uppercase text-[#42566E]">Account / IBAN</p><p className="msap-bank-value mt-1 break-all font-bold tracking-wide">PK62MEZNO012010113260312</p></div></div><p className="mt-4 text-xs leading-5 text-[#52657E]">The original form also asks applicants to send their fee receipt by email with their name, contact number, email ID and institute/LC information, copying the relevant MSAP contacts. The portal will later automate this communication so applicants do not have to repeat the process manually.</p></div>
                <details className="group rounded-2xl border border-[#D9E4E1] bg-white" open><summary className="flex cursor-pointer list-none items-center justify-between p-5 font-semibold text-[#1B355E]"><span>Membership agreement — please read before proceeding</span><ChevronDown className="transition group-open:rotate-180" size={18} /></summary><div className="border-t border-[#E7EFEC] p-5"><ol className="space-y-4 text-sm leading-6 text-[#52657E]">{agreementPoints.map((point, index) => <li key={point} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9F0EE] text-xs font-bold text-[#52657E]">{index + 1}</span><span>{point}</span></li>)}</ol></div></details>
                <label className="flex items-start gap-3 rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><Checkbox checked={form.introductionAcknowledged} onCheckedChange={(value) => set("introductionAcknowledged", value === true)} /><span className="text-sm leading-6 text-[#334B61]">I have read and understood the membership information, fee requirements, eligibility conditions and agreement above. <span className="msap-required">*</span></span></label>
                <div className="msap-info-card flex items-start gap-3 rounded-2xl border p-5 text-sm leading-6 text-[#1B355E]"><Info size={18} className="mt-0.5 shrink-0" /><p>You will receive a copy of your submitted response by email. For membership queries, the official form directs applicants to contact the MSAP President.</p></div>
              </div>
            )}

            {step === 1 && (
              <div className="msap-step-content space-y-8">
                <SectionHeading eyebrow="Section 1" title="Personal details" description="Please use your legal/official information. Your profile picture will be used on your membership form and future membership documents." />

                <div className="rounded-3xl border border-[#C9D7E8] bg-[#F4F8F7] p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#9FB6CF] bg-white">
                      {form.profilePhoto ? (
                        <img src={`data:${form.profilePhoto.mimeType};base64,${form.profilePhoto.base64}`} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound size={34} className="text-[#647A91]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#106E5B]">Profile picture <span className="msap-required">*</span></p>
                      <h3 className="mt-1 text-lg font-semibold text-[#1B355E]">Upload a clear recent passport-style photo</h3>
                      <p className="mt-2 text-sm leading-6 text-[#42566E]">Use a front-facing photo with a plain background. JPG, PNG or WebP; maximum 2 MB. This photo will be included in your downloadable membership form.</p>
                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1B355E,#106E5B)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,110,91,.18)] transition hover:shadow-[0_12px_24px_rgba(16,110,91,.24)]">
                        <UploadCloud size={17} /> Choose profile picture
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            set("profilePhoto", await readProfilePhoto(file));
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not read the selected photo.");
                          }
                        }} />
                      </label>
                      {form.profilePhoto && (
                        <p className="mt-3 text-xs font-medium text-[#106E5B]">Selected: {form.profilePhoto.fileName}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Email address" required hint="Use an email address you actively monitor. It will be used for official communication."><Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="name@example.com" className="h-12" /></Field>
                  <Field label="Full name" required hint="Enter it exactly as you want it to appear on your MSAP membership letter."><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="First name, middle name, last name" className="h-12" /></Field>
                  <Field label="Contact number" required hint="Please provide a valid WhatsApp/contact number."><Input value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} placeholder="03XX XXXXXXX" className="h-12" /></Field>
                  <Field label="Date of birth" required><Input value={form.dateOfBirth} onChange={(e) => { set("dateOfBirth", e.target.value); set("age", calculateAge(e.target.value)); }} type="date" className="h-12" /></Field>
                  <Field label="Age" hint="Calculated automatically from your date of birth."><Input value={form.age} readOnly className="h-12 bg-[#F6F9F8]" /></Field>
                  <Field label="Year of graduation / expected final result date" required hint="Enter the expected date, month and year of your MBBS final-year result or equivalent final result."><Input value={form.graduationDate} onChange={(e) => set("graduationDate", e.target.value)} type="date" className="h-12" /></Field>
                  <Field label="CNIC number" required hint="Format: 00000-0000000-0"><Input value={form.cnic} onChange={(e) => set("cnic", normalizeCnic(e.target.value))} inputMode="numeric" placeholder="00000-0000000-0" className="h-12" /></Field>
                  <Field label="Gender" required><Select value={form.gender} onValueChange={(value) => set("gender", value as Gender)}><SelectTrigger className="h-12"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Others">Others</SelectItem><SelectItem value="Prefer not to say">Prefer not to say</SelectItem></SelectContent></Select></Field>
                  <Field label="City of residence" required><Input value={form.cityOfResidence} onChange={(e) => set("cityOfResidence", e.target.value)} placeholder="City" className="h-12" /></Field>
                  <div className="md:col-span-2"><Field label="Address" required><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Current residential address" className="min-h-28" /></Field></div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="msap-step-content space-y-8">
                <SectionHeading eyebrow="Section 2" title="Course details" description="These fields mirror the academic information requested in the official MSAP form and will be used in your membership database." />
                <Field label="Level of course" required><RadioGroup value={form.courseLevel} onValueChange={(value) => set("courseLevel", value as CourseLevel)} className="grid gap-3 sm:grid-cols-2">{["Undergraduate (UG)", "Postgraduate (PG)"].map((value) => <label key={value} className={`msap-option-card ${form.courseLevel === value ? "msap-option-selected" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition`}><RadioGroupItem value={value} /><span className="msap-option-label text-sm font-semibold">{value}</span></label>)}</RadioGroup></Field>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Course of study / level of practice" required><Select value={form.courseOfStudy} onValueChange={(value) => set("courseOfStudy", value)}><SelectTrigger className="h-12"><SelectValue placeholder="Select your course" /></SelectTrigger><SelectContent>{courseOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Year of study" required><Select value={form.yearOfStudy} onValueChange={(value) => set("yearOfStudy", value)}><SelectTrigger className="h-12"><SelectValue placeholder="Select your current year" /></SelectTrigger><SelectContent>{yearOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
                  {form.courseOfStudy === "Other" && <Field label="Specify your course" required><Input value={form.otherCourse} onChange={(e) => set("otherCourse", e.target.value)} placeholder="Course / level of practice" className="h-12" /></Field>}
                  <div className={form.courseOfStudy === "Other" ? "md:col-span-2" : "md:col-span-2"}><Field label="Name of current institute" required hint="The official form provides a large list of institutes. Search below instead of scrolling through the entire list."><CollegePicker value={form.institute} onChange={(value) => set("institute", value)} /></Field></div>
                  {form.institute === "Other" && <div className="md:col-span-2"><Field label="If you selected Other, specify your institute" required><Input value={form.otherInstitute} onChange={(e) => set("otherInstitute", e.target.value)} placeholder="Full institute name" className="h-12" /></Field></div>}
                  <Field label="College / university roll number" required hint="This is included in the official MSAP database completion requirements."><Input value={form.collegeRollNumber} onChange={(e) => set("collegeRollNumber", e.target.value)} placeholder="Your college roll number" className="h-12" /></Field>
                  <div />
                </div>
                <Field label="Why do you want to join the Medical Students’ Association of Pakistan?" required><Textarea value={form.reasonForJoining} onChange={(e) => set("reasonForJoining", e.target.value)} className="min-h-36" placeholder="Tell us what you hope to learn, contribute or experience through MSAP (minimum 10 characters)." /></Field>
              </div>
            )}

            {step === 3 && (
              <div className="msap-step-content space-y-8">
                <SectionHeading eyebrow="Section 3" title="Payment & membership" description="Complete the payment details exactly as shown on your transaction. The fee must be verified before the application can proceed through the MSAP workflow." />
                <Field label="How did you get to know about MSA-Pakistan?" required hint="Check all that apply."><div className="grid gap-3 sm:grid-cols-2">{discoveryOptions.map((value) => <label key={value} className={`msap-option-card ${form.discoverySources.includes(value) ? "msap-option-selected" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition`}><Checkbox checked={form.discoverySources.includes(value)} onCheckedChange={() => toggleDiscovery(value)} /><span className="msap-option-label text-sm font-medium">{value}</span></label>)}</div></Field>
                {form.discoverySources.includes("Other") && <Field label="If Other, please specify" required><Input value={form.otherDiscoverySource} onChange={(e) => set("otherDiscoverySource", e.target.value)} placeholder="Tell us how you heard about MSAP" className="h-12" /></Field>}
                <div className="rounded-3xl border border-[#A8D8CD] bg-[#E7F4F0]/70 p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#106E5B]">MSAP Membership Fee</p><p className="mt-2 text-3xl font-bold text-[#1B355E]">PKR 1,000</p><p className="mt-1 text-sm text-[#52657E]">One-time fee payable at the time of applying for membership.</p></div><div className="rounded-2xl border border-[#D9E4E1] bg-white p-4 text-sm shadow-sm text-[#1B355E]"><p className="msap-bank-value font-extrabold">Meezan Bank — Rahim Yar Khan Branch</p><p className="msap-bank-value mt-1 font-semibold">Account name: SHAYAN GUL</p><p className="msap-bank-value mt-1 break-all font-bold tracking-wide">PK62MEZNO012010113260312</p></div></div><p className="mt-5 text-xs leading-5 text-[#52657E]">Please rename your payment receipt image with your full name followed by your institute’s LC abbreviation, for example: <strong>Hamza Ahmad_SMC LC</strong>.</p></div>
                <Field label="Name on bank account / JazzCash / EasyPaisa used for fee payment" required hint="If someone else paid on your behalf, write their name. If you paid yourself, write your own name."><Input value={form.paymentAccountName} onChange={(e) => set("paymentAccountName", e.target.value)} placeholder="Name of account holder / payer" className="h-12" /></Field>
                <div className="rounded-2xl border border-[#C9D7E8] bg-[#EEF4F7] p-5 text-sm leading-6 text-[#1B355E]"><p className="msap-section-title font-extrabold">Payment verification</p><p className="mt-1">The official form states that the application will not be processed until the membership fee is verified and that the fee is non-refundable.</p></div>
              </div>
            )}

            {step === 4 && (
              <div className="msap-step-content space-y-9">
                <SectionHeading eyebrow="Section 4" title="Documents, disclaimer & undertaking" description="This section contains the required evidence and the full member Code of Conduct undertaking from the official MSAP form." />
                <div className="grid gap-6 lg:grid-cols-2">
                  {[{ key: "cnicCopy" as const, title: "Copy of CNIC", description: "Upload a clear image or PDF of your CNIC. Maximum 5 MB." }, { key: "feeReceipt" as const, title: "Membership fee receipt", description: "Upload a screenshot/photo of the PKR 1,000 payment receipt. Maximum 5 MB." }].map((item) => <div key={item.key} className="rounded-3xl border border-dashed border-[#A8D8CD] bg-[#F7FAF9]/90 p-6"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#106E5B] shadow-sm"><FileUp size={20} /></div><h3 className="font-semibold text-[#1B355E]">{item.title} <span className="msap-required">*</span></h3><p className="mt-2 text-sm leading-6 text-[#42566E]">{item.description}</p><label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1B355E,#106E5B)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,110,91,.18)] hover:shadow-[0_12px_24px_rgba(16,110,91,.24)]"><UploadCloud size={17} /> Choose file<input type="file" className="hidden" accept="image/*,.pdf" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { set(item.key, await readUpload(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } }} /></label>{form[item.key] && <div className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-[#334B61]"><CheckCircle2 size={17} className="shrink-0 text-[#106E5B]" /><span className="truncate">{form[item.key]?.fileName}</span></div>}</div>)}
                </div>
                <Field label="Conflict of Interest" required hint="Are you part of any other organization? If yes, specify the organization name and your role."><RadioGroup value={form.conflictOfInterest} onValueChange={(value) => set("conflictOfInterest", value)} className="grid gap-3 sm:grid-cols-2"><label className={`msap-option-card ${form.conflictOfInterest === "No" ? "msap-option-selected" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4`}><RadioGroupItem value="No" /><span className="msap-option-label font-medium">No</span></label><label className={`msap-option-card ${form.conflictOfInterest === "Yes" ? "msap-option-selected" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4`}><RadioGroupItem value="Yes" /><span className="msap-option-label font-medium">Yes</span></label></RadioGroup></Field>
                {form.conflictOfInterest === "Yes" && <div className="grid gap-6 rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5 md:grid-cols-2"><Field label="Organization name" required><Input value={form.conflictOrganization} onChange={(e) => set("conflictOrganization", e.target.value)} placeholder="Organization name" className="h-12" /></Field><Field label="Your role" required><Input value={form.conflictRole} onChange={(e) => set("conflictRole", e.target.value)} placeholder="Your role" className="h-12" /></Field></div>}
                <div className="rounded-3xl border border-[#A8D8CD] bg-[#E7F4F0]/70 p-6"><p className="msap-section-title font-extrabold">Important disclaimer</p><p className="mt-2 text-sm leading-6 text-[#334B61]">MSA-Pakistan states in the official membership agreement that it will not be responsible for personal or political activities of a member. The Executive Board reserves the right to cancel membership, and membership may be cancelled for activities against the organization, country of origin, host country for external opportunities, or the host college/university. Membership is subject to verification and the submitted fee is non-refundable.</p></div>
                <div className="rounded-3xl border border-[#D9E4E1] bg-white"><div className="border-b border-[#E7EFEC] p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#106E5B]">Annex 1</p><h3 className="mt-1 text-xl font-semibold">Members Pledge to the Code of Conduct</h3><p className="mt-2 text-sm leading-6 text-[#42566E]">As a member of MSA-Pakistan, I commit myself to the following:</p></div><div className="max-h-[34rem] overflow-y-auto p-6"><div className="space-y-7">{conductSections.map((section) => <section key={section.title}><h4 className="font-semibold text-[#1B355E]">{section.title}</h4><ul className="mt-3 space-y-3">{section.items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-[#52657E]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#138A73]" />{item}</li>)}</ul></section>)}</div></div></div>
                <div className="rounded-2xl border border-[#D9E4E1] p-5"><p className="font-semibold text-[#1B355E]">Do you agree to the MSA-Pakistan membership Terms and Conditions?</p><RadioGroup value={form.undertakingChoice} onValueChange={(value) => { set("undertakingChoice", value); set("undertakingAccepted", value === "Yes"); }} className="mt-4 grid gap-3 sm:grid-cols-2"><label className={`msap-option-card ${form.undertakingChoice === "Yes" ? "msap-option-selected" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4`}><RadioGroupItem value="Yes" /><span className="msap-option-label font-semibold">Yes, I agree</span></label><label className={`msap-option-card ${form.undertakingChoice === "No" ? "border-[#8EA0B5] bg-[#F1F5F8]" : ""} flex cursor-pointer items-center gap-3 rounded-2xl border p-4`}><RadioGroupItem value="No" /><span className="msap-option-label font-semibold">No, I do not agree</span></label></RadioGroup></div>
                <label className="flex items-start gap-3 rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><Checkbox checked={form.incompleteAcknowledgement} onCheckedChange={(value) => set("incompleteAcknowledgement", value === true)} /><span className="text-sm leading-6 text-[#334B61]">I understand that my application is incomplete until the required documents, payment receipt and verification information have been submitted and checked. <span className="msap-required">*</span></span></label>
              </div>
            )}

            {step === 5 && (
              <div className="msap-step-content space-y-8">
                <SectionHeading eyebrow="Final step" title="Review your application" description="Please check your information carefully. Once submitted, the application will enter the MSAP membership verification workflow." />
                {form.profilePhoto && (
                  <div className="flex items-center gap-4 rounded-3xl border border-[#C9D7E8] bg-[#F4F8F7] p-5">
                    <img src={`data:${form.profilePhoto.mimeType};base64,${form.profilePhoto.base64}`} alt="Profile preview" className="h-20 w-20 rounded-2xl object-cover" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#106E5B]">Profile picture</p>
                      <p className="mt-1 text-sm font-semibold text-[#1B355E]">{form.profilePhoto.fileName}</p>
                      <p className="mt-1 text-xs text-[#42566E]">Included in your downloadable form.</p>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Full name", form.fullName], ["Email", form.email], ["Contact number", form.contactNumber], ["CNIC", form.cnic], ["Date of birth", form.dateOfBirth], ["Expected final result", form.graduationDate], ["Gender", form.gender], ["City", form.cityOfResidence], ["Course level", form.courseLevel], ["Course", form.courseOfStudy === "Other" ? form.otherCourse : form.courseOfStudy], ["Year", form.yearOfStudy], ["Institute", form.institute === "Other" ? form.otherInstitute : form.institute], ["Roll number", form.collegeRollNumber], ["Payer", form.paymentAccountName], ["Discovery", form.discoverySources.join(", ")]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#D9E4E1] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#66788D]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#1B355E]">{value || "—"}</p></div>)}</div>
                <div className="rounded-2xl border border-[#D9E4E1] bg-[#F6F9F8] p-5"><p className="font-semibold text-[#1B355E]">Documents</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-2 text-sm text-[#334B61]"><CheckCircle2 size={17} className="text-[#106E5B]" /> {form.cnicCopy?.fileName || "CNIC not uploaded"}</div><div className="flex items-center gap-2 text-sm text-[#334B61]"><CheckCircle2 size={17} className="text-[#106E5B]" /> {form.feeReceipt?.fileName || "Fee receipt not uploaded"}</div></div></div>
                <div className="rounded-3xl border border-[#A8D8CD] bg-[#E7F4F0]/70 p-6"><p className="font-semibold text-[#1B355E]">What happens after submission?</p><ol className="mt-3 space-y-2 text-sm leading-6 text-[#334B61]"><li>1. Your application and supporting documents are submitted for verification.</li><li>2. The existing MSAP approval workflow handles review and approval.</li><li>3. After approval, your MSAP membership ID and membership letter can be generated.</li><li>4. Your approved email will later be used for portal password setup.</li></ol></div>
                <label className="flex items-start gap-3 rounded-2xl border border-[#D9E4E1] p-5"><Checkbox checked={form.termsAccepted} onCheckedChange={(value) => set("termsAccepted", value === true)} /><span className="text-sm leading-6 text-[#334B61]">I confirm that the information provided is accurate and complete. I have read and accepted the MSAP membership agreement and Code of Conduct, and I understand that membership is subject to verification and approval. <span className="msap-required">*</span></span></label>
              </div>
            )}
          </CardContent>

          <div className="flex flex-col-reverse gap-3 border-t border-[#E7EFEC] bg-[#F7FAF9]/90 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <Button type="button" variant="ghost" onClick={previous} disabled={step === 0 || submit.isPending} className="justify-center text-[#52657E]"><ArrowLeft size={17} className="mr-2" /> Previous</Button>
            {step < steps.length - 1 ? <Button type="button" onClick={next} className="msap-primary-action text-white">Continue <ArrowRight size={17} className="ml-2" /></Button> : <Button type="button" onClick={handleSubmit} disabled={submit.isPending} className="msap-primary-action text-white">{submit.isPending ? <><Loader2 size={17} className="mr-2 animate-spin" /> Submitting...</> : <><CheckCircle2 size={17} className="mr-2" /> Submit membership application</>}</Button>}
          </div>
        </Card>
      </div>
    </main>
  );
}
