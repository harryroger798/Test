"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Star,
  Copy,
  Check,
  ExternalLink,
  Phone,
  Mail,
  ThumbsUp,
  ThumbsDown,
  PartyPopper,
  AlertTriangle,
  ChevronRight,
  Clock,
  MousePointerClick,
  Eye,
  Shield,
  Coins,
  ArrowRight,
  CheckCircle,
  Scale,
} from "lucide-react";
import confetti from "canvas-confetti";

interface CancellationStep {
  step: number;
  instruction: string;
  url?: string;
}

interface Alternative {
  name: string;
  price: number;
}

interface RetentionOffer {
  id: string;
  offerType: string;
  description: string;
  discountPct: number | null;
  duration: string | null;
  script: string | null;
  upvotes: number;
  downvotes: number;
}

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  category: string;
  regions: string[];
  website: string | null;
  difficultyScore: number;
  darkPatternScore: number;
  totalCancellations: number;
  avgMonthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  cancellationUrl: string | null;
  cancellationPhone: string | null;
  cancellationEmail: string | null;
  cancellationMethod: string;
  cancellationSteps: CancellationStep[];
  clicksToCancel: number;
  estimatedCancelTime: number;
  darkPatterns: string[];
  alternatives: Alternative[];
  freeTierAvailable: boolean;
  headquarters: string | null;
  knownLawsuits: string | null;
  retentionOffers: RetentionOffer[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", INR: "₹", AUD: "A$", CAD: "C$", KRW: "₩",
};

