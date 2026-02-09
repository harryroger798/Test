import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BTC_ADDRESS = process.env.BTC_WALLET_ADDRESS || "";
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

    const rateRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (!rateRes.ok) {
      return NextResponse.json({ error: "Failed to fetch BTC rate" }, { status: 502 });
    }
    const rateData = await rateRes.json();
    const btcRate = rateData.bitcoin.usd;
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
