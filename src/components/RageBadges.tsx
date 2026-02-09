"use client";

import { motion } from "framer-motion";
import { Share2 } from "lucide-react";
import { useState } from "react";

const BADGES = [
  { id: "phone-hostage", name: "Phone Hostage", desc: "Survived 30+ min hold time", icon: "📞", color: "#FF3131", rarity: "Legendary" },
  { id: "dark-pattern-king", name: "Dark Pattern Slayer", desc: "Identified 10+ dark patterns", icon: "👁️", color: "#FF6B35", rarity: "Epic" },
  { id: "speed-demon", name: "Speed Demon", desc: "Cancelled in under 60 seconds", icon: "⚡", color: "#FFD700", rarity: "Rare" },
  { id: "money-saver", name: "Money Saver", desc: "Saved $1,000+ from cancellations", icon: "💰", color: "#00FF88", rarity: "Epic" },
  { id: "corporate-crusher", name: "Corporate Crusher", desc: "Cancelled 10+ subscriptions", icon: "💪", color: "#FF3131", rarity: "Legendary" },
  { id: "retention-master", name: "Retention Offer Master", desc: "Got 50%+ discount 3 times", icon: "🎯", color: "#00BFFF", rarity: "Rare" },
  { id: "contract-detective", name: "Contract Detective", desc: "Found hidden clause in ToS", icon: "🔍", color: "#FF6B35", rarity: "Epic" },
  { id: "rage-quitter", name: "Ultimate Rage Quitter", desc: "Cancelled everything in one day", icon: "🔥", color: "#FF3131", rarity: "Legendary" },
];

const RARITY_COLORS: Record<string, string> = {
  Common: "#888888",
  Rare: "#00BFFF",
  Epic: "#9B59B6",
  Legendary: "#FFD700",
};

export default function RageBadges() {
  const [flipped, setFlipped] = useState<string | null>(null);

  const shareBadge = async (badge: typeof BADGES[0]) => {
    const text = `I earned the "${badge.name}" badge on Rage Quit! ${badge.desc}. Join the fight at ragequit.app #RageQuit`;
    if (navigator.share) {
      try { await navigator.share({ title: badge.name, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BADGES.map((badge) => (
        <motion.div
          key={badge.id}
          className="group relative cursor-pointer border border-[#1E1E1E] bg-[#141414] p-4 text-center transition-all hover:border-[#FF3131]/30"
          whileHover={{ scale: 1.05, y: -3 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFlipped(flipped === badge.id ? null : badge.id)}
        >
          {flipped === badge.id ? (
            <motion.div
              initial={{ rotateY: 90 }}
              animate={{ rotateY: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="text-xs text-[#888888]">{badge.desc}</div>
              <div className="text-[10px] font-bold" style={{ color: RARITY_COLORS[badge.rarity] }}>
                {badge.rarity}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); shareBadge(badge); }}
                className="flex items-center gap-1 text-[10px] text-[#FF3131] hover:underline"
              >
                <Share2 className="h-3 w-3" /> Share
              </button>
            </motion.div>
          ) : (
            <>
              <div className="mb-2 text-3xl">{badge.icon}</div>
              <div className="text-xs font-bold">{badge.name}</div>
              <div className="mt-1 text-[10px] font-bold" style={{ color: RARITY_COLORS[badge.rarity] }}>
                {badge.rarity}
              </div>
              <div
                className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ boxShadow: `inset 0 0 20px ${badge.color}20, 0 0 10px ${badge.color}10` }}
              />
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}
