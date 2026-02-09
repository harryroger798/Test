import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { voteType } = await req.json();

  const offer = await prisma.retentionOffer.findUnique({ where: { id } });
  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  try {
    await prisma.vote.upsert({
      where: {
        userId_offerId_targetType: {
          userId: session.user.id,
          offerId: id,
          targetType: "retention_offer",
        },
      },
      update: { voteType },
      create: {
        userId: session.user.id,
        offerId: id,
        voteType,
        targetType: "retention_offer",
      },
    });

    if (voteType === "upvote") {
      await prisma.retentionOffer.update({
        where: { id },
        data: { upvotes: { increment: 1 } },
      });
    } else {
      await prisma.retentionOffer.update({
        where: { id },
        data: { downvotes: { increment: 1 } },
      });
    }
  } catch {
    /* ignore duplicate */
  }

  return NextResponse.json({ success: true });
}
