"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Coins,
  TrendingUp,
  Calendar,
  Trash2,
  AlertCircle,
  Flame,
  Zap,
  Crown,
  Lock,
} from "lucide-react";
import CountUp from "@/components/CountUp";

interface Subscription {
  id: string;
  monthlyPrice: number;
  billingCycle: string;
  renewalDate: string | null;
  status: string;
  savedAmount: number;
  company: {
    name: string;
    slug: string;
    category: string;
  };
}

const FREE_SUB_LIMIT = 3;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [proInfo, setProInfo] = useState<{ planType: string | null; daysRemaining?: number } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/subscriptions")
        .then((r) => r.json())
        .then((data) => {
          setSubs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      fetch("/api/user/pro-status")
        .then((r) => r.json())
        .then((d) => {
          setIsPro(d.isPro);
          setProInfo(d);
        })
        .catch(() => {});
    }
  }, [status, router]);

  const totalMonthly = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyPrice, 0);

  const totalSaved = subs.reduce((sum, s) => sum + s.savedAmount, 0);

  const activeSubs = subs.filter((s) => s.status === "active");
  const cancelledSubs = subs.filter((s) => s.status === "cancelled");

  const rageScore = Math.min(
    100,
    cancelledSubs.length * 10 + Math.floor(totalSaved / 10)
  );

  const handleCancel = async (id: string) => {
    await fetch(`/api/subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setSubs(
      subs.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s))
    );
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    setSubs(subs.filter((s) => s.id !== id));
  };

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse border border-[#1E1E1E] bg-[#141414]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-12">
      <img src="/characters/rage_laptop.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-2 top-4 hidden max-h-[160px] w-auto opacity-50 lg:block" />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-[#888888]">
            Welcome back, {session?.user?.name || session?.user?.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPro && (
            <span className="flex items-center gap-1 border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3 py-1.5 text-xs font-bold text-[#FF6B35]">
              <Crown className="h-3 w-3" /> PRO
              {proInfo?.planType === "annual" && proInfo.daysRemaining !== undefined && (
                <span className="ml-1 text-[#888888]">({proInfo.daysRemaining}d left)</span>
              )}
            </span>
          )}
          <Link
            href="/dashboard/add"
            className="inline-flex items-center gap-2 bg-[#FF3131] px-4 py-2 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
          >
            <Plus className="h-4 w-4" />
            Add Subscription
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-[#1E1E1E] bg-[#141414] p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
            <Coins className="h-3 w-3" /> Monthly Spend
          </div>
          <CountUp
            end={totalMonthly}
            prefix="$"
            decimals={2}
            className="font-mono text-2xl font-bold text-[#FF3131]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-[#1E1E1E] bg-[#141414] p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
            <TrendingUp className="h-3 w-3" /> Total Saved
          </div>
          <CountUp
            end={totalSaved}
            prefix="$"
            decimals={2}
            className="font-mono text-2xl font-bold text-[#00FF88]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-[#1E1E1E] bg-[#141414] p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
            <Zap className="h-3 w-3" /> Active Subs
          </div>
          <span className="font-mono text-2xl font-bold text-white">
            {activeSubs.length}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-[#1E1E1E] bg-[#141414] p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
            <Flame className="h-3 w-3" /> Rage Score
          </div>
          <span className="font-mono text-2xl font-bold text-[#FF6B35]">
            {rageScore}
          </span>
        </motion.div>
      </div>

      {!isPro && subs.length >= FREE_SUB_LIMIT && (
        <div className="mb-6 border border-[#FF3131]/30 bg-[#FF3131]/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-[#FF3131]" />
            <div>
              <p className="text-sm font-semibold">Free plan limit: {FREE_SUB_LIMIT} subscriptions</p>
              <p className="text-xs text-[#888888]">Upgrade to Pro for unlimited subscription tracking</p>
            </div>
          </div>
          <Link href="/pricing" className="flex items-center gap-1 bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF3131]/80">
            <Crown className="h-4 w-4" /> Upgrade
          </Link>
        </div>
      )}

      {!isPro && (
        <div className="mb-4 flex items-center justify-between border border-[#FF6B35]/30 bg-[#FF6B35]/5 px-4 py-2 text-sm">
          <span className="text-[#888888]">
            Subscriptions: <span className="font-mono font-bold text-white">{subs.length}/{FREE_SUB_LIMIT}</span>
          </span>
          <Link href="/pricing" className="flex items-center gap-1 text-xs font-semibold text-[#FF6B35] hover:underline">
            <Crown className="h-3 w-3" /> Upgrade for unlimited
          </Link>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Your Subscriptions</h2>
        <Link
          href="/dashboard/savings"
          className="text-sm text-[#FF3131] hover:underline"
        >
          View Savings Report →
        </Link>
      </div>

      {subs.length === 0 ? (
        <div className="border border-dashed border-[#1E1E1E] bg-[#141414] p-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[#888888]" />
          <p className="mb-4 text-[#888888]">No subscriptions tracked yet.</p>
          <Link
            href="/dashboard/add"
            className="inline-flex items-center gap-2 bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add Your First Subscription
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map((sub) => (
            <motion.div
              key={sub.id}
              layout
              className={`flex flex-col gap-3 border bg-[#141414] p-4 sm:flex-row sm:items-center sm:justify-between ${
                sub.status === "cancelled"
                  ? "border-[#00FF88]/20"
                  : "border-[#1E1E1E]"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/cancel/${sub.company.slug}`}
                    className="font-semibold hover:text-[#FF3131]"
                  >
                    {sub.company.name}
                  </Link>
                  <span
                    className={`px-2 py-0.5 text-xs ${
                      sub.status === "active"
                        ? "bg-[#FF3131]/10 text-[#FF3131]"
                        : "bg-[#00FF88]/10 text-[#00FF88]"
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-[#888888]">
                  <span>{sub.company.category}</span>
                  <span>{sub.billingCycle}</span>
                  {sub.renewalDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(sub.renewalDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-lg font-bold">
                  ${sub.monthlyPrice.toFixed(2)}
                  <span className="text-xs text-[#888888]">/mo</span>
                </span>
                {sub.status === "active" && (
                  <button
                    onClick={() => handleCancel(sub.id)}
                    className="border border-[#FF3131]/30 px-3 py-1 text-xs text-[#FF3131] transition-all hover:bg-[#FF3131] hover:text-white"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => handleDelete(sub.id)}
                  className="text-[#888888] transition-colors hover:text-[#FF3131]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
