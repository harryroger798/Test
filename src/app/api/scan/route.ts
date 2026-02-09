import { NextRequest, NextResponse } from "next/server";
import { scanContract } from "@/lib/scanner";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || text.length < 50) {
    return NextResponse.json(
      { error: "Please provide at least 50 characters of contract text" },
      { status: 400 }
    );
  }

  const result = scanContract(text);
  const session = await auth();

  try {
    await prisma.contractScan.create({
      data: {
        userId: session?.user?.id || null,
        inputText: text.slice(0, 10000),
        dangerScore: result.score,
        findings: JSON.parse(JSON.stringify(result.findings)),
        autoRenewal: result.autoRenewal,
        cancellationWindow: result.cancellationWindow,
        penaltyClauses: JSON.parse(JSON.stringify(result.penaltyClauses)),
      },
    });
  } catch {
    /* DB save is optional */
  }

  return NextResponse.json(result);
}
