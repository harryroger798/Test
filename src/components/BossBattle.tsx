"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Heart, Zap, Shield, Flame } from "lucide-react";
import confetti from "canvas-confetti";

interface BossBattleProps {
  companyName: string;
  difficulty: number;
  onVictory?: () => void;
}

const ATTACKS = [
  { name: "Cancel Request", damage: 15, icon: Zap, color: "#FF3131" },
  { name: "Formal Complaint", damage: 25, icon: Swords, color: "#FF6B35" },
  { name: "Legal Threat", damage: 35, icon: Shield, color: "#FFD700" },
  { name: "RAGE QUIT", damage: 50, icon: Flame, color: "#FF3131" },
];

const BOSS_ATTACKS = [
  "throws a retention offer at you!",
  "uses Confirmshaming! 'Are you sure you want to lose everything?'",
  "deploys endless hold music!",
  "transfers you to another department!",
  "requires a phone call during business hours!",
  "hides the cancel button!",
  "offers a fake discount!",
  "says 'Let me transfer you to our retention specialist...'",
];

export default function BossBattle({ companyName, difficulty, onVictory }: BossBattleProps) {
  const [active, setActive] = useState(false);
  const [playerHp, setPlayerHp] = useState(100);
  const [bossHp, setBossHp] = useState(100);
  const [log, setLog] = useState<string[]>([]);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [shake, setShake] = useState(false);

  const maxBossHp = 50 + difficulty * 10;

  const startBattle = () => {
    setActive(true);
    setPlayerHp(100);
    setBossHp(maxBossHp);
    setLog([`⚔️ BOSS BATTLE: ${companyName} appears!`, `Boss HP: ${maxBossHp} | Difficulty: ${difficulty}/5`]);
    setVictory(false);
    setDefeat(false);
  };

  const attack = (atk: typeof ATTACKS[0]) => {
    if (bossAttacking || victory || defeat) return;

    const dmg = atk.damage + Math.floor(Math.random() * 10);
    const newBossHp = Math.max(0, bossHp - dmg);
    setBossHp(newBossHp);
    setLog((prev) => [...prev, `🗡️ You used ${atk.name}! ${dmg} damage!`]);
    setShake(true);
    setTimeout(() => setShake(false), 300);

    if (newBossHp <= 0) {
      setVictory(true);
      setLog((prev) => [...prev, `🎉 VICTORY! You defeated ${companyName}!`]);
      confetti({ particleCount: 150, spread: 100, colors: ["#FF3131", "#00FF88", "#FFD700"] });
      onVictory?.();
      return;
    }

    setBossAttacking(true);
    setTimeout(() => {
      const bossDmg = Math.floor(5 + difficulty * 3 + Math.random() * 10);
      const bossAtk = BOSS_ATTACKS[Math.floor(Math.random() * BOSS_ATTACKS.length)];
      const newPlayerHp = Math.max(0, playerHp - bossDmg);
      setPlayerHp(newPlayerHp);
      setLog((prev) => [...prev, `👿 ${companyName} ${bossAtk} ${bossDmg} damage!`]);
      setBossAttacking(false);

      if (newPlayerHp <= 0) {
        setDefeat(true);
        setLog((prev) => [...prev, `💀 Defeated! ${companyName} retained your subscription...`]);
      }
    }, 800);
  };

  if (!active) {
    return (
      <motion.button
        onClick={startBattle}
        className="flex w-full items-center justify-center gap-2 border-2 border-[#FF3131] bg-[#FF3131]/10 px-6 py-4 font-bold text-[#FF3131] transition-all hover:bg-[#FF3131] hover:text-white"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Swords className="h-5 w-5" />
        BOSS BATTLE: Cancel {companyName}
      </motion.button>
    );
  }

  return (
    <div className="border-2 border-[#FF3131] bg-[#0A0A0A] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-bold uppercase text-[#FF3131]">⚔️ Boss Battle</div>
        <button onClick={() => setActive(false)} className="text-xs text-[#888888] hover:text-white">Exit</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>You</span>
            <span className="font-mono text-[#00FF88]">{playerHp}/100 HP</span>
          </div>
          <div className="h-3 overflow-hidden bg-[#1E1E1E]">
            <motion.div
              className="h-full bg-[#00FF88]"
              animate={{ width: `${playerHp}%` }}
              transition={{ type: "spring" }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{companyName}</span>
            <span className="font-mono text-[#FF3131]">{bossHp}/{maxBossHp} HP</span>
          </div>
          <div className="h-3 overflow-hidden bg-[#1E1E1E]">
            <motion.div
              className="h-full bg-[#FF3131]"
              animate={{
                width: `${(bossHp / maxBossHp) * 100}%`,
                x: shake ? [0, -3, 3, -3, 0] : 0,
              }}
              transition={{ type: "spring" }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {victory && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-4 border border-[#00FF88]/30 bg-[#00FF88]/10 p-3 text-center"
          >
            <div className="text-lg font-bold text-[#00FF88]">VICTORY!</div>
            <div className="text-xs text-[#888888]">You defeated {companyName}!</div>
          </motion.div>
        )}
        {defeat && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-4 border border-[#FF3131]/30 bg-[#FF3131]/10 p-3 text-center"
          >
            <div className="text-lg font-bold text-[#FF3131]">DEFEATED</div>
            <div className="text-xs text-[#888888]">{companyName} won this round...</div>
            <button onClick={startBattle} className="mt-2 text-xs text-[#FF3131] hover:underline">Try Again</button>
          </motion.div>
        )}
      </AnimatePresence>

      {!victory && !defeat && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {ATTACKS.map((atk) => (
            <motion.button
              key={atk.name}
              onClick={() => attack(atk)}
              disabled={bossAttacking}
              className="flex items-center gap-2 border border-[#1E1E1E] bg-[#141414] p-3 text-left text-sm transition-all hover:border-[#FF3131]/50 disabled:opacity-50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <atk.icon className="h-4 w-4" style={{ color: atk.color }} />
              <div>
                <div className="font-semibold">{atk.name}</div>
                <div className="text-[10px] text-[#888888]">{atk.damage} DMG</div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <div className="max-h-24 overflow-y-auto border-t border-[#1E1E1E] pt-2">
        {log.slice(-5).map((entry, i) => (
          <div key={i} className="text-[11px] text-[#888888]">{entry}</div>
        ))}
      </div>
    </div>
  );
}
