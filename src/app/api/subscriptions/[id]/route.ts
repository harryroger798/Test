import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.status) data.status = body.status;
  if (body.monthlyPrice !== undefined) data.monthlyPrice = body.monthlyPrice;
  if (body.savedAmount !== undefined) data.savedAmount = body.savedAmount;

  if (body.status === "cancelled") {
    data.savedAmount = sub.monthlyPrice * 12;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { savedAmount: { increment: sub.monthlyPrice * 12 } },
    });
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data,
    include: {
      company: {
        select: { name: true, slug: true, category: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.subscription.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
