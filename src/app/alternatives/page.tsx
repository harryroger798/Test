"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Search, Coins, Zap, Filter } from "lucide-react";

interface Alternative {
  name: string;
  price: number;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  avgMonthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  difficultyScore: number;
  alternatives: Alternative[];
  freeTierAvailable: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", INR: "₹", AUD: "A$", CAD: "C$", KRW: "₩",
};

function formatPrice(price: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  if (currency === "KRW") return `${sym}${price.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  return `${sym}${price.toFixed(2)}`;
}

export default function AlternativesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(companies.map((c) => c.category)))];

  const filtered = companies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => selectedCategory === "All" || c.category === selectedCategory)
    .filter((c) => Array.isArray(c.alternatives) && c.alternatives.length > 0);

  const totalSavings = filtered.reduce((sum, c) => {
    const alts = c.alternatives as Alternative[];
    if (!alts.length || !c.avgMonthlyPrice) return sum;
    const cheapest = Math.min(...alts.map((a) => a.price));
    return sum + Math.max(0, (c.avgMonthlyPrice - cheapest) * 12);
  }, 0);

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-20">
        <div className="absolute inset-0">
          <img src="/images/alternatives-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/85" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <img src="/characters/rage_sword.png" alt="" aria-hidden className="pointer-events-none select-none absolute -right-6 top-0 hidden w-[320px] opacity-60 md:block lg:w-[400px]" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">
              <Zap className="mr-2 inline h-8 w-8 text-[#00FF88]" />
              Alternative Finder
            </h1>
            <p className="mb-2 text-[#888888]">
              Find cheaper or free alternatives to expensive subscriptions. Stop overpaying.
            </p>
            <p className="text-sm text-[#00FF88]">
              Potential annual savings across all services: <span className="font-mono font-bold">{totalSavings.toLocaleString()}</span> (mixed currencies)
            </p>
          </motion.div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#00FF88]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-8 text-sm text-white outline-none focus:border-[#00FF88]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse border border-[#1E1E1E] bg-[#141414]" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((company) => {
              const alts = company.alternatives as Alternative[];
              const cheapest = alts.length > 0 ? Math.min(...alts.map((a) => a.price)) : 0;
              const savings = company.avgMonthlyPrice ? Math.max(0, (company.avgMonthlyPrice - cheapest) * 12) : 0;

              return (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-[#1E1E1E] bg-[#141414] p-5"
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/cancel/${company.slug}`} className="text-lg font-bold hover:text-[#FF3131]">
                        {company.name}
                      </Link>
                      <span className="ml-2 text-xs text-[#888888]">{company.category}</span>
                      {company.avgMonthlyPrice && (
                        <span className="ml-2 font-mono text-sm text-[#FF3131]">{formatPrice(company.avgMonthlyPrice, company.currency)}/mo</span>
                      )}
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center gap-1 border border-[#00FF88]/30 bg-[#00FF88]/10 px-3 py-1">
                        <Coins className="h-4 w-4 text-[#00FF88]" />
                        <span className="font-mono text-sm font-bold text-[#00FF88]">Save {formatPrice(savings, company.currency)}/yr</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {alts.map((alt) => (
                      <div key={alt.name} className="flex items-center gap-2 border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-2">
                        <ArrowRight className="h-3 w-3 text-[#00FF88]" />
                        <span className="text-sm text-white">{alt.name}</span>
                        <span className={`font-mono text-xs ${alt.price === 0 ? "text-[#00FF88]" : "text-[#888888]"}`}>
                          {alt.price === 0 ? "FREE" : `${CURRENCY_SYMBOLS[company.currency] || "$"}${alt.price}/mo`}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}

            {filtered.length === 0 && (
              <div className="border border-dashed border-[#1E1E1E] bg-[#141414] p-12 text-center">
                <p className="text-[#888888]">No alternatives found for the current filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
