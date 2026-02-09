import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, patternType, description, screenshotUrl, platform } = body;

  if (!companyId || !patternType || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const report = await prisma.darkPatternReport.create({
    data: {
      companyId,
      reporterId: session.user.id,
      patternType,
      description,
      screenshotUrl: screenshotUrl || null,
      platform: platform || "web",
    },
  });

  await prisma.saasCompany.update({
    where: { id: companyId },
    data: { reportCount: { increment: 1 } },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { reputation: { increment: 5 } },
  });

  return NextResponse.json(report, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId") || "";

  const where: Record<string, unknown> = {};
  if (companyId) where.companyId = companyId;

  const reports = await prisma.darkPatternReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      reporter: { select: { name: true } },
      company: { select: { name: true, slug: true } },
    },
  });

  return NextResponse.json(reports);
}
