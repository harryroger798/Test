"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Plus, Trash2, Coins, TrendingUp, AlertTriangle, PieChart } from "lucide-react";

interface SubEntry {
  id: string;
  name: string;
  monthly: number;
  category: string;
}

const CATEGORIES = [
  "Streaming", "Music", "Software", "Gaming", "Fitness",
  "News", "Cloud Storage", "Food Delivery", "Security", "Other",
];

export default function CalculatorPage() {
  const [subs, setSubs] = useState<SubEntry[]>([]);
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState("");
  const [category, setCategory] = useState("Streaming");

  const addSub = () => {
    if (!name || !monthly) return;
    setSubs([...subs, { id: Date.now().toString(), name, monthly: parseFloat(monthly), category }]);
    setName("");
    setMonthly("");
  };

  const removeSub = (id: string) => {
    setSubs(subs.filter((s) => s.id !== id));
  };

  const totalMonthly = subs.reduce((s, sub) => s + sub.monthly, 0);
  const totalYearly = totalMonthly * 12;
  const total5Year = totalYearly * 5;
  const totalLifetime = totalYearly * 30;

  const categoryBreakdown = subs.reduce<Record<string, number>>((acc, sub) => {
    acc[sub.category] = (acc[sub.category] || 0) + sub.monthly;
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  const categoryColors: Record<string, string> = {
    Streaming: "#FF3131",
    Music: "#FF6B35",
    Software: "#FFAA00",
    Gaming: "#00FF88",
    Fitness: "#00AAFF",
    News: "#AA66FF",
    "Cloud Storage": "#FF66AA",
    "Food Delivery": "#66FFAA",
    Security: "#FF9966",
    Other: "#888888",
  };

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-20">
        <div className="absolute inset-0">
          <img src="/images/calculator-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/88" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <img src="/characters/rage_shredder.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-2 top-0 hidden max-h-[200px] w-auto opacity-60 md:block" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">
              <Calculator className="mr-2 inline h-8 w-8 text-[#FF6B35]" />
              Subscription Calculator
            </h1>
            <p className="text-[#888888]">
              See the true cost of your subscriptions over time. Add your services to calculate lifetime spending.
            </p>
          </motion.div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
              <Coins className="h-3 w-3" /> Monthly
            </div>
            <div className="font-mono text-2xl font-bold text-[#FF3131]">${totalMonthly.toFixed(2)}</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
              <TrendingUp className="h-3 w-3" /> Yearly
            </div>
            <div className="font-mono text-2xl font-bold text-[#FF6B35]">${totalYearly.toFixed(2)}</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
              <AlertTriangle className="h-3 w-3" /> 5-Year Cost
            </div>
            <div className="font-mono text-2xl font-bold text-[#FFAA00]">${total5Year.toLocaleString()}</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-[#888888]">
              <PieChart className="h-3 w-3" /> Lifetime (30yr)
            </div>
            <div className="font-mono text-2xl font-bold text-[#FF3131]">${totalLifetime.toLocaleString()}</div>
          </div>
        </div>

        <div className="mb-6 border border-[#1E1E1E] bg-[#141414] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#888888]">ADD SUBSCRIPTION</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Service name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF6B35]"
            />
            <input
              type="number"
              placeholder="Monthly cost ($)"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF6B35] sm:w-40"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B35]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={addSub}
              className="flex items-center justify-center gap-2 bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#FF6B35]/80"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {subs.length > 0 && (
          <>
            <div className="mb-6 space-y-2">
              {subs.map((sub) => (
                <motion.div
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryColors[sub.category] || "#888" }} />
                    <div>
                      <span className="font-semibold">{sub.name}</span>
                      <span className="ml-2 text-xs text-[#888888]">{sub.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-[#FF3131]">${sub.monthly.toFixed(2)}/mo</div>
                      <div className="font-mono text-xs text-[#888888]">${(sub.monthly * 12).toFixed(2)}/yr</div>
                    </div>
                    <button onClick={() => removeSub(sub.id)} className="text-[#888888] hover:text-[#FF3131]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {sortedCategories.length > 1 && (
              <div className="mb-6 border border-[#1E1E1E] bg-[#141414] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#888888]">SPENDING BY CATEGORY</h3>
                <div className="space-y-2">
                  {sortedCategories.map(([cat, amount]) => {
                    const pct = totalMonthly > 0 ? (amount / totalMonthly) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-white">{cat}</span>
                          <span className="font-mono text-[#888888]">${amount.toFixed(2)}/mo ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-[#1E1E1E]">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: categoryColors[cat] || "#888" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
              <h3 className="mb-2 font-bold text-[#FF6B35]">What else could you buy?</h3>
              <div className="grid gap-3 text-sm text-[#888888] sm:grid-cols-2 md:grid-cols-3">
                {totalYearly >= 100 && <div>A weekend getaway ({Math.floor(totalYearly / 300)} trips/yr)</div>}
                {totalYearly >= 50 && <div>Fancy dinners ({Math.floor(totalYearly / 75)} dinners/yr)</div>}
                {total5Year >= 5000 && <div>Emergency fund (${total5Year.toLocaleString()} in 5 years)</div>}
                {total5Year >= 10000 && <div>Investment returns (~${Math.floor(total5Year * 1.4).toLocaleString()} with 7% annual returns)</div>}
                {totalLifetime >= 50000 && <div>Down payment on a house (${totalLifetime.toLocaleString()} over 30 years)</div>}
                {totalMonthly >= 20 && <div>Gym membership ({Math.floor(totalMonthly / 30)} memberships)</div>}
              </div>
            </div>
          </>
        )}

        {subs.length === 0 && (
          <div className="border border-dashed border-[#1E1E1E] bg-[#141414] p-12 text-center">
            <Calculator className="mx-auto mb-3 h-8 w-8 text-[#888888]" />
            <p className="mb-2 text-[#888888]">Add your subscriptions above to see the true cost.</p>
            <p className="text-xs text-[#888888]">The average American spends $219/month on subscriptions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
