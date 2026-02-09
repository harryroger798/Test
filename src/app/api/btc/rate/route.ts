import { NextResponse } from "next/server";

let cachedRate: { price: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

export async function GET() {
  try {
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
      return NextResponse.json({
        price: cachedRate.price,
        cached: true,
        updatedAt: new Date(cachedRate.timestamp).toISOString(),
      });
    }

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { next: { revalidate: 30 } }
    );

    if (!res.ok) {
      if (cachedRate) {
        return NextResponse.json({
          price: cachedRate.price,
          cached: true,
          updatedAt: new Date(cachedRate.timestamp).toISOString(),
        });
      }
      return NextResponse.json({ error: "Failed to fetch BTC rate" }, { status: 502 });
    }

    const data = await res.json();
    const price = data.bitcoin.usd;

    cachedRate = { price, timestamp: Date.now() };

    return NextResponse.json({
      price,
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    if (cachedRate) {
      return NextResponse.json({
        price: cachedRate.price,
        cached: true,
        updatedAt: new Date(cachedRate.timestamp).toISOString(),
      });
    }
    return NextResponse.json({ error: "Failed to fetch BTC rate" }, { status: 502 });
  }
}
