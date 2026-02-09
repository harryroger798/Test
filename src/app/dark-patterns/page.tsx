"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, AlertTriangle, Search, ArrowRight } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  darkPatternScore: number;
  darkPatterns: string[];
  difficultyScore: number;
  clicksToCancel: number;
  estimatedCancelTime: number;
}

const DARK_PATTERN_TAXONOMY: Record<string, { description: string; severity: string; example: string }> = {
  "Confirmshaming": {
    description: "Using guilt-inducing language to discourage cancellation. Makes users feel bad for wanting to leave.",
    severity: "Medium",
    example: "\"No thanks, I don't want to save money\" or \"I'd rather pay full price\"",
  },
  "Roach Motel": {
    description: "Easy to subscribe, extremely difficult to cancel. Sign-up takes 1 click, cancellation requires 10+ steps.",
    severity: "High",
    example: "One-click sign-up online, but cancellation requires a phone call during business hours",
  },
  "Hidden Cancellation": {
    description: "Cancellation options are deliberately hidden or buried in deeply nested menus.",
    severity: "High",
    example: "Cancel button hidden under Settings > Account > Manage > Billing > Advanced > Cancel",
  },
  "Forced Continuity": {
    description: "Free trial automatically converts to a paid subscription without clear warning.",
    severity: "High",
    example: "\"Free 7-day trial\" that charges $99.99 on day 8 with no reminder email",
  },
  "Obstruction": {
    description: "Adding unnecessary steps or barriers to the cancellation process to frustrate users.",
    severity: "High",
    example: "Requiring a mandatory chat with a retention agent before allowing cancellation",
  },
  "Misdirection": {
    description: "Using visual design to direct attention away from the cancellation option toward staying.",
    severity: "Medium",
    example: "Large, colorful \"Keep My Subscription\" button next to tiny gray \"Cancel\" text",
  },
  "Emotional Manipulation": {
    description: "Using emotional appeals, sad imagery, or guilt to prevent cancellation.",
    severity: "Medium",
    example: "Showing sad mascot images or \"Your account will miss you\" messages",
  },
  "Fear-Based Retention": {
    description: "Warning about losing data, progress, or benefits to scare users into staying.",
    severity: "Medium",
    example: "\"You'll lose all your data permanently!\" (when data is actually retained for 30 days)",
  },
  "Forced Phone Call": {
    description: "Requiring users to call to cancel when they signed up online, often with long hold times.",
    severity: "High",
    example: "Online sign-up but cancellation only via phone, Monday-Friday 9am-5pm EST",
  },
  "Countdown Timers": {
    description: "Fake urgency tactics using countdown timers on retention offers.",
    severity: "Low",
    example: "\"This 50% off offer expires in 10:00!\" (timer resets on page refresh)",
  },
  "Dark Countdown": {
    description: "Using fake scarcity or urgency to pressure users into not cancelling.",
    severity: "Medium",
    example: "\"Only 2 spots left at this price!\" or \"Offer expires in 5 minutes\"",
  },
  "Loyalty Tax": {
    description: "Charging loyal customers more than new customers for the same service.",
    severity: "Medium",
    example: "New customers pay $5/mo while existing customers are charged $15/mo for the same plan",
  },
  "Subscription Creep": {
    description: "Gradually increasing prices without clear notification or easy opt-out.",
    severity: "Medium",
    example: "Price increases from $9.99 to $15.49 over 3 years with minimal notice",
  },
  "Bait and Switch": {
    description: "Advertising one price/feature set, then charging more or delivering less after sign-up.",
    severity: "High",
    example: "Advertising \"$4.99/mo\" but actual checkout price is $12.99/mo after \"fees\"",
  },
  "Privacy Zuckering": {
    description: "Tricking users into sharing more personal data than intended during cancellation.",
    severity: "Medium",
    example: "Requiring detailed reasons and personal feedback survey before allowing cancellation",
  },
};

const PATTERN_ALIASES: Record<string, string> = {
  "Roach motel": "Roach Motel",
  "Forced continuity": "Forced Continuity",
  "Hidden cancel button": "Hidden Cancellation",
  "Phone-only cancellation": "Forced Phone Call",
  "Phone cancellation": "Forced Phone Call",
  "In-person or certified mail only": "Forced Phone Call",
  "In-person cancellation": "Forced Phone Call",
  "Phone/email only": "Forced Phone Call",
  "Retention offers": "Obstruction",
  "Retention screens": "Obstruction",
  "Multiple retention screens": "Obstruction",
  "Aggressive retention": "Obstruction",
  "Long hold times": "Obstruction",
  "Transfer maze": "Obstruction",
  "Pause before cancel": "Obstruction",
  "Pause option": "Obstruction",
  "Multiple confirmation screens": "Obstruction",
  "Visual interference": "Misdirection",
  "Preselection": "Misdirection",
  "Trick questions": "Misdirection",
  "Scare tactics": "Fear-Based Retention",
  "Fear-based messaging": "Fear-Based Retention",
  "Equipment return threats": "Fear-Based Retention",
  "Equipment return": "Fear-Based Retention",
  "Streak guilt": "Emotional Manipulation",
  "Early termination fees": "Bait and Switch",
  "Early termination fee (50%)": "Bait and Switch",
  "Early termination fee (75% remaining)": "Bait and Switch",
  "Early cancellation fees": "Bait and Switch",
  "Buyout fees": "Bait and Switch",
  "Discount offers": "Countdown Timers",
  "30-day notice": "Subscription Creep",
  "31-day notice period": "Subscription Creep",
  "30-day notice period": "Subscription Creep",
  "30-day refund window": "Subscription Creep",
  "Notice period": "Subscription Creep",
  "No online cancellation": "Roach Motel",
  "Contract terms vary by location": "Roach Motel",
};

