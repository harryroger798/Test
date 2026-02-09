import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, offerType, description, discountPct, duration, script } =
    await req.json();

  if (!companyId || !offerType || !description) {
    return NextResponse.json(
      { error: "companyId, offerType, and description are required" },
      { status: 400 }
    );
  }

  const offer = await prisma.retentionOffer.create({
    data: {
      companyId,
      userId: session.user.id,
      offerType,
      description,
      discountPct: discountPct || null,
      duration: duration || null,
      script: script || null,
    },
  });

  return NextResponse.json(offer, { status: 201 });
}
