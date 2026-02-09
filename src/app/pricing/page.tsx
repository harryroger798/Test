"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap,
  Crown,
  Check,
  Shield,
  Eye,
  Users,
  Bell,
  Search,
  BarChart3,
  Bitcoin,
  Loader2,
} from "lucide-react";

const FREE_FEATURES = [
  { icon: Eye, text: "Browse Wall of Shame (all 1295+ companies)" },
  { icon: Search, text: "3 cancel guides per month" },
  { icon: Shield, text: "1 contract scan per month" },
  { icon: BarChart3, text: "Track up to 3 subscriptions" },
  { icon: Users, text: "Community access (read-only)" },
  { icon: Bell, text: "Basic alerts (1 type)" },
];

const PRO_FEATURES = [
  { icon: Eye, text: "Full Wall of Shame access" },
  { icon: Search, text: "Unlimited cancel guides" },
  { icon: Shield, text: "Unlimited contract scans" },
  { icon: BarChart3, text: "Unlimited subscription tracking" },
  { icon: Users, text: "Full community access (post, vote, submit)" },
  { icon: Bell, text: "All 7 alert types + email digest" },
  { icon: Crown, text: "Alternative finder with full savings data" },
  { icon: Zap, text: "Priority support" },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [btcRate, setBtcRate] = useState<number | null>(null);
  const [proStatus, setProStatus] = useState<{
    isPro: boolean;
    planType: string | null;
    daysRemaining?: number;
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/btc/rate")
      .then((r) => r.json())
      .then((d) => setBtcRate(d.price))
      .catch(() => {});

    if (session) {
      fetch("/api/user/pro-status")
        .then((r) => r.json())
        .then(setProStatus)
        .catch(() => {});
    }
  }, [session]);

  const handleUpgrade = async (planType: string) => {
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(planType);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json();
      if (data.payment) {
        router.push(`/checkout/${data.payment.invoiceId}`);
      }
    } catch {
      setLoading(null);
    }
  };

  const formatBtc = (usd: number) => {
    if (!btcRate) return "...";
    return (usd / btcRate).toFixed(8);
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 text-sm text-[#FF6B35]">
          <Bitcoin className="h-4 w-4" />
          Pay with Bitcoin — No intermediaries, no fees
        </div>
        <h1 className="mb-3 text-4xl font-bold md:text-5xl">
          Upgrade to <span className="text-[#FF3131]">Pro</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#888888]">
          Unlock unlimited access to all features. One-time Bitcoin payment — your funds go directly to our wallet.
        </p>
        {btcRate && (
          <p className="mt-2 text-xs text-[#888888]">
            Live BTC rate: ${btcRate.toLocaleString()} USD
          </p>
        )}
      </motion.div>

      {proStatus?.isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 border border-[#00FF88]/30 bg-[#00FF88]/5 p-6 text-center"
        >
          <Crown className="mx-auto mb-2 h-8 w-8 text-[#00FF88]" />
          <p className="text-lg font-bold text-[#00FF88]">You have Pro access!</p>
          <p className="text-sm text-[#888888]">
            {proStatus.planType === "lifetime"
              ? "Lifetime access — never expires"
              : `${proStatus.daysRemaining} days remaining on annual plan`}
          </p>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-[#1E1E1E] bg-[#141414] p-6"
        >
          <div className="mb-6">
            <h3 className="mb-1 text-lg font-bold text-[#888888]">Free</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-sm text-[#888888]">forever</span>
            </div>
          </div>
          <div className="space-y-3">
            {FREE_FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#888888]" />
                <span className="text-[#888888]">{f.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <div className="w-full border border-[#1E1E1E] px-4 py-3 text-center text-sm text-[#888888]">
              Current Plan
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative border-2 border-[#FF3131] bg-[#141414] p-6"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF3131] px-4 py-1 text-xs font-bold text-white">
            POPULAR
          </div>
          <div className="mb-6">
            <h3 className="mb-1 text-lg font-bold">Annual</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-[#FF3131]">$19</span>
              <span className="text-sm text-[#888888]">/year</span>
            </div>
            {btcRate && (
              <p className="mt-1 font-mono text-xs text-[#FF6B35]">
                {formatBtc(19)} BTC
              </p>
            )}
          </div>
          <div className="space-y-3">
            {PRO_FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <button
              onClick={() => handleUpgrade("annual")}
              disabled={loading === "annual" || (proStatus?.isPro && proStatus?.planType === "lifetime")}
              className="flex w-full items-center justify-center gap-2 bg-[#FF3131] px-4 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50"
            >
              {loading === "annual" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Bitcoin className="h-4 w-4" />
                  Pay with Bitcoin
                </>
              )}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative border border-[#FF6B35]/50 bg-[#141414] p-6"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6B35] px-4 py-1 text-xs font-bold text-white">
            BEST VALUE
          </div>
          <div className="mb-6">
            <h3 className="mb-1 text-lg font-bold">Lifetime</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-[#FF6B35]">$49</span>
              <span className="text-sm text-[#888888]">one-time</span>
            </div>
            {btcRate && (
              <p className="mt-1 font-mono text-xs text-[#FF6B35]">
                {formatBtc(49)} BTC
              </p>
            )}
            <p className="mt-2 text-xs text-[#00FF88]">
              Save ${19 * 3 - 49} vs 3 years of annual
            </p>
          </div>
          <div className="space-y-3">
            {PRO_FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" />
                <span>{f.text}</span>
              </div>
            ))}
            <div className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" />
              <span className="font-semibold text-[#FF6B35]">
                Never expires — lifetime access
              </span>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => handleUpgrade("lifetime")}
              disabled={loading === "lifetime" || (proStatus?.isPro && proStatus?.planType === "lifetime")}
              className="flex w-full items-center justify-center gap-2 border-2 border-[#FF6B35] px-4 py-3 font-semibold text-[#FF6B35] transition-all hover:bg-[#FF6B35] hover:text-white disabled:opacity-50"
            >
              {loading === "lifetime" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Bitcoin className="h-4 w-4" />
                  Pay with Bitcoin
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <div className="mx-auto max-w-2xl border border-[#1E1E1E] bg-[#141414] p-6">
          <h3 className="mb-3 text-lg font-bold">How Bitcoin Payment Works</h3>
          <div className="grid gap-4 text-left text-sm md:grid-cols-3">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FF3131] text-xs font-bold">
                1
              </span>
              <p className="text-[#888888]">
                Choose your plan and click Pay. We fetch the live BTC rate.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FF3131] text-xs font-bold">
                2
              </span>
              <p className="text-[#888888]">
                Scan the QR code or copy the BTC amount. Send from any wallet.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#FF3131] text-xs font-bold">
                3
              </span>
              <p className="text-[#888888]">
                Once confirmed on-chain, your Pro access activates instantly.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
