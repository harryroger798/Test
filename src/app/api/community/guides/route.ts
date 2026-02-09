import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companySlug = searchParams.get("company") || "";
  const region = searchParams.get("region") || "";

  const where: Record<string, unknown> = {};
  if (companySlug) {
    const company = await prisma.saasCompany.findUnique({ where: { slug: companySlug } });
    if (company) where.companyId = company.id;
  }
  if (region) where.region = region;

  const guides = await prisma.communityGuide.findMany({
    where,
    orderBy: { upvotes: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { votes: true } },
    },
  });

  return NextResponse.json(guides);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, title, steps, region, method, clickCount, timeMinutes, tips } = body;

  if (!companyId || !title || !steps) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const guide = await prisma.communityGuide.create({
    data: {
      companyId,
      authorId: session.user.id,
      title,
      steps,
      region: region || "GLOBAL",
      method: method || "online",
      clickCount: clickCount || 0,
      timeMinutes: timeMinutes || 5,
      tips: tips || null,
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { reputation: { increment: 10 } },
  });

  return NextResponse.json(guide, { status: 201 });
}
