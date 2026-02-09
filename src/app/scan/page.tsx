"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle, Loader2, Lock, Crown } from "lucide-react";
import DangerGauge from "@/components/DangerGauge";
import { getUsageCount, incrementUsage, FREE_LIMITS } from "@/lib/usage";

interface Finding {
  category: string;
  matchedText: string;
  context: string;
  risk: "low" | "medium" | "high";
  explanation: string;
}

interface ScanResult {
  score: number;
  findings: Finding[];
  autoRenewal: boolean;
  cancellationWindow: string | null;
  penaltyClauses: Finding[];
}

export default function ScanPage() {
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    setUsageCount(getUsageCount("contractScans"));
    if (session) {
      fetch("/api/user/pro-status")
        .then((r) => r.json())
        .then((d) => setIsPro(d.isPro))
        .catch(() => {});
    }
  }, [session]);

  const handleScan = async () => {
    if (!text.trim()) return;
    if (!isPro && usageCount >= FREE_LIMITS.contractScans) {
      setLimitReached(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setResult(data);
      if (!isPro) {
        const newCount = incrementUsage("contractScans");
        setUsageCount(newCount);
      }
    } catch {
      /* empty */
    }
    setLoading(false);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "high":
        return "bg-[#FF3131]/10 text-[#FF3131] border-[#FF3131]/30";
      case "medium":
        return "bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/30";
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    }
  };

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-12">
      <img src="/characters/rage_laptop.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-4 top-4 hidden w-[300px] opacity-70 md:block" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">
          <Shield className="mr-2 inline h-8 w-8 text-[#FF3131]" />
          Contract Trap Scanner
        </h1>
        <p className="mb-8 text-[#888888]">
          Paste any Terms of Service or contract and we&apos;ll detect dark
          patterns, auto-renewals, hidden fees, and more.
        </p>

        {!isPro && (
          <div className="mb-4 flex items-center justify-between border border-[#FF6B35]/30 bg-[#FF6B35]/5 px-4 py-2 text-sm">
            <span className="text-[#888888]">
              Free scans: <span className="font-mono font-bold text-white">{usageCount}/{FREE_LIMITS.contractScans}</span> this month
            </span>
            <Link href="/pricing" className="flex items-center gap-1 text-xs font-semibold text-[#FF6B35] hover:underline">
              <Crown className="h-3 w-3" /> Upgrade for unlimited
            </Link>
          </div>
        )}

        {limitReached && !isPro && (
          <div className="mb-4 border border-[#FF3131]/30 bg-[#FF3131]/5 p-6 text-center">
            <Lock className="mx-auto mb-3 h-8 w-8 text-[#FF3131]" />
            <h3 className="mb-2 text-lg font-bold">Monthly Scan Limit Reached</h3>
            <p className="mb-4 text-sm text-[#888888]">
              Free accounts get {FREE_LIMITS.contractScans} contract scan per month. Upgrade to Pro for unlimited scans.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-[#FF3131] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#FF3131]/80"
            >
              <Crown className="h-4 w-4" /> Upgrade to Pro
            </Link>
          </div>
        )}

        <div className="mb-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your Terms of Service or contract text here..."
            rows={12}
            className="w-full resize-y border border-[#1E1E1E] bg-[#141414] p-4 font-mono text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              {text.length.toLocaleString()} characters
            </span>
            <button
              onClick={handleScan}
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-2 bg-[#FF3131] px-6 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Scan for Traps
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-8 flex flex-col items-center gap-8 border border-[#1E1E1E] bg-[#141414] p-8 md:flex-row md:justify-around">
                <DangerGauge score={result.score} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#888888]">
                      Auto-Renewal:
                    </span>
                    {result.autoRenewal ? (
                      <span className="flex items-center gap-1 font-mono font-bold text-[#FF3131]">
                        <AlertTriangle className="h-4 w-4" /> YES
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-mono font-bold text-[#00FF88]">
                        <CheckCircle className="h-4 w-4" /> NO
                      </span>
                    )}
                  </div>
                  {result.cancellationWindow && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#888888]">
                        Cancel Window:
                      </span>
                      <span className="font-mono font-bold text-[#FF6B35]">
                        {result.cancellationWindow}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#888888]">
                      Issues Found:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {result.findings.length}
                    </span>
                  </div>
                </div>
              </div>

              {result.findings.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-bold">Findings</h2>
                  {result.findings.map((finding, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="border border-[#1E1E1E] bg-[#141414] p-4"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={`border px-2 py-0.5 text-xs font-semibold uppercase ${getRiskBadge(
                            finding.risk
                          )}`}
                        >
                          {finding.risk}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {finding.category.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </div>
                      <p className="mb-2 text-sm text-[#888888]">
                        {finding.explanation}
                      </p>
                      <div className="border-l-2 border-[#FF6B35] bg-[#0A0A0A] p-3">
                        <p className="font-mono text-xs text-[#888888]">
                          ...{finding.context}...
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
