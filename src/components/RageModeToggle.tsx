"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export default function RageModeToggle() {
  const [rageMode, setRageMode] = useState(false);

  useEffect(() => {
    if (rageMode) {
      document.documentElement.classList.add("rage-mode");
      const shakeTimer = setInterval(() => {
        document.body.style.transform = `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 4}px)`;
      }, 50);
      const stopShake = setTimeout(() => {
        clearInterval(shakeTimer);
        document.body.style.transform = "";
      }, 2000);
      return () => {
        clearInterval(shakeTimer);
        clearTimeout(stopShake);
        document.body.style.transform = "";
      };
    } else {
      document.documentElement.classList.remove("rage-mode");
      document.body.style.transform = "";
    }
  }, [rageMode]);

  return (
    <motion.button
      onClick={() => setRageMode(!rageMode)}
      className={`fixed bottom-20 right-4 z-50 flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all md:bottom-4 ${
        rageMode
          ? "animate-pulse border-[#FF3131] bg-[#FF3131] text-white shadow-[0_0_30px_rgba(255,49,49,0.5)]"
          : "border-[#1E1E1E] bg-[#141414] text-[#888888] hover:border-[#FF3131] hover:text-[#FF3131]"
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title="Toggle Rage Mode"
    >
      <Flame className={`h-4 w-4 ${rageMode ? "animate-bounce" : ""}`} />
      {rageMode ? "RAGE MODE ON" : "RAGE MODE"}
    </motion.button>
  );
}
