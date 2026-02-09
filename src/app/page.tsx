"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Shield, TrendingDown, ArrowRight, Star, Zap, Users } from "lucide-react";
import CountUp from "@/components/CountUp";

const shamePreview = [
  { name: "Comcast/Xfinity", difficulty: 5.0, category: "Internet" },
  { name: "Planet Fitness", difficulty: 4.8, category: "Fitness" },
  { name: "Adobe Creative Cloud", difficulty: 4.5, category: "Design" },
  { name: "McAfee Antivirus", difficulty: 4.5, category: "Security" },
  { name: "Adobe Acrobat", difficulty: 4.7, category: "Productivity" },
];

const steps = [
  {
    icon: TrendingDown,
    title: "Track Your Subscriptions",
    desc: "Add your active subscriptions and see exactly how much you're bleeding every month.",
  },
  {
    icon: Flame,
    title: "Get Cancellation Guides",
    desc: "Step-by-step instructions to cancel even the most stubborn services. Community-verified.",
  },
  {
    icon: Shield,
    title: "Scan Contracts",
    desc: "Paste any Terms of Service and we'll detect dark patterns, auto-renewals, and hidden fees.",
  },
];

const testimonials = [
  { name: "Alex R.", text: "Saved $340/year by cancelling subscriptions I forgot about.", saved: 340 },
  { name: "Jordan M.", text: "The retention offer scripts actually work. Got 50% off Spotify.", saved: 60 },
  { name: "Sam K.", text: "Found a cancellation penalty in my gym contract before signing.", saved: 200 },
  { name: "Chris L.", text: "Cancelled Adobe in 5 minutes instead of the usual 30.", saved: 660 },
  { name: "Taylor P.", text: "The Wall of Shame is genius. Companies should be held accountable.", saved: 120 },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden px-4 py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3131]/5 to-transparent" />
        <div className="relative mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="mb-6 inline-flex items-center gap-2 border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-[#888888]">
              <Users className="h-4 w-4 text-[#FF3131]" />
              <span>Join 12,847 users who stopped bleeding money</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          >
            Stop Bleeding Money.{" "}
            <span className="text-[#FF3131]">Start Fighting Back.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mb-8 max-w-2xl text-lg text-[#888888] md:text-xl"
          >
            Cancel unwanted subscriptions, discover retention offers, and scan
            contracts for dark patterns. All free.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/dashboard"
              className="pulse-glow inline-flex items-center gap-2 bg-[#FF3131] px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-[#FF3131]/90"
            >
              Start Saving — Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/wall-of-shame"
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-8 py-4 text-lg text-[#888888] transition-all hover:border-[#FF3131] hover:text-white"
            >
              View Wall of Shame
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-8 md:gap-16"
          >
            <div className="text-center">
              <CountUp
                end={847293}
                prefix="$"
                className="block font-mono text-3xl font-bold text-[#00FF88] md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Total Saved</span>
            </div>
            <div className="h-10 w-px bg-[#1E1E1E]" />
            <div className="text-center">
              <CountUp
                end={12847}
                className="block font-mono text-3xl font-bold text-white md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Users</span>
            </div>
            <div className="h-10 w-px bg-[#1E1E1E]" />
            <div className="text-center">
              <CountUp
                end={31456}
                className="block font-mono text-3xl font-bold text-[#FF3131] md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Cancellations</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-[#1E1E1E] px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold md:text-3xl">
              <Flame className="mr-2 inline h-6 w-6 text-[#FF3131]" />
              Wall of Shame — Worst Offenders
            </h2>
            <Link
              href="/wall-of-shame"
              className="text-sm text-[#FF3131] hover:underline"
            >
              View All →
            </Link>
          </div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-2"
          >
            {shamePreview.map((company, i) => (
              <motion.div
                key={company.name}
                variants={item}
                className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:border-[#FF3131]/30 hover:shadow-[0_0_20px_rgba(255,49,49,0.1)]"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-[#888888]">
                    #{i + 1}
                  </span>
                  <div>
                    <span className="font-semibold">{company.name}</span>
                    <span className="ml-2 text-xs text-[#888888]">
                      {company.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-[#FF3131]">
                    {company.difficulty.toFixed(1)}
                  </span>
                  <span className="text-xs text-[#888888]">/5</span>
                  <div className="ml-2 flex">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={`h-3 w-3 ${
                          j < Math.round(company.difficulty)
                            ? "fill-[#FF3131] text-[#FF3131]"
                            : "text-[#1E1E1E]"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-12 text-center text-2xl font-bold md:text-3xl"
          >
            How It Works
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-3"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={item}
                className="group border border-[#1E1E1E] bg-[#141414] p-6 transition-all hover:border-[#FF3131]/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center bg-[#FF3131]/10">
                  <step.icon className="h-6 w-6 text-[#FF3131]" />
                </div>
                <div className="mb-1 font-mono text-xs text-[#888888]">
                  STEP {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="text-sm text-[#888888]">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-[#1E1E1E] bg-[#141414]/50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold">
            <Zap className="mr-2 inline h-5 w-5 text-[#00FF88]" />
            Real Savings from Real Users
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="min-w-[280px] flex-shrink-0 border border-[#1E1E1E] bg-[#141414] p-5"
              >
                <p className="mb-3 text-sm text-[#888888]">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{t.name}</span>
                  <span className="font-mono text-sm font-bold text-[#00FF88]">
                    +${t.saved}/yr
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Rage Quit",
            description:
              "SaaS cancellation engine that helps users cancel unwanted subscriptions and save money.",
            url: process.env.NEXT_PUBLIC_URL || "https://ragequit.app",
          }),
        }}
      />
    </div>
  );
}
