import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;

    const payment = await prisma.payment.findUnique({
      where: { invoiceId },
      include: { user: { select: { email: true, isPro: true, planType: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "completed") {
      return NextResponse.json({
        status: "completed",
        payment,
      });
    }

    if (payment.status === "expired" || new Date() > payment.expiresAt) {
      if (payment.status !== "expired") {
        await prisma.payment.update({
          where: { invoiceId },
          data: { status: "expired" },
        });
      }
      return NextResponse.json({
        status: "expired",
        payment: { ...payment, status: "expired" },
      });
    }

    try {
      const address = payment.btcAddress;
      const mempoolRes = await fetch(
        `https://mempool.space/api/address/${address}/txs`
      );

      if (mempoolRes.ok) {
        const txs = await mempoolRes.json();
        const targetSats = Math.round(payment.amountBtc * 100000000);
        const tolerance = 100; // 100 sats tolerance

        for (const tx of txs) {
          const txTime = tx.status?.block_time
            ? new Date(tx.status.block_time * 1000)
            : new Date();

          if (txTime < payment.createdAt) continue;

          for (const vout of tx.vout) {
            if (
              vout.scriptpubkey_address === address &&
              Math.abs(vout.value - targetSats) <= tolerance
            ) {
              await prisma.payment.update({
                where: { invoiceId },
                data: {
                  status: "completed",
                  txHash: tx.txid,
                  confirmedAt: new Date(),
                },
              });

              const proExpiresAt =
                payment.planType === "annual"
                  ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                  : null;

              await prisma.user.update({
                where: { id: payment.userId },
                data: {
                  isPro: true,
                  planType: payment.planType,
                  proExpiresAt,
                },
              });

              return NextResponse.json({
                status: "completed",
                txHash: tx.txid,
                payment: { ...payment, status: "completed", txHash: tx.txid },
              });
            }
          }
        }
      }
    } catch {
      // blockchain check failed, continue with pending status
    }

    return NextResponse.json({
      status: payment.status,
      payment,
      remainingSeconds: Math.max(
        0,
        Math.floor((payment.expiresAt.getTime() - Date.now()) / 1000)
      ),
    });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
