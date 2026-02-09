"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Flame, Shield, TrendingDown, ArrowRight, Star, Zap, Users, Bitcoin, Crown, Check, Swords, Trophy, Timer } from "lucide-react";
import { useRef } from "react";
import CountUp from "@/components/CountUp";
import ParticleField from "@/components/ParticleField";
import SocialProofTicker from "@/components/SocialProofTicker";
import SubscriptionShredder from "@/components/SubscriptionShredder";
import RageLeaderboard from "@/components/RageLeaderboard";
import RageBadges from "@/components/RageBadges";

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
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const characterY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const characterScale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <div>
      {/* HERO — Particles + parallax character entrance */}
      <section ref={heroRef} className="relative overflow-hidden px-4 py-24 md:py-32">
        <motion.div className="absolute inset-0" style={{ y: bgY }}>
          <img src="/images/hero-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/85" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3131]/10 to-transparent" />
        <ParticleField className="z-10" />

        <motion.img
          src="/characters/rage_cancel.png"
          alt="Rage character slamming cancel button"
          aria-hidden
          className="pointer-events-none select-none absolute right-0 bottom-0 hidden w-[420px] md:block lg:w-[520px] fire-glow"
          initial={{ x: 200, opacity: 0, rotate: 10 }}
          animate={{ x: 0, opacity: 0.9, rotate: 0 }}
          transition={{ type: "spring", stiffness: 50, damping: 15, delay: 0.3 }}
          style={{ y: characterY, scale: characterScale }}
        />

        <div className="relative z-20 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="mb-6 inline-flex items-center gap-2 border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-[#888888]">
              <Users className="h-4 w-4 text-[#FF3131]" />
              <span>Join 12,847 users who stopped bleeding money</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glitch-text mb-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          >
            Stop Bleeding Money.{" "}
            <motion.span
              className="text-[#FF3131]"
              animate={{ textShadow: ["0 0 10px rgba(255,49,49,0.3)", "0 0 30px rgba(255,49,49,0.6)", "0 0 10px rgba(255,49,49,0.3)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Start Fighting Back.
            </motion.span>
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
              className="pulse-glow inline-flex items-center gap-2 bg-[#FF3131] px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-[#FF3131]/90 hover:scale-105"
            >
              Start Saving — Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/wall-of-shame"
              className="inline-flex items-center gap-2 border border-[#1E1E1E] px-8 py-4 text-lg text-[#888888] transition-all hover:border-[#FF3131] hover:text-white hover:scale-105"
            >
              <Swords className="h-5 w-5" />
              View Wall of Shame
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-8 md:gap-16"
          >
            <motion.div className="text-center" whileHover={{ scale: 1.1 }} transition={{ type: "spring" }}>
              <CountUp
                end={847293}
                prefix="$"
                className="block font-mono text-3xl font-bold text-[#00FF88] md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Total Saved</span>
            </motion.div>
            <div className="h-10 w-px bg-[#1E1E1E]" />
            <motion.div className="text-center" whileHover={{ scale: 1.1 }} transition={{ type: "spring" }}>
              <CountUp
                end={12847}
                className="block font-mono text-3xl font-bold text-white md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Users</span>
            </motion.div>
            <div className="h-10 w-px bg-[#1E1E1E]" />
            <motion.div className="text-center" whileHover={{ scale: 1.1 }} transition={{ type: "spring" }}>
              <CountUp
                end={31456}
                className="block font-mono text-3xl font-bold text-[#FF3131] md:text-4xl"
              />
              <span className="text-sm text-[#888888]">Cancellations</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* LIVE CANCELLATION FEED */}
      <section className="relative border-y border-[#FF3131]/20 px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <SocialProofTicker />
        </div>
      </section>

      {/* WALL OF SHAME PREVIEW */}
      <section className="relative border-y border-[#1E1E1E] px-4 py-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/wall-of-shame-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/90" />
        </div>
        <div className="relative mx-auto max-w-5xl">
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
                whileHover={{ x: 5, borderColor: "rgba(255,49,49,0.5)" }}
                className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:shadow-[0_0_20px_rgba(255,49,49,0.1)]"
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
          {/* Peeking rage character divider */}
          <div className="pointer-events-none absolute bottom-0 left-0 flex h-48 w-full items-end justify-center overflow-hidden">
            <img src="/characters/rage_peek.png" alt="" aria-hidden className="translate-y-12 w-[420px] opacity-90" />
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/how-it-works-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/92" />
        </div>
        <div className="relative mx-auto max-w-5xl">
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
                whileHover={{ y: -5, borderColor: "rgba(255,49,49,0.3)" }}
                className="group border border-[#1E1E1E] bg-[#141414] p-6 transition-all"
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

      <section className="relative border-t border-[#1E1E1E] px-4 py-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/testimonials-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/88" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold">
            <Zap className="mr-2 inline h-5 w-5 text-[#00FF88]" />
            Real Savings from Real Users
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -3, borderColor: "rgba(0,255,136,0.3)" }}
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBSCRIPTION SHREDDER + LEADERBOARD */}
      <section className="relative border-t border-[#1E1E1E] px-4 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3131]/5 to-transparent" />
        <div className="relative mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-2xl font-bold md:text-3xl"
          >
            <Flame className="mr-2 inline h-6 w-6 text-[#FF3131]" />
            Shred Your Subscriptions
          </motion.h2>
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <SubscriptionShredder />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <RageLeaderboard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* RAGE BADGES */}
      <section className="relative border-t border-[#1E1E1E] px-4 py-16 overflow-hidden">
        <div className="relative mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold md:text-3xl">
              <Trophy className="mr-2 inline h-6 w-6 text-[#FFD700]" />
              Collect Rage Badges
            </h2>
            <p className="text-sm text-[#888888]">Earn badges for your cancellation achievements. Share them with the world.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <RageBadges />
          </motion.div>
        </div>
      </section>

      {/* UNIQUE FEATURES SHOWCASE */}
      <section className="relative border-t border-[#1E1E1E] px-4 py-16 overflow-hidden">
        <div className="relative mx-auto max-w-5xl">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 text-center text-2xl font-bold md:text-3xl">
            <Swords className="mr-2 inline h-6 w-6 text-[#FF3131]" />
            Features Nobody Else Has
          </motion.h2>
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Swords, title: "Boss Battle Mode", desc: "Cancel tough subscriptions in RPG boss fight style. Attack with complaints, legal threats, and RAGE QUIT.", color: "#FF3131" },
              { icon: Timer, title: "Speedrun Timer", desc: "Time your cancellations. Compete on the global leaderboard. How fast can you rage quit?", color: "#FFD700" },
              { icon: Trophy, title: "Rage Leaderboard", desc: "See who saved the most, cancelled the most, and has the longest streak.", color: "#00FF88" },
              { icon: Flame, title: "Subscription Shredder", desc: "Click your subscriptions to shred them. Watch them get destroyed with satisfying animations.", color: "#FF6B35" },
              { icon: Shield, title: "Dark Pattern Museum", desc: "Interactive gallery exposing the 15 worst manipulation tactics companies use.", color: "#9B59B6" },
              { icon: Star, title: "Collectible Badges", desc: "Earn rage badges for achievements. Phone Hostage, Speed Demon, Corporate Crusher.", color: "#FFD700" },
            ].map((feat) => (
              <motion.div key={feat.title} variants={item} whileHover={{ y: -5, borderColor: `${feat.color}50` }} className="border border-[#1E1E1E] bg-[#141414] p-5 transition-all">
                <feat.icon className="mb-3 h-8 w-8" style={{ color: feat.color }} />
                <h3 className="mb-1 font-bold">{feat.title}</h3>
                <p className="text-xs text-[#888888]">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* UPGRADE TO PRO */}
      <section className="relative border-t border-[#1E1E1E] px-4 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3131]/5 to-transparent" />
        <div className="relative mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 text-sm text-[#FF6B35]">
              <Bitcoin className="h-4 w-4" />
              Pay with Bitcoin — No intermediaries, no fees
            </div>
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              Upgrade to <span className="text-[#FF3131]">Pro</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-[#888888]">
              Unlock unlimited access to all features with a one-time Bitcoin payment.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="border-2 border-[#FF3131] bg-[#141414] p-6"
            >
              <div className="mb-1 text-xs font-bold text-[#FF3131]">POPULAR</div>
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#FF3131]">$19</span>
                <span className="text-sm text-[#888888]">/year</span>
              </div>
              <div className="mb-4 space-y-2">
                {["Unlimited cancel guides", "Unlimited contract scans", "Full community access", "All 7 alert types"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#00FF88]" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/pricing"
                className="flex w-full items-center justify-center gap-2 bg-[#FF3131] px-4 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
              >
                <Bitcoin className="h-4 w-4" /> Get Annual Pro
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="border border-[#FF6B35]/50 bg-[#141414] p-6"
            >
              <div className="mb-1 text-xs font-bold text-[#FF6B35]">BEST VALUE</div>
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#FF6B35]">$49</span>
                <span className="text-sm text-[#888888]">one-time</span>
              </div>
              <div className="mb-4 space-y-2">
                {["Everything in Annual", "Never expires", "Lifetime access", "Support development"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#00FF88]" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/pricing"
                className="flex w-full items-center justify-center gap-2 border-2 border-[#FF6B35] px-4 py-3 font-semibold text-[#FF6B35] transition-all hover:bg-[#FF6B35] hover:text-white"
              >
                <Crown className="h-4 w-4" /> Get Lifetime Pro
              </Link>
            </motion.div>
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
