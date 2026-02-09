"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, ArrowLeft, Save, CheckCircle } from "lucide-react";

interface Prefs {
  renewalReminders: boolean;
  renewalDaysBefore: number;
  priceIncreaseAlerts: boolean;
  freeTrialAlerts: boolean;
  trialDaysBefore: number;
  cancelWindowAlerts: boolean;
  legalActionAlerts: boolean;
  darkPatternAlerts: boolean;
  retentionOfferAlerts: boolean;
  emailDigest: string;
}

export default function AlertPreferencesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>({
    renewalReminders: true, renewalDaysBefore: 3,
    priceIncreaseAlerts: true, freeTrialAlerts: true,
    trialDaysBefore: 2, cancelWindowAlerts: true,
    legalActionAlerts: true, darkPatternAlerts: true,
    retentionOfferAlerts: true, emailDigest: "weekly",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") {
      fetch("/api/alerts/preferences").then(r => r.json()).then(p => {
        setPrefs(p);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [status, router]);

  const handleSave = async () => {
    const res = await fetch("/api/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const Toggle = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between border-b border-[#1E1E1E] py-4">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-[#888888]">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#FF3131]" : "bg-[#333]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );

  if (loading || !session) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF3131] border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 text-3xl font-bold">
          <Bell className="mr-2 inline h-7 w-7 text-[#FF3131]" />
          Alert Preferences
        </h1>
        <p className="mb-8 text-[#888888]">Choose which alerts you want to receive to never miss a cancellation window.</p>

        <div className="mb-8 border border-[#1E1E1E] bg-[#141414] p-6">
          <h2 className="mb-4 text-lg font-bold">Subscription Alerts</h2>
          <Toggle label="Renewal Reminders" desc="Get notified before your subscriptions renew"
            checked={prefs.renewalReminders} onChange={v => setPrefs({ ...prefs, renewalReminders: v })} />
          {prefs.renewalReminders && (
            <div className="border-b border-[#1E1E1E] py-3 pl-4">
              <label className="text-sm text-[#888888]">Remind me</label>
              <select value={prefs.renewalDaysBefore} onChange={e => setPrefs({ ...prefs, renewalDaysBefore: parseInt(e.target.value) })}
                className="ml-2 border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-1 text-sm text-white outline-none">
                <option value={1}>1 day before</option>
                <option value={3}>3 days before</option>
                <option value={7}>7 days before</option>
                <option value={14}>14 days before</option>
              </select>
            </div>
          )}
          <Toggle label="Free Trial Expiry" desc="Alert before free trials convert to paid subscriptions"
            checked={prefs.freeTrialAlerts} onChange={v => setPrefs({ ...prefs, freeTrialAlerts: v })} />
          {prefs.freeTrialAlerts && (
            <div className="border-b border-[#1E1E1E] py-3 pl-4">
              <label className="text-sm text-[#888888]">Remind me</label>
              <select value={prefs.trialDaysBefore} onChange={e => setPrefs({ ...prefs, trialDaysBefore: parseInt(e.target.value) })}
                className="ml-2 border border-[#1E1E1E] bg-[#0A0A0A] px-3 py-1 text-sm text-white outline-none">
                <option value={1}>1 day before</option>
                <option value={2}>2 days before</option>
                <option value={3}>3 days before</option>
                <option value={5}>5 days before</option>
              </select>
            </div>
          )}
          <Toggle label="Cancel Window Alerts" desc="Notify when specific cancellation windows are about to close"
            checked={prefs.cancelWindowAlerts} onChange={v => setPrefs({ ...prefs, cancelWindowAlerts: v })} />
        </div>

        <div className="mb-8 border border-[#1E1E1E] bg-[#141414] p-6">
          <h2 className="mb-4 text-lg font-bold">Community Alerts</h2>
          <Toggle label="Price Increase Alerts" desc="When companies announce price hikes on services you track"
            checked={prefs.priceIncreaseAlerts} onChange={v => setPrefs({ ...prefs, priceIncreaseAlerts: v })} />
          <Toggle label="Legal Action Alerts" desc="When companies face FTC/CMA complaints or lawsuits"
            checked={prefs.legalActionAlerts} onChange={v => setPrefs({ ...prefs, legalActionAlerts: v })} />
          <Toggle label="Dark Pattern Changes" desc="When companies change their cancellation process"
            checked={prefs.darkPatternAlerts} onChange={v => setPrefs({ ...prefs, darkPatternAlerts: v })} />
          <Toggle label="Retention Offer Alerts" desc="When users report new retention offers for services you track"
            checked={prefs.retentionOfferAlerts} onChange={v => setPrefs({ ...prefs, retentionOfferAlerts: v })} />
        </div>

        <div className="mb-8 border border-[#1E1E1E] bg-[#141414] p-6">
          <h2 className="mb-4 text-lg font-bold">Email Digest</h2>
          <div className="flex gap-3">
            {["none", "daily", "weekly"].map(opt => (
              <button key={opt} onClick={() => setPrefs({ ...prefs, emailDigest: opt })}
                className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${prefs.emailDigest === opt ? "bg-[#FF3131] text-white" : "border border-[#1E1E1E] bg-[#0A0A0A] text-[#888888] hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSave}
          className="flex w-full items-center justify-center gap-2 bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80">
          {saved ? <><CheckCircle className="h-5 w-5" /> Saved!</> : <><Save className="h-5 w-5" /> Save Preferences</>}
        </button>
      </motion.div>
    </div>
  );
}
