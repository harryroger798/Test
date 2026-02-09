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

    let price: number | null = null;

    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        price = data.bitcoin?.usd ?? null;
      }
    } catch {}

    if (!price) {
      try {
        const res = await fetch(
          "https://mempool.space/api/v1/prices",
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = await res.json();
          price = data.USD ?? null;
        }
      } catch {}
    }

    if (!price) {
      try {
        const res = await fetch(
          "https://api.coinbase.com/v2/prices/BTC-USD/spot",
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = await res.json();
          price = parseFloat(data.data?.amount) || null;
        }
      } catch {}
    }

    if (!price) {
      if (cachedRate) {
        return NextResponse.json({
          price: cachedRate.price,
          cached: true,
          updatedAt: new Date(cachedRate.timestamp).toISOString(),
        });
      }
      return NextResponse.json({ error: "Failed to fetch BTC rate" }, { status: 502 });
    }

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
