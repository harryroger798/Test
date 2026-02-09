"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, ThumbsUp, ThumbsDown, CheckCircle, XCircle, ArrowLeft, Clock, MousePointer, Plus } from "lucide-react";

interface Guide {
  id: string;
  title: string;
  steps: unknown;
  region: string;
  method: string;
  clickCount: number;
  timeMinutes: number;
  tips: string | null;
  verified: boolean;
  upvotes: number;
  downvotes: number;
  successCount: number;
  failureCount: number;
  author: { id: string; name: string | null };
  _count: { votes: number };
}

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  cancellationMethod: string;
}

export default function CompanyGuidesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState([{ step: 1, instruction: "" }]);
  const [region, setRegion] = useState("GLOBAL");
  const [method, setMethod] = useState("online");
  const [clickCount, setClickCount] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [tips, setTips] = useState("");

  useEffect(() => {
    fetch(`/api/companies/${slug}`).then(r => r.json()).then(setCompany).catch(() => {});
    fetch(`/api/community/guides?company=${slug}`).then(r => r.json()).then(setGuides).catch(() => {});
  }, [slug]);

  const addStep = () => setSteps([...steps, { step: steps.length + 1, instruction: "" }]);
  const updateStep = (idx: number, val: string) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], instruction: val };
    setSteps(updated);
  };
  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) { router.push("/login"); return; }
    if (!company) return;
    const res = await fetch("/api/community/guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id, title, steps, region, method,
        clickCount: clickCount ? parseInt(clickCount) : 0,
        timeMinutes: timeMinutes ? parseInt(timeMinutes) : 5,
        tips: tips || null,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setTitle(""); setSteps([{ step: 1, instruction: "" }]); setTips("");
      const updated = await fetch(`/api/community/guides?company=${slug}`).then(r => r.json());
      setGuides(updated);
    }
  };

  const handleVote = async (guideId: string, voteType: string, worked?: boolean) => {
    if (!session) { router.push("/login"); return; }
    await fetch(`/api/community/guides/${guideId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteType, worked }),
    });
    const updated = await fetch(`/api/community/guides?company=${slug}`).then(r => r.json());
    setGuides(updated);
  };

  const regions = ["GLOBAL", "US", "UK", "EU", "Germany", "France", "India", "Australia", "South Korea", "Canada", "Japan", "Brazil"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/community" className="mb-6 inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Community
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">
            <BookOpen className="mr-2 inline h-7 w-7 text-[#FF3131]" />
            {company ? `Cancel Guides for ${company.name}` : "Loading..."}
          </h1>
          {company && (
            <p className="text-[#888888]">Community-built cancellation guides for {company.name}. Vote on guides and share your experience.</p>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-[#888888]">{guides.length} guide{guides.length !== 1 ? "s" : ""}</span>
          {session && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF3131]/80">
              <Plus className="h-4 w-4" /> {showCreate ? "Cancel" : "Create Guide"}
            </button>
          )}
        </div>

        {showCreate && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            onSubmit={handleCreate} className="mb-8 space-y-4 border border-[#FF3131]/30 bg-[#141414] p-6">
            <h3 className="text-lg font-bold">Create a Cancel Guide</h3>
            <div>
              <label className="mb-1 block text-sm text-[#888888]">Guide Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
                placeholder="e.g., How to Cancel via Website" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-[#888888]">Region</label>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#888888]">Method</label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]">
                  <option value="online">Online</option>
                  <option value="phone">Phone</option>
                  <option value="mail">Mail</option>
                  <option value="email">Email</option>
                  <option value="in-person">In-Person</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Clicks</label>
                  <input type="number" value={clickCount} onChange={e => setClickCount(e.target.value)}
                    className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-2 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="5" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#888888]">Minutes</label>
                  <input type="number" value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)}
                    className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-2 py-2 text-sm text-white outline-none focus:border-[#FF3131]" placeholder="10" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#888888]">Steps *</label>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-8 text-center text-sm text-[#FF3131]">{s.step}.</span>
                    <input value={s.instruction} onChange={e => updateStep(i, e.target.value)} required
                      className="flex-1 border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
                      placeholder={`Step ${s.step} instruction...`} />
                    {steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)} className="text-[#888888] hover:text-red-400 text-sm px-2">x</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addStep} className="mt-2 text-sm text-[#FF3131] hover:underline">+ Add Step</button>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#888888]">Tips / Notes</label>
              <textarea value={tips} onChange={e => setTips(e.target.value)} rows={2}
                className="w-full border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
                placeholder="Any tips or notes..." />
            </div>
            <button type="submit" disabled={!title || steps.some(s => !s.instruction)}
              className="w-full bg-[#FF3131] py-3 font-semibold text-white hover:bg-[#FF3131]/80 disabled:opacity-50">
              Publish Guide (+10 Reputation Points)
            </button>
          </motion.form>
        )}

        {guides.length === 0 && !showCreate ? (
          <div className="border border-[#1E1E1E] bg-[#141414] p-12 text-center">
            <BookOpen className="mx-auto mb-4 h-16 w-16 text-[#888888]" />
            <h3 className="mb-2 text-xl font-bold">No guides yet</h3>
            <p className="mb-4 text-[#888888]">Be the first to create a cancellation guide for {company?.name || "this company"}!</p>
            {session ? (
              <button onClick={() => setShowCreate(true)} className="bg-[#FF3131] px-6 py-2 font-semibold text-white">Create First Guide</button>
            ) : (
              <Link href="/login" className="bg-[#FF3131] px-6 py-2 font-semibold text-white">Sign In to Contribute</Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {guides.map(g => {
              const successRate = g.successCount + g.failureCount > 0
                ? Math.round((g.successCount / (g.successCount + g.failureCount)) * 100) : 0;
              const guideSteps = Array.isArray(g.steps) ? g.steps as { step: number; instruction: string }[] : [];
              return (
                <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border border-[#1E1E1E] bg-[#141414] p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{g.title}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[#888888]">
                        <span>{g.region}</span>
                        <span className="capitalize">{g.method}</span>
                        <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" />{g.clickCount} clicks</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{g.timeMinutes} min</span>
                        <span>by {g.author.name || "Anonymous"}</span>
                      </div>
                    </div>
                    {g.verified && <span className="rounded bg-green-500/10 px-2 py-1 text-xs text-green-400">Verified</span>}
                  </div>

                  <div className="mb-4 space-y-2">
                    {guideSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF3131]/20 text-xs text-[#FF3131]">{s.step}</span>
                        <span className="text-sm">{s.instruction}</span>
                      </div>
                    ))}
                  </div>

                  {g.tips && (
                    <div className="mb-4 rounded bg-[#0A0A0A] p-3 text-sm text-[#888888]">
                      <span className="font-semibold text-yellow-400">Tip: </span>{g.tips}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-[#1E1E1E] pt-3">
                    <button onClick={() => handleVote(g.id, "up")}
                      className="flex items-center gap-1 rounded bg-[#1E1E1E] px-3 py-1.5 text-xs hover:bg-green-500/20 hover:text-green-400">
                      <ThumbsUp className="h-3 w-3" /> {g.upvotes}
                    </button>
                    <button onClick={() => handleVote(g.id, "down")}
                      className="flex items-center gap-1 rounded bg-[#1E1E1E] px-3 py-1.5 text-xs hover:bg-red-500/20 hover:text-red-400">
                      <ThumbsDown className="h-3 w-3" /> {g.downvotes}
                    </button>
                    <button onClick={() => handleVote(g.id, "up", true)}
                      className="flex items-center gap-1 rounded bg-[#1E1E1E] px-3 py-1.5 text-xs hover:bg-green-500/20 hover:text-green-400">
                      <CheckCircle className="h-3 w-3" /> Worked ({g.successCount})
                    </button>
                    <button onClick={() => handleVote(g.id, "down", false)}
                      className="flex items-center gap-1 rounded bg-[#1E1E1E] px-3 py-1.5 text-xs hover:bg-red-500/20 hover:text-red-400">
                      <XCircle className="h-3 w-3" /> Didn&apos;t Work ({g.failureCount})
                    </button>
                    {successRate > 0 && (
                      <span className={`text-xs ${successRate >= 70 ? "text-green-400" : successRate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                        {successRate}% success rate
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
