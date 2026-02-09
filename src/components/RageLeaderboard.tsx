"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, TrendingUp } from "lucide-react";

const NAMES = ["CancelKing99", "SubSlayer", "RageQuitter", "DarkPatternHunter", "MoneyMaster", "FreedomFighter", "CorporateCrusher", "SubZero", "CancelBot3000", "WalletGuardian", "ScamBuster", "TrialTerminator", "RefundRanger", "PriceFighter", "ContractKiller", "RenewalReaper", "BillingBandit", "SubscriptionSurgeon", "FinePointFinder", "LoopholeLegend"];
const BADGES = ["Phone Hostage Survivor", "Dark Pattern Slayer", "Corporate Crusher", "Retention Offer Master", "Speed Canceller", "Wall of Shame Reporter", "Contract Detective"];

interface LeaderEntry {
  rank: number;
  name: string;
  cancelled: number;
  saved: number;
  badge: string;
  streak: number;
}

function generateLeaderboard(): LeaderEntry[] {
  return NAMES.slice(0, 15).map((name, i) => ({
    rank: i + 1,
    name,
    cancelled: Math.floor(50 - i * 3 + Math.random() * 5),
    saved: Math.floor((5000 - i * 300) + Math.random() * 500),
    badge: BADGES[i % BADGES.length],
    streak: Math.floor(30 - i * 2 + Math.random() * 5),
  }));
}

export default function RageLeaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [tab, setTab] = useState<"saved" | "cancelled" | "streak">("saved");

  useEffect(() => {
    setEntries(generateLeaderboard());
  }, []);

  const sorted = [...entries].sort((a, b) => {
    if (tab === "saved") return b.saved - a.saved;
    if (tab === "cancelled") return b.cancelled - a.cancelled;
    return b.streak - a.streak;
  }).map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <div className="border border-[#1E1E1E] bg-[#141414]">
      <div className="flex items-center justify-between border-b border-[#1E1E1E] px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#FFD700]" />
          <span className="font-bold">Rage Leaderboard</span>
        </div>
        <div className="flex gap-1">
          {(["saved", "cancelled", "streak"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-1 text-[10px] font-bold uppercase ${tab === t ? "bg-[#FF3131] text-white" : "text-[#888888] hover:text-white"}`}
            >
              {t === "saved" ? "$ Saved" : t === "cancelled" ? "Cancelled" : "Streak"}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {sorted.slice(0, 10).map((entry, i) => (
          <motion.div
            key={entry.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center justify-between border-b border-[#1E1E1E]/50 px-4 py-3 ${i < 3 ? "bg-[#FF3131]/5" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-6 text-center font-mono text-sm font-bold ${i === 0 ? "text-[#FFD700]" : i === 1 ? "text-[#C0C0C0]" : i === 2 ? "text-[#CD7F32]" : "text-[#888888]"}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`}
              </span>
              <div>
                <span className="text-sm font-semibold">{entry.name}</span>
                <div className="text-[10px] text-[#888888]">{entry.badge}</div>
              </div>
            </div>
            <div className="text-right">
              {tab === "saved" && (
                <span className="font-mono text-sm font-bold text-[#00FF88]">${entry.saved.toLocaleString()}</span>
              )}
              {tab === "cancelled" && (
                <div className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-[#FF3131]" />
                  <span className="font-mono text-sm font-bold text-[#FF3131]">{entry.cancelled}</span>
                </div>
              )}
              {tab === "streak" && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-[#FFD700]" />
                  <span className="font-mono text-sm font-bold text-[#FFD700]">{entry.streak}d</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