function normalizePattern(dp: string): string {
  return PATTERN_ALIASES[dp] || dp;
}

export default function DarkPatternsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies?sortBy=darkPatternScore&order=desc")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allPatterns = Object.keys(DARK_PATTERN_TAXONOMY);

  const patternCounts = allPatterns.reduce<Record<string, number>>((acc, pattern) => {
    acc[pattern] = companies.filter((c) =>
      Array.isArray(c.darkPatterns) && (c.darkPatterns as string[]).some((dp) => normalizePattern(dp) === pattern)
    ).length;
    return acc;
  }, {});

  const sortedPatterns = allPatterns.sort((a, b) => (patternCounts[b] || 0) - (patternCounts[a] || 0));

  const filteredCompanies = companies.filter((c) => {
    if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedPattern) {
      return Array.isArray(c.darkPatterns) && (c.darkPatterns as string[]).some((dp) => normalizePattern(dp) === selectedPattern);
    }
    return Array.isArray(c.darkPatterns) && (c.darkPatterns as string[]).length > 0;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High": return "text-[#FF3131] border-[#FF3131]/30 bg-[#FF3131]/10";
      case "Medium": return "text-[#FF6B35] border-[#FF6B35]/30 bg-[#FF6B35]/10";
      default: return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
    }
  };

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-20">
        <div className="absolute inset-0">
          <img src="/images/dark-patterns-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/85" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <img src="/characters/rage_face.png" alt="" aria-hidden className="pointer-events-none select-none absolute -right-6 top-0 hidden w-[320px] opacity-60 md:block lg:w-[400px]" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">
              <Eye className="mr-2 inline h-8 w-8 text-[#FF3131]" />
              Dark Pattern Gallery
            </h1>
            <p className="mb-2 text-[#888888]">
              Exposing manipulative design patterns used by subscription services to prevent cancellation.
            </p>
            <p className="text-sm text-[#FF6B35]">
              ICPEN 2024 Sweep: 76% of 642 SaaS companies use at least one dark pattern.
            </p>
          </motion.div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-xl font-bold">Dark Pattern Taxonomy</h2>
        <div className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedPatterns.map((pattern) => {
            const info = DARK_PATTERN_TAXONOMY[pattern];
            const count = patternCounts[pattern] || 0;
            const isSelected = selectedPattern === pattern;

            return (
              <button
                key={pattern}
                onClick={() => setSelectedPattern(isSelected ? null : pattern)}
                className={`border p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#FF3131] bg-[#FF3131]/5"
                    : "border-[#1E1E1E] bg-[#141414] hover:border-[#FF3131]/30"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{pattern}</span>
                  <span className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase ${getSeverityColor(info.severity)}`}>
                    {info.severity}
                  </span>
                </div>
                <p className="mb-2 text-xs text-[#888888]">{info.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] italic text-[#888888]">&ldquo;{info.example}&rdquo;</span>
                </div>
                <div className="mt-2 text-xs text-[#FF3131]">{count} companies</div>
              </button>
            );
          })}
        </div>

        <h2 className="mb-4 text-xl font-bold">
          {selectedPattern ? `Companies Using "${selectedPattern}"` : "Worst Dark Pattern Offenders"}
        </h2>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131] sm:w-64"
          />
          {selectedPattern && (
            <button
              onClick={() => setSelectedPattern(null)}
              className="ml-3 text-sm text-[#FF3131] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse border border-[#1E1E1E] bg-[#141414]" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCompanies.slice(0, 50).map((company, i) => (
              <Link key={company.id} href={`/cancel/${company.slug}`}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="flex flex-col gap-2 border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:border-[#FF3131]/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#888888]">#{i + 1}</span>
                      <span className="font-semibold">{company.name}</span>
                      <span className="text-xs text-[#888888]">{company.category}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.isArray(company.darkPatterns) && (company.darkPatterns as string[]).map((dp) => (
                        <span
                          key={dp}
                          className={`border px-1.5 py-0.5 text-[10px] ${
                            normalizePattern(dp) === selectedPattern ? "border-[#FF3131]/50 bg-[#FF3131]/10 text-[#FF3131]" : "border-[#1E1E1E] text-[#888888]"
                          }`}
                        >
                          {dp}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-[#FF6B35]">{company.darkPatternScore.toFixed(1)}/10</div>
                      <div className="text-xs text-[#888888]">{company.clicksToCancel} clicks, {company.estimatedCancelTime}min</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#888888]" />
                  </div>
                </motion.div>
              </Link>
            ))}

            {filteredCompanies.length === 0 && (
              <div className="border border-dashed border-[#1E1E1E] bg-[#141414] p-12 text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#888888]" />
                <p className="text-[#888888]">No companies found matching your filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
