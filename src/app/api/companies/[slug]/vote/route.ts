import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const session = await auth();

  const company = await prisma.saasCompany.findUnique({
    where: { slug },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (session?.user?.id) {
    const { voteType, targetType } = await req.json();
    try {
      await prisma.vote.upsert({
        where: {
          userId_companyId_targetType: {
            userId: session.user.id,
            companyId: company.id,
            targetType: targetType || "cancellation_guide",
          },
        },
        update: { voteType },
        create: {
          userId: session.user.id,
          companyId: company.id,
          voteType: voteType || "upvote",
          targetType: targetType || "cancellation_guide",
        },
      });
    } catch {
      /* ignore duplicate */
    }
  }

  await prisma.saasCompany.update({
    where: { id: company.id },
    data: { totalCancellations: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
