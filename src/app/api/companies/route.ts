import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const region = searchParams.get("region") || "";
  const sortBy = searchParams.get("sortBy") || "difficultyScore";
  const order = searchParams.get("order") || "desc";
  const limit = parseInt(searchParams.get("limit") || "0", 10);

  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (category) {
    where.category = category;
  }
  if (region) {
    where.regions = { has: region };
  }

  const validSortFields = [
    "difficultyScore",
    "darkPatternScore",
    "totalCancellations",
    "name",
    "avgMonthlyPrice",
    "clicksToCancel",
    "estimatedCancelTime",
    "createdAt",
  ];
  const orderByField = validSortFields.includes(sortBy) ? sortBy : "difficultyScore";

  const companies = await prisma.saasCompany.findMany({
    where,
    orderBy: { [orderByField]: order === "asc" ? "asc" : "desc" },
    ...(limit > 0 ? { take: limit } : {}),
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      regions: true,
      avgMonthlyPrice: true,
      yearlyPrice: true,
      difficultyScore: true,
      darkPatternScore: true,
      darkPatterns: true,
      clicksToCancel: true,
      estimatedCancelTime: true,
      totalCancellations: true,
      cancellationMethod: true,
      freeTierAvailable: true,
      headquarters: true,
      alternatives: true,
      knownLawsuits: true,
      logo: true,
    },
  });

  return NextResponse.json(companies);
}
