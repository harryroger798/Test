import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let prefs = await prisma.alertPreference.findUnique({
    where: { userId: session.user.id },
  });

  if (!prefs) {
    prefs = await prisma.alertPreference.create({
      data: { userId: session.user.id },
    });
  }

  return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const prefs = await prisma.alertPreference.upsert({
    where: { userId: session.user.id },
    update: {
      renewalReminders: body.renewalReminders ?? true,
      renewalDaysBefore: body.renewalDaysBefore ?? 3,
      priceIncreaseAlerts: body.priceIncreaseAlerts ?? true,
      freeTrialAlerts: body.freeTrialAlerts ?? true,
      trialDaysBefore: body.trialDaysBefore ?? 2,
      cancelWindowAlerts: body.cancelWindowAlerts ?? true,
      legalActionAlerts: body.legalActionAlerts ?? true,
      darkPatternAlerts: body.darkPatternAlerts ?? true,
      retentionOfferAlerts: body.retentionOfferAlerts ?? true,
      emailDigest: body.emailDigest ?? "weekly",
    },
    create: {
      userId: session.user.id,
      renewalReminders: body.renewalReminders ?? true,
      renewalDaysBefore: body.renewalDaysBefore ?? 3,
      priceIncreaseAlerts: body.priceIncreaseAlerts ?? true,
      freeTrialAlerts: body.freeTrialAlerts ?? true,
      trialDaysBefore: body.trialDaysBefore ?? 2,
      cancelWindowAlerts: body.cancelWindowAlerts ?? true,
      legalActionAlerts: body.legalActionAlerts ?? true,
      darkPatternAlerts: body.darkPatternAlerts ?? true,
      retentionOfferAlerts: body.retentionOfferAlerts ?? true,
      emailDigest: body.emailDigest ?? "weekly",
    },
  });

  return NextResponse.json(prefs);
}
