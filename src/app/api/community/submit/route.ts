import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companyName, category, website, avgMonthlyPrice, cancellationMethod, cancellationUrl, cancellationPhone, cancellationSteps, regions } = body;

  if (!companyName || !category) {
    return NextResponse.json({ error: "Company name and category required" }, { status: 400 });
  }

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.saasCompany.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Company already exists" }, { status: 409 });
  }

  const submission = await prisma.companySubmission.create({
    data: {
      submitterId: session.user.id,
      companyName,
      companySlug: slug,
      category,
      website: website || null,
      avgMonthlyPrice: avgMonthlyPrice ? parseFloat(avgMonthlyPrice) : null,
      cancellationMethod: cancellationMethod || "online",
      cancellationUrl: cancellationUrl || null,
      cancellationPhone: cancellationPhone || null,
      cancellationSteps: cancellationSteps || null,
      regions: regions || ["GLOBAL"],
      status: "pending",
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { reputation: { increment: 5 } },
  });

  return NextResponse.json(submission, { status: 201 });
}

export async function GET() {
  const submissions = await prisma.companySubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      submitter: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json(submissions);
}
