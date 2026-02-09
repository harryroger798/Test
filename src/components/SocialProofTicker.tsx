"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

const NAMES = ["Alex", "Jordan", "Sam", "Chris", "Taylor", "Morgan", "Riley", "Casey", "Jamie", "Drew", "Avery", "Quinn", "Kai", "Sage", "River", "Dakota", "Phoenix", "Rowan", "Skyler", "Emery"];
const COMPANIES = ["Netflix", "Adobe", "Spotify", "Planet Fitness", "McAfee", "AT&T", "Comcast", "Hulu", "Disney+", "NordVPN", "Grammarly", "LinkedIn Premium", "Xbox Game Pass", "YouTube Premium", "HelloFresh", "BetterHelp", "Peacock", "SiriusXM", "Norton", "Dropbox"];
const LOCATIONS = ["New York", "London", "Toronto", "Sydney", "Berlin", "Mumbai", "Seoul", "Paris", "Tokyo", "Melbourne", "Chicago", "Dublin", "Amsterdam", "Singapore", "Stockholm"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface FeedItem {
  id: number;
  name: string;
  company: string;
  location: string;
  saved: number;
  time: string;
}

export default function SocialProofTicker() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((c) => c + 1);
      const saved = Math.floor(5 + Math.random() * 50) * 12;
      const mins = Math.floor(1 + Math.random() * 30);
      setItems((prev) => {
        const next = [
          {
            id: Date.now(),
            name: randomItem(NAMES),
            company: randomItem(COMPANIES),
            location: randomItem(LOCATIONS),
            saved,
            time: `${mins}m ago`,
          },
          ...prev,
        ].slice(0, 5);
        return next;
      });
    }, 4000);

    setItems([
      { id: 1, name: randomItem(NAMES), company: randomItem(COMPANIES), location: randomItem(LOCATIONS), saved: 288, time: "2m ago" },
      { id: 2, name: randomItem(NAMES), company: randomItem(COMPANIES), location: randomItem(LOCATIONS), saved: 156, time: "5m ago" },
      { id: 3, name: randomItem(NAMES), company: randomItem(COMPANIES), location: randomItem(LOCATIONS), saved: 420, time: "8m ago" },
    ]);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-[#1E1E1E] bg-[#141414]/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-[#1E1E1E] px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-[#00FF88]">Live Cancellations</span>
      </div>
      <div className="max-h-[200px] overflow-hidden px-4 py-2">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="border-b border-[#1E1E1E]/50 py-2 last:border-0"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-[#FF3131]" />
                  <span className="text-white">{item.name}</span>
                  <span className="text-[#888888]">cancelled</span>
                  <span className="font-semibold text-[#FF3131]">{item.company}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#00FF88]">+${item.saved}/yr</span>
                  <span className="text-[#888888]">{item.time}</span>
                </div>
              </div>
              <div className="mt-0.5 text-[10px] text-[#888888]">{item.location}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
