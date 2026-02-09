"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  slug: string;
  category: string;
  avgMonthlyPrice: number | null;
}

export default function AddSubscriptionPage() {
  const { status } = useSession();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [price, setPrice] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [renewalDate, setRenewalDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !price) return;
    setSubmitting(true);
    try {
      await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          monthlyPrice: parseFloat(price),
          billingCycle: cycle,
          renewalDate: renewalDate || null,
        }),
      });
      router.push("/dashboard");
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[#888888] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-6 text-2xl font-bold">Add Subscription</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm text-[#888888]">
              Select Company
            </label>
            {!selectedCompany ? (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-[#1E1E1E] bg-[#141414]">
                  {filtered.slice(0, 20).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setSelectedCompany(c);
                        if (c.avgMonthlyPrice) setPrice(c.avgMonthlyPrice.toString());
                      }}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#1E1E1E]"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-[#888888]">
                        {c.category}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-3">
                <span className="font-semibold">{selectedCompany.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCompany(null)}
                  className="text-xs text-[#FF3131] hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-[#888888]">
                Monthly Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="9.99"
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 font-mono text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-[#888888]">
                Billing Cycle
              </label>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#888888]">
              Next Renewal Date (optional)
            </label>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white outline-none focus:border-[#FF3131]"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedCompany || !price || submitting}
            className="w-full bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add Subscription"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
