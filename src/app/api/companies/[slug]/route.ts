import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const company = await prisma.saasCompany.findUnique({
    where: { slug },
    include: {
      retentionOffers: {
        orderBy: { upvotes: "desc" },
        take: 20,
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
