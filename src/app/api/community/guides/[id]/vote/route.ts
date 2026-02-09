import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { voteType, worked, comment } = body;

  if (!voteType || !["up", "down"].includes(voteType)) {
    return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
  }

  const existing = await prisma.guideVote.findUnique({
    where: { userId_guideId: { userId: session.user.id, guideId: id } },
  });

  if (existing) {
    await prisma.guideVote.update({
      where: { id: existing.id },
      data: { voteType, worked: worked ?? null, comment: comment ?? null },
    });
  } else {
    await prisma.guideVote.create({
      data: {
        guideId: id,
        userId: session.user.id,
        voteType,
        worked: worked ?? null,
        comment: comment ?? null,
      },
    });
  }

  if (voteType === "up") {
    await prisma.communityGuide.update({ where: { id }, data: { upvotes: { increment: 1 } } });
  } else {
    await prisma.communityGuide.update({ where: { id }, data: { downvotes: { increment: 1 } } });
  }

  if (worked === true) {
    await prisma.communityGuide.update({ where: { id }, data: { successCount: { increment: 1 } } });
  } else if (worked === false) {
    await prisma.communityGuide.update({ where: { id }, data: { failureCount: { increment: 1 } } });
  }

  return NextResponse.json({ success: true });
}
