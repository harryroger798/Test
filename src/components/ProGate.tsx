"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Crown, Lock } from "lucide-react";

interface ProGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProGate({ feature, children, fallback }: ProGateProps) {
  const { data: session } = useSession();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetch("/api/user/pro-status")
      .then((r) => r.json())
      .then((d) => {
        setIsPro(d.isPro);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  if (loading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="border border-[#FF3131]/30 bg-[#0A0A0A]/95 p-6 text-center shadow-xl">
          <Lock className="mx-auto mb-3 h-8 w-8 text-[#FF3131]" />
          <h3 className="mb-2 text-lg font-bold">Pro Feature</h3>
          <p className="mb-4 max-w-xs text-sm text-[#888888]">
            {feature} is available with Rage Quit Pro. Upgrade to unlock
            unlimited access.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#FF3131] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#FF3131]/80"
          >
            <Crown className="h-4 w-4" />
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}

export function useProStatus() {
  const { data: session } = useSession();
  const [isPro, setIsPro] = useState(false);
  const [planType, setPlanType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetch("/api/user/pro-status")
      .then((r) => r.json())
      .then((d) => {
        setIsPro(d.isPro);
        setPlanType(d.planType);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  return { isPro, planType, loading };
}
