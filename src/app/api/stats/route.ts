import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [totalUsers, totalCompanies, totalSaved, totalCancellations] =
    await Promise.all([
      prisma.user.count(),
      prisma.saasCompany.count(),
      prisma.user.aggregate({ _sum: { savedAmount: true } }),
      prisma.saasCompany.aggregate({ _sum: { totalCancellations: true } }),
    ]);

  return NextResponse.json({
    totalUsers,
    totalCompanies,
    totalSaved: totalSaved._sum.savedAmount || 0,
    totalCancellations: totalCancellations._sum.totalCancellations || 0,
  });
}
