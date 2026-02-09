"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, BookOpen, AlertTriangle, Send, Search, Star, Shield, Bell, ChevronRight, Award, Crown, Lock } from "lucide-react";

interface Guide {
  id: string;
  title: string;
  region: string;
  method: string;
  upvotes: number;
  successCount: number;
  failureCount: number;
  company: { name: string; slug: string };
  author: { name: string | null };
}

interface Submission {
  id: string;
  companyName: string;
  category: string;
  status: string;
  submitter: { name: string | null };
  createdAt: string;
}

interface AlertItem {
  id: string;
  alertType: string;
  title: string;
  message: string;
  severity: string;
  createdAt: string;
  company: { name: string; slug: string } | null;
}

export default function CommunityPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [tab, setTab] = useState<"guides" | "submit" | "alerts" | "report">("guides");
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("");
  const [website, setWebsite] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState("online");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [reportCompanyId, setReportCompanyId] = useState("");
  const [reportType, setReportType] = useState("confirmshaming");
  const [reportDesc, setReportDesc] = useState("");
  const [reportPlatform, setReportPlatform] = useState("web");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [companySearch, setCompanySearch] = useState("");

  useEffect(() => {
    fetch("/api/community/guides").then(r => r.json()).then(setGuides).catch(() => {});
    fetch("/api/community/submit").then(r => r.json()).then(setSubmissions).catch(() => {});
    fetch("/api/alerts").then(r => r.json()).then(setAlerts).catch(() => {});
    fetch("/api/companies").then(r => r.json()).then(setCompanies).catch(() => {});
    if (session) {
      fetch("/api/user/pro-status").then(r => r.json()).then(d => setIsPro(d.isPro)).catch(() => {});
    }
  }, [session]);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) { router.push("/login"); return; }
    const res = await fetch("/api/community/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, category, website, avgMonthlyPrice: price, cancellationMethod: method }),
    });
    if (res.ok) {
      setSubmitSuccess(true);
      setCompanyName(""); setCategory(""); setWebsite(""); setPrice(""); setMethod("online");
      const updated = await fetch("/api/community/submit").then(r => r.json());
      setSubmissions(updated);
    }
  };

  const handleReportDarkPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) { router.push("/login"); return; }
    const res = await fetch("/api/community/dark-patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: reportCompanyId, patternType: reportType, description: reportDesc, platform: reportPlatform }),
    });
    if (res.ok) {
      setReportSuccess(true);
      setReportCompanyId(""); setReportDesc("");
    }
  };

  const severityColor: Record<string, string> = {
    critical: "text-red-500 bg-red-500/10 border-red-500/30",
    warning: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
    info: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  };

  const alertTypeLabel: Record<string, string> = {
    renewal: "Renewal Reminder",
    price_increase: "Price Increase",
    free_trial: "Free Trial Expiry",
    cancel_window: "Cancel Window",
    legal_action: "Legal Action",
    dark_pattern_change: "Dark Pattern Change",
    retention_offer: "Retention Offer",
  };

  const categories = ["Streaming", "Fitness", "Productivity", "Security", "Food Delivery", "News/Media", "Cloud Storage", "Gaming", "Telecom/ISP", "Insurance", "Dating", "Finance/Fintech", "VPN", "Meal Kit", "Pet Services", "Car Insurance", "Home Security", "Marketing Tools", "HR/Payroll", "Hosting/Domains", "Phone Plans", "ISP", "Gym Chains", "Education/Learning", "Design Tools", "Music Streaming", "Health/Wellness", "E-commerce", "Travel", "Fitness App"];

  const darkPatternTypes = ["confirmshaming", "obstruction", "hidden_costs", "forced_continuity", "misdirection", "social_proof", "urgency", "scarcity", "trick_questions", "roach_motel", "bait_switch", "disguised_ads", "friend_spam", "privacy_zuckering"];

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-12">
      <img src="/characters/rage_cool.png" alt="" aria-hidden className="pointer-events-none select-none absolute left-0 top-8 hidden w-[240px] opacity-40 lg:block" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">
            <Users className="mr-3 inline h-9 w-9 text-[#FF3131]" />
            Community Hub
          </h1>
          <p className="text-[#888888]">Contribute guides, report dark patterns, submit companies, and stay informed with alerts.</p>
          {session && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 rounded bg-[#141414] px-4 py-2 border border-[#1E1E1E]">
                <Award className="h-4 w-4 text-[#FF3131]" />
                <span className="text-sm text-[#888888]">Reputation Points are earned by contributing</span>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#1E1E1E] pb-2">
          {[
            { key: "guides" as const, label: "Cancel Guides", icon: BookOpen },
            { key: "submit" as const, label: "Submit Company", icon: Send },
            { key: "report" as const, label: "Report Dark Pattern", icon: AlertTriangle },
            { key: "alerts" as const, label: "Active Alerts", icon: Bell },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSubmitSuccess(false); setReportSuccess(false); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${tab === t.key ? "border-b-2 border-[#FF3131] text-white" : "text-[#888888] hover:text-white"}`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>

        {tab === "guides" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Community Cancel Guides</h2>
              {session && isPro && (
                <Link href="/community/guides/create" className="bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF3131]/80">
                  Create Guide
                </Link>
              )}
              {session && !isPro && (
                <Link href="/pricing" className="flex items-center gap-1 border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-2 text-sm font-semibold text-[#FF6B35] hover:bg-[#FF6B35]/20">
                  <Crown className="h-3 w-3" /> Upgrade to contribute
                </Link>
              )}
            </div>
            {guides.length === 0 ? (
              <div className="border border-[#1E1E1E] bg-[#141414] p-8 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-[#888888]" />
                <p className="text-[#888888]">No community guides yet. Be the first to contribute!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {guides.map(g => (
                  <Link key={g.id} href={`/community/guides/${g.company.slug}`}
                    className="block border border-[#1E1E1E] bg-[#141414] p-4 transition-colors hover:border-[#FF3131]/30">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-[#FF3131]">{g.company.name}</span>
                      <span className="text-xs text-[#888888]">{g.region}</span>
                    </div>
                    <h3 className="mb-2 font-semibold">{g.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-[#888888]">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" />{g.upvotes} votes</span>
                      <span className="text-green-400">{g.successCount} success</span>
                      <span className="text-red-400">{g.failureCount} failed</span>
                      <span>by {g.author.name || "Anonymous"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "submit" && (
          <div className="mx-auto max-w-xl">
            {submitSuccess ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="border border-green-500/30 bg-green-500/10 p-8 text-center">
                <Shield className="mx-auto mb-4 h-12 w-12 text-green-400" />
                <h3 className="mb-2 text-xl font-bold text-green-400">Company Submitted!</h3>
                <p className="mb-4 text-[#888888]">Your submission is pending review. You earned +5 Reputation Points!</p>
                <button onClick={() => setSubmitSuccess(false)} className="bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white">Submit Another</button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmitCompany} className="space-y-4">
                <h2 className="text-xl font-bold">Submit a New Company</h2>
                <p className="text-sm text-[#888888]">Help the community by adding a subscription service not yet in our database.</p>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Company Name *</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} required
                    className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="e.g., Netflix" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Category *</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} required
                    className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-[#888888]">Website</label>
                    <input value={website} onChange={e => setWebsite(e.target.value)}
                      className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#888888]">Monthly Price ($)</label>
                    <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                      className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="9.99" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Cancellation Method</label>
                  <select value={method} onChange={e => setMethod(e.target.value)}
                    className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                    <option value="online">Online</option>
                    <option value="phone">Phone Only</option>
                    <option value="mail">Mail Only</option>
                    <option value="in-person">In-Person</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <button type="submit" disabled={!companyName || !category}
                  className="w-full bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50">
                  Submit Company
                </button>
              </form>
            )}

            {submissions.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 text-lg font-bold">Recent Submissions</h3>
                <div className="space-y-2">
                  {submissions.slice(0, 10).map(s => (
                    <div key={s.id} className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3">
                      <div>
                        <span className="font-semibold">{s.companyName}</span>
                        <span className="ml-2 text-xs text-[#888888]">{s.category}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${s.status === "approved" ? "bg-green-500/10 text-green-400" : s.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "report" && (
          <div className="mx-auto max-w-xl">
            {reportSuccess ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="border border-green-500/30 bg-green-500/10 p-8 text-center">
                <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-green-400" />
                <h3 className="mb-2 text-xl font-bold text-green-400">Dark Pattern Reported!</h3>
                <p className="mb-4 text-[#888888]">Thanks for helping expose deceptive practices. You earned +5 Reputation Points!</p>
                <button onClick={() => setReportSuccess(false)} className="bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white">Report Another</button>
              </motion.div>
            ) : (
              <form onSubmit={handleReportDarkPattern} className="space-y-4">
                <h2 className="text-xl font-bold">Report a Dark Pattern</h2>
                <p className="text-sm text-[#888888]">Spotted a deceptive design? Report it to help the community.</p>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Company *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
                    <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Search company..."
                      className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white outline-none focus:border-[#FF3131]" />
                  </div>
                  {companySearch && !reportCompanyId && (
                    <div className="max-h-36 overflow-y-auto border border-[#1E1E1E] bg-[#141414]">
                      {filteredCompanies.slice(0, 10).map(c => (
                        <button type="button" key={c.id} onClick={() => { setReportCompanyId(c.id); setCompanySearch(c.name); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[#1E1E1E]">{c.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-[#888888]">Pattern Type *</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} required
                      className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                      {darkPatternTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#888888]">Platform</label>
                    <select value={reportPlatform} onChange={e => setReportPlatform(e.target.value)}
                      className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                      <option value="web">Website</option>
                      <option value="ios">iOS App</option>
                      <option value="android">Android App</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Description *</label>
                  <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} required rows={3}
                    className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="Describe the dark pattern you encountered..." />
                </div>
                <button type="submit" disabled={!reportCompanyId || !reportDesc}
                  className="w-full bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50">
                  Report Dark Pattern
                </button>
              </form>
            )}
          </div>
        )}

        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Active Alerts</h2>
              {session && (
                <Link href="/dashboard/alerts" className="flex items-center gap-1 text-sm text-[#FF3131] hover:underline">
                  Alert Preferences <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="border border-[#1E1E1E] bg-[#141414] p-8 text-center">
                <Bell className="mx-auto mb-4 h-12 w-12 text-[#888888]" />
                <p className="text-[#888888]">No active alerts right now. We&apos;ll notify you when something important happens.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(a => (
                  <div key={a.id} className={`border p-4 ${severityColor[a.severity] || severityColor.info}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase">{alertTypeLabel[a.alertType] || a.alertType}</span>
                      <span className="text-xs opacity-60">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="mb-1 font-semibold text-white">{a.title}</h3>
                    <p className="text-sm opacity-80">{a.message}</p>
                    {a.company && (
                      <Link href={`/cancel/${a.company.slug}`} className="mt-2 inline-block text-xs text-[#FF3131] hover:underline">
                        View {a.company.name} &rarr;
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
