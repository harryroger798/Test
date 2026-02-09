import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sortBy = searchParams.get("sortBy") || "difficultyScore";
  const order = searchParams.get("order") || "desc";

  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (category) {
    where.category = category;
  }

  const validSortFields = [
    "difficultyScore",
    "darkPatternScore",
    "totalCancellations",
    "name",
    "createdAt",
  ];
  const orderByField = validSortFields.includes(sortBy) ? sortBy : "difficultyScore";

  const companies = await prisma.saasCompany.findMany({
    where,
    orderBy: { [orderByField]: order === "asc" ? "asc" : "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      avgMonthlyPrice: true,
      difficultyScore: true,
      darkPatternScore: true,
      totalCancellations: true,
      logo: true,
    },
  });

  return NextResponse.json(companies);
}
