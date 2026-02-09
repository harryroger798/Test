"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Star, ArrowUpDown, Search, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  difficultyScore: number;
  darkPatternScore: number;
  totalCancellations: number;
  avgMonthlyPrice: number | null;
}

type SortKey = "difficultyScore" | "darkPatternScore" | "totalCancellations" | "name";

export default function WallOfShamePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("difficultyScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const filtered = companies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortBy === "name") return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortBy] ?? 0) - (b[sortBy] ?? 0));
    });

  const getDifficultyColor = (score: number) => {
    if (score >= 4) return "text-[#FF3131]";
    if (score >= 3) return "text-[#FF6B35]";
    if (score >= 2) return "text-yellow-400";
    return "text-[#00FF88]";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">
          <Flame className="mr-2 inline h-8 w-8 text-[#FF3131]" />
          Wall of Shame
        </h1>
        <p className="text-[#888888]">
          Companies ranked by how hard they make it to cancel. Data is
          crowd-sourced and community-verified.
        </p>
      </motion.div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131] sm:w-80"
          />
        </div>
        <span className="text-sm text-[#888888]">
          {filtered.length} companies tracked
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse border border-[#1E1E1E] bg-[#141414]"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden border border-[#1E1E1E] bg-[#141414] md:grid md:grid-cols-12 md:gap-4 md:p-3">
            <button
              onClick={() => toggleSort("name")}
              className="col-span-4 flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white"
            >
              Company <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => toggleSort("difficultyScore")}
              className="col-span-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white"
            >
              Difficulty <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => toggleSort("darkPatternScore")}
              className="col-span-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white"
            >
              Dark Patterns <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => toggleSort("totalCancellations")}
              className="col-span-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white"
            >
              Cancellations <ArrowUpDown className="h-3 w-3" />
            </button>
            <div className="col-span-2 text-right text-xs font-semibold uppercase tracking-wider text-[#888888]">
              Action
            </div>
          </div>

          <div className="space-y-1 md:space-y-0">
            {filtered.map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/cancel/${company.slug}`}
                  className={`flex flex-col gap-3 border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:border-[#FF3131]/30 hover:shadow-[0_0_15px_rgba(255,49,49,0.1)] md:grid md:grid-cols-12 md:items-center md:gap-4 ${
                    company.difficultyScore >= 4.5 ? "border-l-2 border-l-[#FF3131]" : ""
                  }`}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <span className="font-mono text-xs text-[#888888]">
                      #{i + 1}
                    </span>
                    <div>
                      <span className="font-semibold">{company.name}</span>
                      <span className="ml-2 text-xs text-[#888888]">
                        {company.category}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <span
                      className={`font-mono text-lg font-bold ${getDifficultyColor(
                        company.difficultyScore
                      )}`}
                    >
                      {company.difficultyScore.toFixed(1)}
                    </span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`h-3 w-3 ${
                            j < Math.round(company.difficultyScore)
                              ? "fill-[#FF3131] text-[#FF3131]"
                              : "text-[#1E1E1E]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="font-mono text-sm text-[#FF6B35]">
                      {company.darkPatternScore.toFixed(1)}/10
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="font-mono text-sm text-[#888888]">
                      {company.totalCancellations.toLocaleString()}
                    </span>
                  </div>

                  <div className="col-span-2 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-[#FF3131]">
                      Cancel Guide <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
