import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "";
  const type = searchParams.get("type") || "";

  const where: Record<string, unknown> = { isActive: true };
  if (region) where.regions = { has: region };
  if (type) where.alertType = type;

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      company: { select: { name: true, slug: true, category: true } },
    },
  });

  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, alertType, title, message, severity, metadata, regions } = body;

  if (!alertType || !title || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validTypes = ["renewal", "price_increase", "free_trial", "cancel_window", "legal_action", "dark_pattern_change", "retention_offer"];
  if (!validTypes.includes(alertType)) {
    return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      companyId: companyId || null,
      alertType,
      title,
      message,
      severity: severity || "info",
      metadata: metadata || {},
      regions: regions || ["GLOBAL"],
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
