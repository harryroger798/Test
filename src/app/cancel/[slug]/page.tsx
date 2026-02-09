"use client";

import { useState, useEffect, use } from "react";
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
} from "lucide-react";
import confetti from "canvas-confetti";

interface CancellationStep {
  step: number;
  instruction: string;
  url?: string;
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
  website: string | null;
  difficultyScore: number;
  darkPatternScore: number;
  totalCancellations: number;
  avgMonthlyPrice: number | null;
  cancellationUrl: string | null;
  cancellationPhone: string | null;
  cancellationEmail: string | null;
  cancellationSteps: CancellationStep[];
  retentionOffers: RetentionOffer[];
}

export default function CancelGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

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

  const emailTemplate = company
    ? `Subject: Cancellation Request - ${company.name} Account\n\nDear ${company.name} Support Team,\n\nI am writing to formally request the immediate cancellation of my ${company.name} subscription/account.\n\nPlease process this cancellation effective immediately and confirm via email once complete. Please also confirm that no further charges will be applied to my payment method.\n\nIf there are any remaining steps I need to complete, please let me know.\n\nThank you for your prompt attention to this matter.\n\nBest regards`
    : "";

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
        <p className="text-[#888888]">
          We don&apos;t have a guide for this company yet.
        </p>
      </div>
    );
  }

  const difficulty = getDifficultyLabel(company.difficultyScore);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              How to Cancel {company.name}
            </h1>
            <span
              className={`px-3 py-1 text-xs font-bold uppercase ${difficulty.color}`}
            >
              {difficulty.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#888888]">
            <span>{company.category}</span>
            <span className="flex items-center gap-1">
              Difficulty:{" "}
              <span className="font-mono font-bold text-[#FF3131]">
                {company.difficultyScore.toFixed(1)}
              </span>
              /5
            </span>
            <span>
              {company.totalCancellations.toLocaleString()} cancellations
            </span>
            {company.avgMonthlyPrice && (
              <span>~${company.avgMonthlyPrice}/mo</span>
            )}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {company.cancellationUrl && (
            <a
              href={company.cancellationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#FF3131] px-6 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
            >
              <ExternalLink className="h-4 w-4" />
              Direct Cancel Link
            </a>
          )}
          {company.cancellationPhone && (
            <a
              href={`tel:${company.cancellationPhone}`}
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-6 py-3 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              <Phone className="h-4 w-4" />
              {company.cancellationPhone}
            </a>
          )}
          {company.cancellationEmail && (
            <button
              onClick={() =>
                copyToClipboard(company.cancellationEmail!, "email")
              }
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-6 py-3 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              <Mail className="h-4 w-4" />
              {copied === "email" ? "Copied!" : company.cancellationEmail}
            </button>
          )}
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Step-by-Step Guide</h2>
          <div className="space-y-3">
            {(company.cancellationSteps as CancellationStep[]).map(
              (step, i) => (
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
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-sm text-[#FF3131] hover:underline"
                      >
                        Open link <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Email Template</h2>
          <div className="relative border border-[#1E1E1E] bg-[#141414] p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm text-[#888888]">
              {emailTemplate}
            </pre>
            <button
              onClick={() => copyToClipboard(emailTemplate, "template")}
              className="absolute right-3 top-3 border border-[#1E1E1E] bg-[#0A0A0A] p-2 text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              {copied === "template" ? (
                <Check className="h-4 w-4 text-[#00FF88]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </section>

        {company.retentionOffers.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold">
              Retention Offers (Community-Reported)
            </h2>
            <div className="space-y-3">
              {company.retentionOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="border border-[#1E1E1E] bg-[#141414] p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <span className="mr-2 border border-[#00FF88]/30 bg-[#00FF88]/10 px-2 py-0.5 text-xs text-[#00FF88]">
                        {offer.offerType}
                      </span>
                      {offer.discountPct && (
                        <span className="font-mono text-sm font-bold text-[#00FF88]">
                          {offer.discountPct}% off
                        </span>
                      )}
                      {offer.duration && (
                        <span className="ml-2 text-xs text-[#888888]">
                          for {offer.duration}
                        </span>
                      )}
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
                      <span className="text-xs font-semibold text-[#FF6B35]">
                        SCRIPT:
                      </span>
                      <p className="text-sm text-[#888888]">
                        &ldquo;{offer.script}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleCancelled}
            disabled={cancelled}
            className={`inline-flex items-center gap-2 px-8 py-4 text-lg font-bold transition-all ${
              cancelled
                ? "bg-[#00FF88] text-black"
                : "bg-[#FF3131] text-white hover:bg-[#FF3131]/80 pulse-glow"
            }`}
          >
            {cancelled ? (
              <>
                <PartyPopper className="h-5 w-5" />
                You did it! Freedom!
              </>
            ) : (
              <>
                <ChevronRight className="h-5 w-5" />
                I Cancelled!
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
