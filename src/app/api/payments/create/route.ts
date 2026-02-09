import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BTC_ADDRESS = process.env.BTC_WALLET_ADDRESS || "bc1p5uc6872g3myx0d5ctptqarp0z674cvwpmdsgnzcfwqld5hph5shsvp8dse";
const INVOICE_EXPIRY = 900; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planType } = await req.json();
    if (!["annual", "lifetime"].includes(planType)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isPro && user.planType === "lifetime") {
      return NextResponse.json({ error: "You already have lifetime Pro access" }, { status: 400 });
    }

    const pendingPayment = await prisma.payment.findFirst({
      where: {
        userId: session.user.id,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingPayment) {
      return NextResponse.json({
        payment: pendingPayment,
        btcAddress: pendingPayment.btcAddress,
      });
    }

    const amountUsd = planType === "annual" ? 19 : 49;

    let btcRate: number | null = null;

    try {
      const rateRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { signal: AbortSignal.timeout(5000) }
      );
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        btcRate = rateData.bitcoin?.usd ?? null;
      }
    } catch {}

    if (!btcRate) {
      try {
        const rateRes = await fetch(
          "https://mempool.space/api/v1/prices",
          { signal: AbortSignal.timeout(5000) }
        );
        if (rateRes.ok) {
          const rateData = await rateRes.json();
          btcRate = rateData.USD ?? null;
        }
      } catch {}
    }

    if (!btcRate) {
      try {
        const rateRes = await fetch(
          "https://api.coinbase.com/v2/prices/BTC-USD/spot",
          { signal: AbortSignal.timeout(5000) }
        );
        if (rateRes.ok) {
          const rateData = await rateRes.json();
          btcRate = parseFloat(rateData.data?.amount) || null;
        }
      } catch {}
    }

    if (!btcRate) {
      return NextResponse.json({ error: "Unable to fetch BTC rate. Please try again in a moment." }, { status: 502 });
    }

    const amountBtc = parseFloat((amountUsd / btcRate).toFixed(8));

    const expiresAt = new Date(Date.now() + INVOICE_EXPIRY * 1000);

    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        planType,
        amountUsd,
        amountBtc,
        btcAddress: BTC_ADDRESS,
        btcRate,
        status: "pending",
        expiresAt,
      },
    });

    return NextResponse.json({
      payment,
      btcAddress: BTC_ADDRESS,
    });
  } catch (err) {
    console.error("Payment creation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
