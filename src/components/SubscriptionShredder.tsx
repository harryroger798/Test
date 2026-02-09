"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const SAMPLE_SUBS = [
  { name: "Netflix", price: 15.49, color: "#E50914" },
  { name: "Spotify", price: 11.99, color: "#1DB954" },
  { name: "Adobe CC", price: 54.99, color: "#FF0000" },
  { name: "McAfee", price: 8.33, color: "#C8102E" },
  { name: "Hulu", price: 17.99, color: "#1CE783" },
  { name: "Disney+", price: 13.99, color: "#113CCF" },
];

export default function SubscriptionShredder() {
  const [subs, setSubs] = useState(SAMPLE_SUBS);
  const [shredding, setShredding] = useState<string | null>(null);
  const [totalSaved, setTotalSaved] = useState(0);
  const [shredded, setShredded] = useState<string[]>([]);
  const shredderRef = useRef<HTMLDivElement>(null);

  const shred = (name: string) => {
    const sub = subs.find((s) => s.name === name);
    if (!sub || shredding) return;
    setShredding(name);

    setTimeout(() => {
      setTotalSaved((prev) => prev + sub.price * 12);
      setShredded((prev) => [...prev, name]);
      setSubs((prev) => prev.filter((s) => s.name !== name));
      setShredding(null);

      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: ["#FF3131", "#00FF88", "#FFD700"],
      });
    }, 800);
  };

  const reset = () => {
    setSubs(SAMPLE_SUBS);
    setShredded([]);
    setTotalSaved(0);
  };

  return (
    <div className="border border-[#1E1E1E] bg-[#141414] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">
          <span className="text-[#FF3131]">Subscription Shredder</span>
        </h3>
        {shredded.length > 0 && (
          <button onClick={reset} className="text-xs text-[#888888] hover:text-white">
            Reset
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-[#888888]">Click subscriptions to shred them and see your savings</p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AnimatePresence>
          {subs.map((sub) => (
            <motion.button
              key={sub.name}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: shredding === sub.name ? [1, 0.9, 1.1, 0] : 1,
                rotate: shredding === sub.name ? [0, -5, 5, -10, 0] : 0,
                y: shredding === sub.name ? 100 : 0,
              }}
              exit={{ opacity: 0, scale: 0, rotate: 20 }}
              transition={{ duration: shredding === sub.name ? 0.8 : 0.3 }}
              onClick={() => shred(sub.name)}
              className="relative overflow-hidden border border-[#1E1E1E] bg-[#0A0A0A] p-3 text-left transition-all hover:border-[#FF3131]/50"
            >
              <div className="text-sm font-semibold">{sub.name}</div>
              <div className="font-mono text-xs text-[#FF3131]">${sub.price}/mo</div>
              {shredding === sub.name && (
                <motion.div
                  className="absolute inset-0 bg-[#FF3131]/20"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  style={{ transformOrigin: "top" }}
                />
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div ref={shredderRef} className="relative overflow-hidden border-t-2 border-[#FF3131] bg-[#0A0A0A] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 w-0.5 bg-[#FF3131]/60" />
              ))}
            </div>
            <span className="text-xs font-bold uppercase text-[#FF3131]">Shredder</span>
          </div>
          {totalSaved > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="font-mono text-sm font-bold text-[#00FF88]"
            >
              Saved ${totalSaved.toFixed(0)}/yr
            </motion.div>
          )}
        </div>
        {shredded.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {shredded.map((name) => (
              <span key={name} className="text-[10px] text-[#888888] line-through">{name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