function formatPrice(price: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  if (currency === "KRW") return `${sym}${price.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  return `${sym}${price.toFixed(2)}`;
}

const POST_CANCEL_CHECKLIST = [
  "Screenshot the cancellation confirmation page",
  "Save the confirmation email or reference number",
  "Check for a confirmation email within 24 hours",
  "Remove saved payment methods from the service",
  "Export any important data before access expires",
  "Set a calendar reminder to verify no future charges",
  "Check your bank statement after the next billing cycle",
  "File a dispute if charged after cancellation date",
];

const CANCELLATION_SCRIPTS: Record<string, string> = {
  phone: "Hi, I'd like to cancel my subscription. I've already made my decision and would like to proceed with cancellation immediately. Please process this now. My account email is [YOUR EMAIL]. I do not need to hear about any offers or alternatives - please just process the cancellation. Can you confirm the cancellation and provide a confirmation number?",
  chat: "Hello, I need to cancel my subscription effective immediately. Please process this cancellation now. I don't need any retention offers or alternatives. Please confirm the cancellation with a reference number. My account email is [YOUR EMAIL].",
  email: "Subject: Immediate Cancellation Request\n\nTo whom it may concern,\n\nI am formally requesting the immediate cancellation of my subscription/account.\n\nPlease process this cancellation effective immediately and send written confirmation to this email address. Please also confirm that no further charges will be applied to my payment method on file.\n\nIf I do not receive confirmation within 48 hours, I will file a complaint with the FTC (US), CMA (UK), or relevant consumer protection authority.\n\nThank you.",
};

export default function CancelGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [checklist, setChecklist] = useState<boolean[]>(new Array(POST_CANCEL_CHECKLIST.length).fill(false));
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCancelled = () => {
    setCancelled(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FF3131", "#FF6B35", "#00FF88"],
    });
    if (company) {
      fetch(`/api/companies/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType: "upvote", targetType: "cancellation_guide" }),
      });
    }
  };

  const toggleChecklist = (index: number) => {
    const updated = [...checklist];
    updated[index] = !updated[index];
    setChecklist(updated);
  };

  const getDifficultyLabel = (score: number) => {
    if (score >= 4.5) return { label: "NIGHTMARE", color: "bg-[#FF3131]" };
    if (score >= 3.5) return { label: "HARD", color: "bg-[#FF6B35]" };
    if (score >= 2.5) return { label: "MEDIUM", color: "bg-yellow-500" };
    return { label: "EASY", color: "bg-[#00FF88] text-black" };
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-4">
          <div className="h-12 w-64 animate-pulse bg-[#141414]" />
          <div className="h-6 w-96 animate-pulse bg-[#141414]" />
          <div className="h-64 animate-pulse bg-[#141414]" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-[#FF6B35]" />
        <h1 className="mb-2 text-2xl font-bold">Company Not Found</h1>
        <p className="text-[#888888]">We don&apos;t have a guide for this company yet.</p>
      </div>
    );
  }

  const difficulty = getDifficultyLabel(company.difficultyScore);
  const scriptType = company.cancellationMethod === "phone" ? "phone" : company.cancellationMethod === "email" ? "email" : "chat";
  const savings = company.avgMonthlyPrice ? company.avgMonthlyPrice * 12 : 0;
  const cur = company.currency || "USD";

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-20">
        <div className="absolute inset-0">
          <img src="/images/cancel-guide-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/88" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold md:text-4xl">How to Cancel {company.name}</h1>
              <span className={`px-3 py-1 text-xs font-bold uppercase ${difficulty.color}`}>{difficulty.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[#888888]">
              <span>{company.category}</span>
              <span className="flex items-center gap-1">
                Difficulty: <span className="font-mono font-bold text-[#FF3131]">{company.difficultyScore.toFixed(1)}</span>/5
              </span>
              <span className="flex items-center gap-1">
                <MousePointerClick className="h-3 w-3" /> {company.clicksToCancel} clicks
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> ~{company.estimatedCancelTime} min
              </span>
              <span>{company.totalCancellations.toLocaleString()} cancellations</span>
              {company.avgMonthlyPrice && <span>~{formatPrice(company.avgMonthlyPrice, cur)}/mo</span>}
            </div>
          </motion.div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {savings > 0 && (
          <div className="mb-6 border border-[#00FF88]/30 bg-[#00FF88]/5 p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#00FF88]" />
              <span className="text-sm text-[#888888]">By cancelling, you&apos;ll save</span>
              <span className="font-mono text-lg font-bold text-[#00FF88]">{formatPrice(savings, cur)}/year</span>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          {company.cancellationUrl && (
            <a
              href={company.cancellationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#FF3131] px-6 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
            >
              <ExternalLink className="h-4 w-4" /> Direct Cancel Link
            </a>
          )}
          {company.cancellationPhone && (
            <a
              href={`tel:${company.cancellationPhone}`}
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-6 py-3 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              <Phone className="h-4 w-4" /> {company.cancellationPhone}
            </a>
          )}
          {company.cancellationEmail && (
            <button
              onClick={() => copyToClipboard(company.cancellationEmail!, "email")}
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-6 py-3 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              <Mail className="h-4 w-4" /> {copied === "email" ? "Copied!" : company.cancellationEmail}
            </button>
          )}
        </div>

        {Array.isArray(company.darkPatterns) && (company.darkPatterns as string[]).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Eye className="h-5 w-5 text-[#FF6B35]" /> Dark Patterns Used
            </h2>
            <div className="flex flex-wrap gap-2">
              {(company.darkPatterns as string[]).map((dp) => (
                <Link
                  key={dp}
                  href="/dark-patterns"
                  className="border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3 py-1.5 text-sm text-[#FF6B35] transition-all hover:bg-[#FF6B35]/20"
                >
                  {dp}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#888888]">
              Dark Pattern Score: <span className="font-mono font-bold text-[#FF6B35]">{company.darkPatternScore.toFixed(1)}/10</span>
            </p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Step-by-Step Guide</h2>
          <div className="space-y-3">
            {(company.cancellationSteps as CancellationStep[]).map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 border border-[#1E1E1E] bg-[#141414] p-4"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-[#FF3131]/10 font-mono text-sm font-bold text-[#FF3131]">
                  {step.step}
                </div>
                <div className="flex-1">
                  <p>{step.instruction}</p>
                  {step.url && (
                    <a href={step.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-[#FF3131] hover:underline">
                      Open link <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center justify-between text-xl font-bold">
            <span>Cancellation Script</span>
            <button
              onClick={() => setShowScript(!showScript)}
              className="text-sm font-normal text-[#FF3131] hover:underline"
            >
              {showScript ? "Hide" : "Show"} Script
            </button>
          </h2>
          {showScript && (
            <div className="relative border border-[#1E1E1E] bg-[#141414] p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-[#FF6B35]">
                {scriptType === "phone" ? "Phone Script" : scriptType === "email" ? "Email Template" : "Chat Template"}
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-[#888888]">
                {CANCELLATION_SCRIPTS[scriptType]}
              </pre>
              <button
                onClick={() => copyToClipboard(CANCELLATION_SCRIPTS[scriptType], "script")}
                className="absolute right-3 top-3 border border-[#1E1E1E] bg-[#0A0A0A] p-2 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
              >
                {copied === "script" ? <Check className="h-4 w-4 text-[#00FF88]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </section>

        {company.retentionOffers.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold">Retention Offers (Community-Reported)</h2>
            <div className="space-y-3">
              {company.retentionOffers.map((offer) => (
                <div key={offer.id} className="border border-[#1E1E1E] bg-[#141414] p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <span className="mr-2 border border-[#00FF88]/30 bg-[#00FF88]/10 px-2 py-0.5 text-xs text-[#00FF88]">{offer.offerType}</span>
                      {offer.discountPct && <span className="font-mono text-sm font-bold text-[#00FF88]">{offer.discountPct}% off</span>}
                      {offer.duration && <span className="ml-2 text-xs text-[#888888]">for {offer.duration}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="flex items-center gap-1 text-xs text-[#888888] hover:text-[#00FF88]">
                        <ThumbsUp className="h-3 w-3" /> {offer.upvotes}
                      </button>
                      <button className="flex items-center gap-1 text-xs text-[#888888] hover:text-[#FF3131]">
                        <ThumbsDown className="h-3 w-3" /> {offer.downvotes}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#888888]">{offer.description}</p>
                  {offer.script && (
                    <div className="mt-2 border-l-2 border-[#FF6B35] pl-3">
                      <span className="text-xs font-semibold text-[#FF6B35]">SCRIPT:</span>
                      <p className="text-sm text-[#888888]">&ldquo;{offer.script}&rdquo;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {Array.isArray(company.alternatives) && (company.alternatives as Alternative[]).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <ArrowRight className="h-5 w-5 text-[#00FF88]" /> Alternatives
            </h2>
            <div className="flex flex-wrap gap-2">
              {(company.alternatives as Alternative[]).map((alt) => (
                <div key={alt.name} className="flex items-center gap-2 border border-[#1E1E1E] bg-[#141414] px-3 py-2">
                  <span className="text-sm text-white">{alt.name}</span>
                  <span className={`font-mono text-xs ${alt.price === 0 ? "text-[#00FF88]" : "text-[#888888]"}`}>
                    {alt.price === 0 ? "FREE" : `${CURRENCY_SYMBOLS[cur] || "$"}${alt.price}/mo`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {company.knownLawsuits && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Scale className="h-5 w-5 text-[#FFAA00]" /> Legal Action
            </h2>
            <div className="border border-[#FFAA00]/30 bg-[#FFAA00]/5 p-4">
              <p className="text-sm text-[#888888]">{company.knownLawsuits}</p>
            </div>
          </section>
        )}

        <div className="mb-8 flex justify-center">
          <button
            onClick={handleCancelled}
            disabled={cancelled}
            className={`inline-flex items-center gap-2 px-8 py-4 text-lg font-bold transition-all ${
              cancelled ? "bg-[#00FF88] text-black" : "bg-[#FF3131] text-white hover:bg-[#FF3131]/80 pulse-glow"
            }`}
          >
            {cancelled ? (
              <><PartyPopper className="h-5 w-5" /> You did it! Freedom!</>
            ) : (
              <><ChevronRight className="h-5 w-5" /> I Cancelled!</>
            )}
          </button>
        </div>

        {cancelled && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Shield className="h-5 w-5 text-[#00FF88]" /> Post-Cancellation Checklist
            </h2>
            <div className="space-y-2">
              {POST_CANCEL_CHECKLIST.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleChecklist(i)}
                  className={`flex w-full items-center gap-3 border p-3 text-left transition-all ${
                    checklist[i] ? "border-[#00FF88]/30 bg-[#00FF88]/5" : "border-[#1E1E1E] bg-[#141414]"
                  }`}
                >
                  <CheckCircle className={`h-5 w-5 flex-shrink-0 ${checklist[i] ? "text-[#00FF88]" : "text-[#1E1E1E]"}`} />
                  <span className={`text-sm ${checklist[i] ? "text-[#00FF88] line-through" : "text-[#888888]"}`}>{item}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-center text-sm text-[#888888]">
              {checklist.filter(Boolean).length}/{POST_CANCEL_CHECKLIST.length} completed
            </div>
          </motion.section>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/rights" className="flex items-center gap-1 text-[#FF6B35] hover:underline">
            <Scale className="h-4 w-4" /> Know Your Rights
          </Link>
          <Link href="/dark-patterns" className="flex items-center gap-1 text-[#FF6B35] hover:underline">
            <Eye className="h-4 w-4" /> Dark Pattern Gallery
          </Link>
          <Link href="/alternatives" className="flex items-center gap-1 text-[#00FF88] hover:underline">
            <ArrowRight className="h-4 w-4" /> Find Alternatives
          </Link>
          <Link href="/calculator" className="flex items-center gap-1 text-[#FF6B35] hover:underline">
            <Coins className="h-4 w-4" /> Cost Calculator
          </Link>
        </div>
      </div>
    </div>
  );
}
