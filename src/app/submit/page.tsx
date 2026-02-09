"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Search, CheckCircle } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
}

export default function SubmitPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"offer" | "company">("offer");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [offerType, setOfferType] = useState("discount");
  const [description, setDescription] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [duration, setDuration] = useState("");
  const [script, setScript] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetch("/api/companies")
      .then((r) => r.json())
      .then(setCompanies)
      .catch(() => {});
  }, [status, router]);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    await fetch("/api/retention-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        offerType,
        description,
        discountPct: discountPct ? parseFloat(discountPct) : null,
        duration: duration || null,
        script: script || null,
      }),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
        >
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[#00FF88]" />
          <h1 className="mb-2 text-2xl font-bold">Submitted!</h1>
          <p className="mb-6 text-[#888888]">
            Thanks for helping the community fight back against overpriced subscriptions.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedCompany(null);
              setDescription("");
              setDiscountPct("");
              setDuration("");
              setScript("");
            }}
            className="bg-[#FF3131] px-6 py-2 font-semibold text-white"
          >
            Submit Another
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 text-3xl font-bold">
          <Send className="mr-2 inline h-7 w-7 text-[#FF3131]" />
          Community Submissions
        </h1>
        <p className="mb-8 text-[#888888]">
          Help others save money by sharing retention offers and cancellation tips.
        </p>

        <div className="mb-6 flex border-b border-[#1E1E1E]">
          <button
            onClick={() => setTab("offer")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "offer"
                ? "border-b-2 border-[#FF3131] text-white"
                : "text-[#888888] hover:text-white"
            }`}
          >
            Retention Offer
          </button>
          <button
            onClick={() => setTab("company")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "company"
                ? "border-b-2 border-[#FF3131] text-white"
                : "text-[#888888] hover:text-white"
            }`}
          >
            Report Issue
          </button>
        </div>

        {tab === "offer" && (
          <form onSubmit={handleSubmitOffer} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-[#888888]">Company</label>
              {!selectedCompany ? (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-[#1E1E1E] bg-[#141414]">
                    {filtered.slice(0, 15).map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCompany(c)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-[#1E1E1E]"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3">
                  <span>{selectedCompany.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCompany(null)}
                    className="text-xs text-[#FF3131]"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-[#888888]">Offer Type</label>
                <select
                  value={offerType}
                  onChange={(e) => setOfferType(e.target.value)}
                  className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
                >
                  <option value="discount">Discount</option>
                  <option value="free_months">Free Months</option>
                  <option value="downgrade">Downgrade</option>
                  <option value="pause">Pause</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-[#888888]">Discount % (if applicable)</label>
                <input
                  type="number"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="50"
                  className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#888888]">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 3 months"
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#888888]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the offer you received..."
                rows={3}
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#888888]">Script (what did you say?)</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="What you said to get this offer..."
                rows={2}
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedCompany || !description}
              className="w-full bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50"
            >
              Submit Offer
            </button>
          </form>
        )}

        {tab === "company" && (
          <div className="border border-[#1E1E1E] bg-[#141414] p-6 text-center">
            <p className="text-[#888888]">
              Found incorrect information? Email us at{" "}
              <span className="text-[#FF3131]">support@ragequit.app</span> and
              we&apos;ll update the guide.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
