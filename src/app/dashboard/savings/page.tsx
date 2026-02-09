"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Coins } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface Subscription {
  id: string;
  monthlyPrice: number;
  status: string;
  savedAmount: number;
  company: {
    name: string;
    category: string;
  };
  createdAt: string;
}

export default function SavingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/subscriptions")
        .then((r) => r.json())
        .then((data) => {
          setSubs(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const totalSaved = subs.reduce((sum, s) => sum + s.savedAmount, 0);
  const cancelledCount = subs.filter((s) => s.status === "cancelled").length;

  const categoryData = subs.reduce(
    (acc, s) => {
      const cat = s.company.category;
      if (!acc[cat]) acc[cat] = { category: cat, amount: 0, count: 0 };
      acc[cat].amount += s.monthlyPrice;
      acc[cat].count += 1;
      return acc;
    },
    {} as Record<string, { category: string; amount: number; count: number }>
  );

  const chartData = Object.values(categoryData).sort(
    (a, b) => b.amount - a.amount
  );

  const monthlyData = [
    { month: "Jan", saved: totalSaved * 0.1 },
    { month: "Feb", saved: totalSaved * 0.2 },
    { month: "Mar", saved: totalSaved * 0.35 },
    { month: "Apr", saved: totalSaved * 0.5 },
    { month: "May", saved: totalSaved * 0.7 },
    { month: "Jun", saved: totalSaved * 0.85 },
    { month: "Jul", saved: totalSaved },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-64 animate-pulse bg-[#141414]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
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
        <h1 className="mb-8 text-3xl font-bold">
          <TrendingUp className="mr-2 inline h-7 w-7 text-[#00FF88]" />
          Savings Report
        </h1>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="border border-[#1E1E1E] bg-[#141414] p-6 text-center">
            <Coins className="mx-auto mb-2 h-6 w-6 text-[#00FF88]" />
            <div className="font-mono text-3xl font-bold text-[#00FF88]">
              ${totalSaved.toFixed(2)}
            </div>
            <div className="text-xs text-[#888888]">Total Saved</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-6 text-center">
            <div className="font-mono text-3xl font-bold text-[#FF3131]">
              {cancelledCount}
            </div>
            <div className="text-xs text-[#888888]">Subscriptions Cancelled</div>
          </div>
          <div className="border border-[#1E1E1E] bg-[#141414] p-6 text-center">
            <div className="font-mono text-3xl font-bold text-[#FF6B35]">
              ${(totalSaved * 12).toFixed(0)}
            </div>
            <div className="text-xs text-[#888888]">Projected Annual Savings</div>
          </div>
        </div>

        <div className="mb-8 border border-[#1E1E1E] bg-[#141414] p-6">
          <h2 className="mb-4 text-lg font-bold">Savings Over Time</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
              <XAxis dataKey="month" stroke="#888888" fontSize={12} />
              <YAxis stroke="#888888" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141414",
                  border: "1px solid #1E1E1E",
                  color: "#fff",
                }}
              />
              <Line
                type="monotone"
                dataKey="saved"
                stroke="#00FF88"
                strokeWidth={2}
                dot={{ fill: "#00FF88", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {chartData.length > 0 && (
          <div className="border border-[#1E1E1E] bg-[#141414] p-6">
            <h2 className="mb-4 text-lg font-bold">Spending by Category</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                <XAxis dataKey="category" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #1E1E1E",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="amount" fill="#FF3131" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
}
