"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Flame,
  ArrowUpDown,
  Search,
  ExternalLink,
  Scale,
  Clock,
  MousePointerClick,
  Filter,
  AlertTriangle,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  regions: string[];
  difficultyScore: number;
  darkPatternScore: number;
  darkPatterns: string[];
  totalCancellations: number;
  avgMonthlyPrice: number | null;
  currency: string;
  clicksToCancel: number;
  estimatedCancelTime: number;
  cancellationMethod: string;
  freeTierAvailable: boolean;
  headquarters: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", INR: "₹", AUD: "A$", CAD: "C$", KRW: "₩",
};

function formatPrice(price: number | null, currency: string): string {
  if (price === null || price === 0) return "";
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  if (currency === "KRW") return `${sym}${price.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  return `${sym}${price.toFixed(2)}`;
}

type SortKey = "difficultyScore" | "darkPatternScore" | "totalCancellations" | "name" | "clicksToCancel" | "estimatedCancelTime";

const REGIONS = [
  { code: "", label: "All Regions", flag: "🌍" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { code: "EU", label: "European Union", flag: "🇪🇺" },
  { code: "GERMANY", label: "Germany", flag: "🇩🇪" },
  { code: "FRANCE", label: "France", flag: "🇫🇷" },
  { code: "INDIA", label: "India", flag: "🇮🇳" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "SOUTH_KOREA", label: "South Korea", flag: "🇰🇷" },
  { code: "CANADA", label: "Canada", flag: "🇨🇦" },
];

const REGIONAL_LAWS: Record<string, { title: string; description: string; penalty: string; source: string }[]> = {
  US: [
    { title: "FTC Click-to-Cancel Rule (2024)", description: "Requires companies to make cancellation as easy as sign-up. One-click cancellation mandatory for online subscriptions.", penalty: "Up to $50,120 per violation", source: "Federal Trade Commission" },
    { title: "Restore Online Shoppers Confidence Act", description: "Prohibits charging consumers for goods/services sold through negative option marketing unless clear disclosure is provided.", penalty: "FTC enforcement action", source: "15 U.S.C. 8401-8405" },
  ],
  UK: [
    { title: "Digital Markets, Competition and Consumers Act 2024", description: "Bans subscription traps. Companies must provide clear info before sign-up, send reminders before renewal, and offer easy cancellation.", penalty: "Up to 10% of global annual turnover", source: "UK Parliament" },
    { title: "Consumer Rights Act 2015", description: "Provides consumers with the right to cancel digital content subscriptions within 14 days of purchase.", penalty: "Enforcement by CMA", source: "Consumer Rights Act 2015" },
  ],
  EU: [
    { title: "EU Digital Fairness Act (Proposed)", description: "Targets dark patterns in subscription services. Mandates transparent cancellation processes across all member states.", penalty: "Up to 4% of annual global turnover", source: "European Commission" },
    { title: "Consumer Rights Directive 2011/83/EU", description: "14-day right of withdrawal for online purchases. Mandatory pre-contractual information about cancellation rights.", penalty: "Member state enforcement", source: "European Parliament" },
  ],
  GERMANY: [
    { title: "Kuendigungs-Button Law (2022)", description: "Every website offering subscriptions must have a clearly visible cancellation button. Two-click maximum to initiate cancellation.", penalty: "Up to 50,000 EUR per violation", source: "German Civil Code (BGB) Section 312k" },
    { title: "Subscription Contract Modernization Act", description: "Auto-renewing contracts can only extend month-to-month after initial term. Maximum initial term of 2 years.", penalty: "Contract terms deemed void", source: "BGB Sections 309, 310" },
  ],
  FRANCE: [
    { title: "Three-Click Cancellation Rule", description: "Consumers must be able to cancel any online subscription within three clicks. Applies to all digital services.", penalty: "DGCCRF enforcement", source: "French Consumer Code" },
    { title: "Hamon Law (2014)", description: "Strengthened consumer rights for distance selling. 14-day cooling-off period for all online purchases.", penalty: "Up to 15,000 EUR for individuals, 75,000 EUR for companies", source: "Law No. 2014-344" },
  ],
  INDIA: [
    { title: "Consumer Protection Act 2019", description: "Prohibits unfair trade practices including dark patterns. Central Consumer Protection Authority can investigate suo motu.", penalty: "Up to 10 lakh INR for first offense, 50 lakh INR for subsequent", source: "CPA 2019, Section 21" },
    { title: "Guidelines for Prevention of Dark Patterns 2023", description: "Explicitly bans 13 types of dark patterns including subscription traps, forced continuity, and hidden costs.", penalty: "Action under Consumer Protection Act", source: "Ministry of Consumer Affairs" },
  ],
  AU: [
    { title: "Australian Consumer Law (ACL)", description: "Prohibits misleading and deceptive conduct. ACCC has actively pursued subscription trap cases against major companies.", penalty: "Up to AUD 50 million per violation for corporations", source: "Competition and Consumer Act 2010" },
    { title: "ACCC Subscription Guidelines", description: "75% of Australians reported negative subscription experiences. ACCC conducting ongoing sweep of subscription practices.", penalty: "ACCC enforcement action", source: "ACCC/CPRC Report 2024" },
  ],
  SOUTH_KOREA: [
    { title: "E-Commerce Consumer Protection Act", description: "Strict regulations on subscription auto-renewal. Companies must notify consumers before renewal and provide easy cancellation.", penalty: "Up to 100 million KRW fine", source: "Act on Consumer Protection in E-Commerce" },
    { title: "Dark Pattern Regulation Guidelines (2023)", description: "Korea Fair Trade Commission crackdown on manipulative UI patterns in subscription services.", penalty: "KFTC corrective orders and fines", source: "Korea Fair Trade Commission" },
  ],
  CANADA: [
    { title: "Competition Act - Drip Pricing Provisions", description: "Prohibits drip pricing and hidden fees. Requires all-inclusive pricing for advertised products and services.", penalty: "Up to CAD 10 million for first offense", source: "Competition Act, Section 74.01" },
    { title: "Canadian Anti-Spam Legislation (CASL)", description: "Requires express consent for commercial electronic messages. Applies to subscription renewal notifications.", penalty: "Up to CAD 10 million per violation", source: "CASL S.C. 2010, c. 23" },
  ],
};

const CATEGORIES = [
  "All", "Streaming", "ISP", "Gym Chains", "Phone Plans", "Car Insurance",
  "News/Magazines", "Fintech", "Hosting/Domains", "Food Delivery", "Telecom",
  "Telecom/ISP", "Education/Learning", "Meal Kit", "Marketing Tools",
  "Home Security", "Design Tools", "CRM Software", "E-commerce",
  "Health/Wellness", "Dating Apps", "VPN", "Music Streaming",
  "Productivity Tools", "Beauty/Grooming", "Project Management",
  "Pet Services", "Audiobooks", "Video Conferencing", "AI Tools",
  "HR/Payroll", "Accounting Software", "Cloud Backup", "Cloud Storage",
  "Travel", "Antivirus/Security", "Fitness App", "Meditation Apps",
  "Gaming", "Language Learning", "Music", "Internet/Cable", "Fitness",
  "Software/Productivity", "Security", "News/Media", "AI/Tech",
  "Education", "Dating", "Entertainment/Misc",
];

export default function WallOfShamePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("difficultyScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showLaws, setShowLaws] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedRegion) params.set("region", selectedRegion);
    fetch(`/api/companies?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedRegion]);

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
    .filter((c) => selectedCategory === "All" || c.category === selectedCategory)
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

  const getDifficultyBg = (score: number) => {
    if (score >= 4) return "bg-[#FF3131]";
    if (score >= 3) return "bg-[#FF6B35]";
    if (score >= 2) return "bg-yellow-400";
    return "bg-[#00FF88]";
  };

  const avgDifficulty = filtered.length > 0
    ? (filtered.reduce((s, c) => s + c.difficultyScore, 0) / filtered.length).toFixed(1)
    : "0.0";

  const avgDarkPattern = filtered.length > 0
    ? (filtered.reduce((s, c) => s + c.darkPatternScore, 0) / filtered.length).toFixed(1)
    : "0.0";

  const worstOffender = filtered.length > 0
    ? filtered.reduce((worst, c) => c.difficultyScore > worst.difficultyScore ? c : worst, filtered[0])
    : null;

  const regionLabel = REGIONS.find((r) => r.code === selectedRegion)?.label || "Global";
  const regionLaws = selectedRegion ? REGIONAL_LAWS[selectedRegion] || [] : [];

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-24">
        <div className="absolute inset-0">
          <img src="/images/wall-of-shame-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/88" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <img src="/characters/rage_point.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-4 bottom-0 z-10 hidden max-h-[220px] w-auto opacity-80 md:block" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-20 mx-auto max-w-7xl">
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <Flame className="mr-2 inline h-8 w-8 text-[#FF3131]" />
            Wall of Shame
          </h1>
          <p className="text-[#888888]">
            {filtered.length} companies ranked by how hard they make it to cancel.
            {selectedRegion && ` Filtered for ${regionLabel}.`}
          </p>
        </motion.div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8">

      <div className="mb-6 flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <button
            key={r.code}
            onClick={() => { setSelectedRegion(r.code); setLoading(true); }}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-all ${
              selectedRegion === r.code
                ? "border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]"
                : "border-[#1E1E1E] text-[#888888] hover:border-[#FF3131]/50 hover:text-white"
            }`}
          >
            <span>{r.flag}</span>
            <span className="hidden sm:inline">{r.label}</span>
            <span className="sm:hidden">{r.code || "All"}</span>
          </button>
        ))}
      </div>

      {selectedRegion && regionLaws.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6">
          <button
            onClick={() => setShowLaws(!showLaws)}
            className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#FF6B35] hover:text-[#FF3131]"
          >
            <Scale className="h-4 w-4" />
            {showLaws ? "Hide" : "Show"} {regionLabel} Consumer Protection Laws ({regionLaws.length})
          </button>
          {showLaws && (
            <div className="grid gap-3 md:grid-cols-2">
              {regionLaws.map((law) => (
                <div key={law.title} className="border border-[#1E1E1E] bg-[#141414] p-4">
                  <h4 className="mb-1 text-sm font-bold text-white">{law.title}</h4>
                  <p className="mb-2 text-xs text-[#888888]">{law.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#FF3131]">Penalty: {law.penalty}</span>
                    <span className="text-xs text-[#888888]">{law.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="border border-[#1E1E1E] bg-[#141414] p-3">
          <div className="text-xs text-[#888888]">Companies</div>
          <div className="font-mono text-xl font-bold text-white">{filtered.length}</div>
        </div>
        <div className="border border-[#1E1E1E] bg-[#141414] p-3">
          <div className="text-xs text-[#888888]">Avg Difficulty</div>
          <div className={`font-mono text-xl font-bold ${getDifficultyColor(parseFloat(avgDifficulty))}`}>{avgDifficulty}/5</div>
        </div>
        <div className="border border-[#1E1E1E] bg-[#141414] p-3">
          <div className="text-xs text-[#888888]">Avg Dark Patterns</div>
          <div className="font-mono text-xl font-bold text-[#FF6B35]">{avgDarkPattern}/10</div>
        </div>
        <div className="border border-[#1E1E1E] bg-[#141414] p-3">
          <div className="text-xs text-[#888888]">Worst Offender</div>
          <div className="truncate font-mono text-sm font-bold text-[#FF3131]">{worstOffender?.name || "N/A"}</div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131] sm:w-64"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-8 text-sm text-white outline-none focus:border-[#FF3131]"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse border border-[#1E1E1E] bg-[#141414]" />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden border border-[#1E1E1E] bg-[#141414] md:grid md:grid-cols-12 md:gap-2 md:p-3">
            <button onClick={() => toggleSort("name")} className="col-span-3 flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Company <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("difficultyScore")} className="col-span-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Difficulty <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("darkPatternScore")} className="col-span-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Dark Patterns <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("clicksToCancel")} className="col-span-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Clicks <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("estimatedCancelTime")} className="col-span-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Time <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("totalCancellations")} className="col-span-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#888888] hover:text-white">
              Cancels <ArrowUpDown className="h-3 w-3" />
            </button>
            <div className="col-span-2 text-right text-xs font-semibold uppercase tracking-wider text-[#888888]">Action</div>
          </div>

          <div className="space-y-1 md:space-y-0">
            {filtered.map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 1) }}
              >
                <Link
                  href={`/cancel/${company.slug}`}
                  className={`flex flex-col gap-3 border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:border-[#FF3131]/30 hover:shadow-[0_0_15px_rgba(255,49,49,0.1)] md:grid md:grid-cols-12 md:items-center md:gap-2 ${
                    company.difficultyScore >= 4.5 ? "border-l-2 border-l-[#FF3131]" : ""
                  }`}
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <span className="font-mono text-xs text-[#888888]">#{i + 1}</span>
                    <div>
                      <span className="font-semibold">{company.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#888888]">{company.category}</span>
                        {company.cancellationMethod === "phone" && <span className="text-xs text-[#FF6B35]">Phone Only</span>}
                        {company.cancellationMethod === "in-person" && <span className="text-xs text-[#FF3131]">In-Person</span>}
                        {company.freeTierAvailable && <span className="text-xs text-[#00FF88]">Free Tier</span>}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className={`font-mono text-lg font-bold ${getDifficultyColor(company.difficultyScore)}`}>
                        {company.difficultyScore.toFixed(1)}
                      </span>
                      <div className="h-1.5 w-16 bg-[#1E1E1E]">
                        <div className={`h-full ${getDifficultyBg(company.difficultyScore)}`} style={{ width: `${(company.difficultyScore / 5) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="font-mono text-sm text-[#FF6B35]">{company.darkPatternScore.toFixed(1)}/10</span>
                    {Array.isArray(company.darkPatterns) && company.darkPatterns.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {(company.darkPatterns as string[]).slice(0, 2).map((dp) => (
                          <span key={dp} className="text-[10px] text-[#888888]">{dp}</span>
                        ))}
                        {(company.darkPatterns as string[]).length > 2 && (
                          <span className="text-[10px] text-[#888888]">+{(company.darkPatterns as string[]).length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-1 flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3 text-[#888888]" />
                    <span className="font-mono text-sm text-[#888888]">{company.clicksToCancel}</span>
                  </div>

                  <div className="col-span-1 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#888888]" />
                    <span className="font-mono text-sm text-[#888888]">{company.estimatedCancelTime}m</span>
                  </div>

                  <div className="col-span-1">
                    <span className="font-mono text-sm text-[#888888]">
                      {company.totalCancellations > 1000 ? `${(company.totalCancellations / 1000).toFixed(0)}k` : company.totalCancellations}
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

          {filtered.length === 0 && (
            <div className="border border-dashed border-[#1E1E1E] bg-[#141414] p-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#888888]" />
              <p className="text-[#888888]">No companies found matching your filters.</p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
