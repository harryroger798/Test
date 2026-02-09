import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoiceId, txHash } = await req.json();

    const payment = await prisma.payment.findUnique({
      where: { invoiceId },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (payment.status === "completed") {
      return NextResponse.json({ status: "already_completed" });
    }

    if (txHash) {
      try {
        const txRes = await fetch(`https://mempool.space/api/tx/${txHash}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          const targetSats = Math.round(payment.amountBtc * 100000000);
          const tolerance = 100;

          let found = false;
          for (const vout of txData.vout) {
            if (
              vout.scriptpubkey_address === payment.btcAddress &&
              Math.abs(vout.value - targetSats) <= tolerance
            ) {
              found = true;
              break;
            }
          }

          if (found) {
            await prisma.payment.update({
              where: { invoiceId },
              data: {
                status: "completed",
                txHash,
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

            return NextResponse.json({ status: "confirmed" });
          }
        }
      } catch {
        // tx verification failed
      }
    }

    await prisma.payment.update({
      where: { invoiceId },
      data: { status: "confirming", txHash: txHash || undefined },
    });

    return NextResponse.json({ status: "confirming" });
  } catch (err) {
    console.error("Payment confirm error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
