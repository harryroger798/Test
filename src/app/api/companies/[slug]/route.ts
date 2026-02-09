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

  const parsed = {
    ...company,
    darkPatterns: typeof company.darkPatterns === "string" ? JSON.parse(company.darkPatterns) : company.darkPatterns,
    alternatives: typeof company.alternatives === "string" ? JSON.parse(company.alternatives) : company.alternatives,
    regions: typeof company.regions === "string" ? JSON.parse(company.regions) : company.regions,
    cancellationSteps: typeof company.cancellationSteps === "string" ? JSON.parse(company.cancellationSteps) : company.cancellationSteps,
  };

  return NextResponse.json(parsed);
}
