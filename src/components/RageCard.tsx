"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Download, Flame, Skull } from "lucide-react";

interface RageCardProps {
  companyName: string;
  monthlyCost: number;
  yearsSub?: number;
  currency?: string;
  darkPatternScore?: number;
}

export default function RageCard({ companyName, monthlyCost, yearsSub = 3, currency = "$", darkPatternScore = 7 }: RageCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shared, setShared] = useState(false);
  const totalWasted = monthlyCost * 12 * yearsSub;

  const shareCard = async () => {
    const text = `I just rage quit ${companyName}! They stole ${currency}${totalWasted.toLocaleString()} from me over ${yearsSub} years. Dark pattern score: ${darkPatternScore}/10. Check your subscriptions at ragequit.app #RageQuit #SubscriptionShame`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Rage Quit - ${companyName}`, text, url: window.location.href });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className="relative overflow-hidden border-2 border-[#FF3131] bg-gradient-to-br from-[#1A0000] to-[#0A0A0A] p-6"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="absolute -right-4 -top-4 opacity-10">
        <Skull className="h-24 w-24 text-[#FF3131]" />
      </div>

      <div className="mb-1 flex items-center gap-2">
        <Flame className="h-4 w-4 text-[#FF3131]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF3131]">Rage Card</span>
      </div>

      <h3 className="mb-4 text-2xl font-bold">{companyName}</h3>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase text-[#888888]">Total Wasted</div>
          <div className="font-mono text-xl font-bold text-[#FF3131]">{currency}{totalWasted.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[#888888]">Monthly Cost</div>
          <div className="font-mono text-xl font-bold text-[#FF6B35]">{currency}{monthlyCost}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[#888888]">Years Trapped</div>
          <div className="font-mono text-xl font-bold text-[#FFD700]">{yearsSub}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[#888888]">Dark Pattern Score</div>
          <div className="font-mono text-xl font-bold text-[#FF3131]">{darkPatternScore}/10</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[10px] uppercase text-[#888888]">What you could have bought instead</div>
        <div className="mt-1 text-sm text-white">
          {totalWasted >= 5000
            ? `${Math.floor(totalWasted / 1200)} months of rent`
            : totalWasted >= 1000
            ? `${Math.floor(totalWasted / 50)} nice dinners`
            : `${Math.floor(totalWasted / 5)} cups of coffee`}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={shareCard}
          className="flex flex-1 items-center justify-center gap-2 bg-[#FF3131] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#FF3131]/80"
        >
          <Share2 className="h-4 w-4" />
          {shared ? "Copied!" : "Share Rage Card"}
        </button>
      </div>

      <div className="mt-3 text-center text-[10px] text-[#888888]">ragequit.app</div>
    </motion.div>
  );
}
