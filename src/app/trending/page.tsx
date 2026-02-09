"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, Flame, Clock, AlertTriangle, ArrowRight, Trophy } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  difficultyScore: number;
  darkPatternScore: number;
  totalCancellations: number;
  avgMonthlyPrice: number | null;
  clicksToCancel: number;
  estimatedCancelTime: number;
  cancellationMethod: string;
  knownLawsuits: string | null;
}

export default function TrendingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies?sortBy=totalCancellations&order=desc")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const topCancelled = companies.slice(0, 10);
  const hardestToCancel = [...companies].sort((a, b) => b.difficultyScore - a.difficultyScore).slice(0, 10);
  const worstDarkPatterns = [...companies].sort((a, b) => b.darkPatternScore - a.darkPatternScore).slice(0, 10);
  const phoneOnly = companies.filter((c) => c.cancellationMethod === "phone").slice(0, 10);
  const withLawsuits = companies.filter((c) => c.knownLawsuits).slice(0, 10);

  const totalCancellations = companies.reduce((s, c) => s + c.totalCancellations, 0);
  const avgDifficulty = companies.length > 0
    ? (companies.reduce((s, c) => s + c.difficultyScore, 0) / companies.length).toFixed(1)
    : "0";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">
          <TrendingUp className="mr-2 inline h-8 w-8 text-[#FF3131]" />
          Trending Cancellations
        </h1>
        <p className="mb-8 text-[#888888]">
          Real-time insights into what people are cancelling and which companies are the worst offenders.
        </p>

        <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="text-xs text-[#888888]">Total Cancellations</div>
            <div className="font-mono text-xl font-bold text-[#FF3131]">{totalCancellations.toLocaleString()}</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="text-xs text-[#888888]">Companies Tracked</div>
            <div className="font-mono text-xl font-bold text-white">{companies.length}</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="text-xs text-[#888888]">Avg Difficulty</div>
            <div className="font-mono text-xl font-bold text-[#FF6B35]">{avgDifficulty}/5</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="text-xs text-[#888888]">Active Lawsuits</div>
            <div className="font-mono text-xl font-bold text-[#FFAA00]">{withLawsuits.length}</div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse border border-[#1E1E1E] bg-[#141414]" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Flame className="h-5 w-5 text-[#FF3131]" />
                Most Cancelled Services
              </h2>
              <div className="space-y-2">
                {topCancelled.map((c, i) => (
                  <Link key={c.id} href={`/cancel/${c.slug}`}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3 transition-all hover:border-[#FF3131]/30"
                    >
                      <div className="flex items-center gap-3">
                        {i < 3 && <Trophy className={`h-4 w-4 ${i === 0 ? "text-[#FFD700]" : i === 1 ? "text-[#C0C0C0]" : "text-[#CD7F32]"}`} />}
                        {i >= 3 && <span className="w-4 text-center font-mono text-xs text-[#888888]">{i + 1}</span>}
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-[#888888]">{c.category}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-[#FF3131]">{c.totalCancellations.toLocaleString()} cancellations</span>
                        <ArrowRight className="h-4 w-4 text-[#888888]" />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <AlertTriangle className="h-5 w-5 text-[#FF6B35]" />
                Hardest to Cancel
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {hardestToCancel.map((c, i) => (
                  <Link key={c.id} href={`/cancel/${c.slug}`}>
                    <div className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3 transition-all hover:border-[#FF6B35]/30">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#888888]">#{i + 1}</span>
                        <div>
                          <span className="font-semibold">{c.name}</span>
                          <div className="flex items-center gap-2 text-xs text-[#888888]">
                            <span>{c.clicksToCancel} clicks</span>
                            <span>{c.estimatedCancelTime} min</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-lg font-bold text-[#FF3131]">{c.difficultyScore.toFixed(1)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Clock className="h-5 w-5 text-[#FFAA00]" />
                Worst Dark Pattern Offenders
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {worstDarkPatterns.map((c, i) => (
                  <Link key={c.id} href={`/cancel/${c.slug}`}>
                    <div className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3 transition-all hover:border-[#FFAA00]/30">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#888888]">#{i + 1}</span>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                      <span className="font-mono text-lg font-bold text-[#FF6B35]">{c.darkPatternScore.toFixed(1)}/10</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {phoneOnly.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <AlertTriangle className="h-5 w-5 text-[#FF3131]" />
                  Phone-Only Cancellation (Worst Practice)
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {phoneOnly.map((c) => (
                    <Link key={c.id} href={`/cancel/${c.slug}`}>
                      <div className="flex items-center justify-between border border-[#FF3131]/20 bg-[#141414] p-3 transition-all hover:border-[#FF3131]/40">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-[#FF3131]">Phone Required</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {withLawsuits.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <AlertTriangle className="h-5 w-5 text-[#FFAA00]" />
                  Companies Facing Legal Action
                </h2>
                <div className="space-y-2">
                  {withLawsuits.map((c) => (
                    <Link key={c.id} href={`/cancel/${c.slug}`}>
                      <div className="border border-[#FFAA00]/20 bg-[#141414] p-4 transition-all hover:border-[#FFAA00]/40">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{c.name}</span>
                          <ArrowRight className="h-4 w-4 text-[#888888]" />
                        </div>
                        <p className="mt-1 text-sm text-[#888888]">{c.knownLawsuits}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
