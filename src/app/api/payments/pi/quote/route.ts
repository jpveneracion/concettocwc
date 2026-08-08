// src/app/api/payments/pi/quote/route.ts
// Returns the Pi amount for a PHP plan price using the live Pi price.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { computePiAmount, getPhpToUsdRate, getPiUsdPrice } from '@/lib/pi-payments';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const amountPhp = Number(searchParams.get('amount'));

    if (!Number.isFinite(amountPhp) || amountPhp <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const piUsdPrice = await getPiUsdPrice();
    const amountPi = await computePiAmount(amountPhp, piUsdPrice);

    return NextResponse.json({
      success: true,
      amount_php: amountPhp,
      amount_usd: Math.round(amountPhp * getPhpToUsdRate() * 100) / 100,
      amount_pi: amountPi,
      pi_price_usd: piUsdPrice,
    });
  } catch (error) {
    console.error('GET /api/payments/pi/quote error:', error);
    return NextResponse.json({ error: 'Failed to compute Pi amount' }, { status: 500 });
  }
}
