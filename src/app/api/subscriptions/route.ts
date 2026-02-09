import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      company: {
        select: { name: true, slug: true, category: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscriptions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, monthlyPrice, billingCycle, renewalDate } =
    await req.json();

  if (!companyId || !monthlyPrice) {
    return NextResponse.json(
      { error: "companyId and monthlyPrice are required" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId: session.user.id,
      companyId,
      monthlyPrice,
      billingCycle: billingCycle || "monthly",
      renewalDate: renewalDate ? new Date(renewalDate) : null,
    },
    include: {
      company: {
        select: { name: true, slug: true, category: true },
      },
    },
  });

  return NextResponse.json(subscription, { status: 201 });
}
