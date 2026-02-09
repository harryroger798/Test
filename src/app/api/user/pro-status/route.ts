import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ isPro: false, planType: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        isPro: true,
        planType: true,
        proExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ isPro: false, planType: null });
    }

    if (user.isPro && user.planType === "annual" && user.proExpiresAt) {
      if (new Date() > user.proExpiresAt) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { isPro: false, planType: null, proExpiresAt: null },
        });
        return NextResponse.json({ isPro: false, planType: null, expired: true });
      }

      const daysRemaining = Math.ceil(
        (user.proExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return NextResponse.json({
        isPro: true,
        planType: user.planType,
        expiresAt: user.proExpiresAt.toISOString(),
        daysRemaining,
      });
    }

    return NextResponse.json({
      isPro: user.isPro,
      planType: user.planType,
      expiresAt: user.proExpiresAt?.toISOString() || null,
    });
  } catch {
    return NextResponse.json({ isPro: false, planType: null });
  }
}
