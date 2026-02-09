"use client";

import { motion } from "framer-motion";

interface DangerGaugeProps {
  score: number;
  size?: number;
}

export default function DangerGauge({ score, size = 200 }: DangerGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getColor = (s: number) => {
    if (s <= 3) return "#00FF88";
    if (s <= 6) return "#FF6B35";
    return "#FF3131";
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke="#1E1E1E"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <motion.path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pt-4">
        <motion.span
          className="font-mono text-4xl font-bold"
          style={{ color: getColor(score) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score.toFixed(1)}
        </motion.span>
      </div>
      <span className="mt-1 text-xs text-[#888888]">DANGER SCORE</span>
    </div>
  );
}
