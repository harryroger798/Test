"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer, Play, Square, RotateCcw, Trophy } from "lucide-react";

const RECORDS = [
  { name: "SpeedCancel_Pro", company: "Netflix", time: 45 },
  { name: "RageQuitter", company: "Spotify", time: 62 },
  { name: "CancelKing99", company: "Adobe CC", time: 180 },
  { name: "SubSlayer", company: "Planet Fitness", time: 420 },
  { name: "FreedomFighter", company: "Comcast", time: 1800 },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${Math.floor(s).toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export default function SpeedrunTimer({ companyName }: { companyName?: string }) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    setRunning(true);
    setTime(0);
    intervalRef.current = setInterval(() => {
      setTime((t) => t + 0.01);
    }, 10);
  };

  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!best || time < best) setBest(time);
  };

  const reset = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTime(0);
  };

  return (
    <div className="border border-[#FFD700]/30 bg-[#141414] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-[#FFD700]" />
          <span className="text-sm font-bold">Cancellation Speedrun</span>
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs text-[#FFD700]">
            <Trophy className="h-3 w-3" /> Best: {formatTime(best)}
          </div>
        )}
      </div>

      <div className="mb-3 text-center">
        <motion.div
          className="font-mono text-3xl font-bold"
          animate={{ color: running ? "#FF3131" : "#FFFFFF" }}
        >
          {formatTime(time)}
        </motion.div>
        {companyName && (
          <div className="mt-1 text-xs text-[#888888]">Cancelling: {companyName}</div>
        )}
      </div>

      <div className="flex gap-2">
        {!running ? (
          <button
            onClick={start}
            className="flex flex-1 items-center justify-center gap-1 bg-[#00FF88] px-3 py-2 text-sm font-bold text-black"
          >
            <Play className="h-3 w-3" /> Start
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex flex-1 items-center justify-center gap-1 bg-[#FF3131] px-3 py-2 text-sm font-bold text-white"
          >
            <Square className="h-3 w-3" /> Stop
          </button>
        )}
        <button
          onClick={reset}
          className="flex items-center justify-center border border-[#1E1E1E] px-3 py-2 text-sm text-[#888888] hover:text-white"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-3 border-t border-[#1E1E1E] pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase text-[#888888]">Global Records</div>
        {RECORDS.map((r, i) => (
          <div key={r.name} className="flex items-center justify-between py-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#888888]">#{i + 1}</span>
              <span>{r.name}</span>
              <span className="text-[#888888]">({r.company})</span>
            </div>
            <span className="font-mono text-[#FFD700]">{formatTime(r.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
