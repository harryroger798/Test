"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bitcoin,
  Copy,
  Check,
  Clock,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Crown,
} from "lucide-react";
import QRCode from "qrcode";

interface PaymentData {
  id: string;
  invoiceId: string;
  planType: string;
  amountUsd: number;
  amountBtc: number;
  btcAddress: string;
  btcRate: number;
  status: string;
  txHash: string | null;
  expiresAt: string;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(900);
  const [checking, setChecking] = useState(false);

  const checkPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/verify/${invoiceId}`);
      const data = await res.json();
      if (data.payment) {
        setPayment(data.payment);
        if (data.remainingSeconds !== undefined) {
          setRemainingSeconds(data.remainingSeconds);
        }
      }
      return data.status;
    } catch {
      return null;
    }
  }, [invoiceId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    checkPayment();
  }, [authStatus, router, checkPayment]);

  useEffect(() => {
    if (!payment || payment.status === "completed" || payment.status === "expired")
      return;

    const interval = setInterval(async () => {
      const status = await checkPayment();
      if (status === "completed" || status === "expired") {
        clearInterval(interval);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [payment, checkPayment]);

  useEffect(() => {
    if (!payment || payment.status !== "pending") return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [payment]);

  useEffect(() => {
    if (!payment) return;
    const btcUri = `bitcoin:${payment.btcAddress}?amount=${payment.amountBtc}&label=RageQuit%20Pro`;
    QRCode.toDataURL(btcUri, {
      width: 280,
      margin: 2,
      color: { dark: "#FFFFFF", light: "#0A0A0A" },
    }).then(setQrDataUrl);
  }, [payment]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleManualConfirm = async () => {
    setChecking(true);
    const status = await checkPayment();
    if (status !== "completed") {
      setTimeout(() => setChecking(false), 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!payment) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF3131]" />
      </div>
    );
  }

  if (payment.status === "completed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          <Crown className="mx-auto mb-4 h-16 w-16 text-[#00FF88]" />
        </motion.div>
        <h1 className="mb-2 text-3xl font-bold text-[#00FF88]">Payment Confirmed!</h1>
        <p className="mb-4 text-[#888888]">
          You now have {payment.planType === "lifetime" ? "lifetime" : "annual"} Pro
          access. All features are unlocked.
        </p>
        {payment.txHash && (
          <a
            href={`https://mempool.space/tx/${payment.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-flex items-center gap-1 text-sm text-[#FF6B35] hover:underline"
          >
            View transaction on mempool.space
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <div className="mt-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-[#FF3131] px-8 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (payment.status === "expired" || remainingSeconds <= 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-[#FF6B35]" />
        <h1 className="mb-2 text-3xl font-bold">Invoice Expired</h1>
        <p className="mb-6 text-[#888888]">
          This payment invoice has expired. BTC rates change frequently, so
          please create a new invoice with the current rate.
        </p>
        <button
          onClick={() => router.push("/pricing")}
          className="bg-[#FF3131] px-8 py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80"
        >
          Back to Pricing
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-12">
      <img src="/characters/rage_face.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-0 top-0 hidden w-[220px] opacity-50 md:block lg:w-[280px]" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold">Complete Your Payment</h1>
          <p className="text-[#888888]">
            Send exactly the amount shown below to complete your{" "}
            {payment.planType === "annual" ? "Annual" : "Lifetime"} Pro upgrade
          </p>
        </div>

        <div className="border border-[#1E1E1E] bg-[#141414] p-6">
          <div className="mb-6 flex items-center justify-between border-b border-[#1E1E1E] pb-4">
            <div>
              <span className="text-sm text-[#888888]">Plan</span>
              <p className="font-bold">
                {payment.planType === "annual" ? "Annual Pro" : "Lifetime Pro"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-[#888888]">Amount</span>
              <p className="text-2xl font-bold text-[#FF3131]">
                ${payment.amountUsd}
              </p>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center gap-2 text-sm">
            <Clock
              className={`h-4 w-4 ${remainingSeconds < 120 ? "text-[#FF3131]" : "text-[#FF6B35]"}`}
            />
            <span
              className={
                remainingSeconds < 120 ? "text-[#FF3131]" : "text-[#888888]"
              }
            >
              Invoice expires in{" "}
              <span className="font-mono font-bold">
                {formatTime(remainingSeconds)}
              </span>
            </span>
          </div>

          <div className="mb-6 flex flex-col items-center">
            {qrDataUrl && (
              <div className="mb-4 border border-[#1E1E1E] p-2">
                <img
                  src={qrDataUrl}
                  alt="Bitcoin Payment QR Code"
                  width={280}
                  height={280}
                />
              </div>
            )}

            <div className="w-full space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#888888]">
                  Send exactly this amount (BTC):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3 font-mono text-lg font-bold text-[#FF6B35]">
                    <Bitcoin className="mr-2 inline h-5 w-5" />
                    {payment.amountBtc.toFixed(8)}
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        payment.amountBtc.toFixed(8),
                        "amount"
                      )
                    }
                    className="border border-[#1E1E1E] p-3 transition-colors hover:bg-[#1E1E1E]"
                  >
                    {copied === "amount" ? (
                      <Check className="h-5 w-5 text-[#00FF88]" />
                    ) : (
                      <Copy className="h-5 w-5 text-[#888888]" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#888888]">
                  To this Bitcoin address:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 overflow-hidden border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3 font-mono text-xs text-white">
                    {payment.btcAddress}
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(payment.btcAddress, "address")
                    }
                    className="border border-[#1E1E1E] p-3 transition-colors hover:bg-[#1E1E1E]"
                  >
                    {copied === "address" ? (
                      <Check className="h-5 w-5 text-[#00FF88]" />
                    ) : (
                      <Copy className="h-5 w-5 text-[#888888]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 border border-[#1E1E1E] bg-[#0A0A0A] p-4 text-center text-sm text-[#888888]">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#FF6B35]" />
            Waiting for payment... We check every 15 seconds.
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleManualConfirm}
              disabled={checking}
              className="flex flex-1 items-center justify-center gap-2 border border-[#FF3131]/30 px-4 py-3 text-sm font-semibold text-[#FF3131] transition-all hover:bg-[#FF3131]/10 disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "I've Sent the Payment"
              )}
            </button>
          </div>

          <div className="mt-4 text-center text-xs text-[#888888]">
            <p>
              Rate at invoice: 1 BTC = $
              {payment.btcRate.toLocaleString()}
            </p>
            <p className="mt-1">
              Invoice ID: {payment.invoiceId.slice(0, 12)}...
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
