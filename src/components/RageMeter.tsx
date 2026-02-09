"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

const LEVELS = [
  { label: "Calm", color: "#00FF88", min: 0 },
  { label: "Annoyed", color: "#FFD700", min: 20 },
  { label: "Frustrated", color: "#FF8C00", min: 40 },
  { label: "Angry", color: "#FF6B35", min: 60 },
  { label: "FULL RAGE", color: "#FF3131", min: 80 },
];

export default function RageMeter() {
  const [rage, setRage] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = Math.min(100, (window.scrollY / scrollHeight) * 100);
      setRage(pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const level = [...LEVELS].reverse().find((l) => rage >= l.min) || LEVELS[0];

  return (
    <div className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <div className="flex flex-col items-center gap-2">
        <motion.div
          animate={{ scale: 1 + rage / 200, rotate: rage > 80 ? [0, -5, 5, -3, 3, 0] : 0 }}
          transition={{ rotate: { repeat: rage > 80 ? Infinity : 0, duration: 0.3 } }}
        >
          <Flame
            className="h-6 w-6"
            style={{ color: level.color, filter: `drop-shadow(0 0 ${rage / 10}px ${level.color})` }}
          />
        </motion.div>
        <div className="relative h-32 w-3 overflow-hidden rounded-full bg-[#1E1E1E]">
          <motion.div
            className="absolute bottom-0 w-full rounded-full"
            style={{ backgroundColor: level.color }}
            animate={{ height: `${rage}%` }}
            transition={{ type: "spring", stiffness: 100 }}
          />
        </div>
        <span className="text-[10px] font-bold uppercase" style={{ color: level.color }}>
          {level.label}
        </span>
      </div>
    </div>
  );
}
