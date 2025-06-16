import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  const { provincia, peso } = Object.fromEntries(new URL(req.url).searchParams.entries());
  if (!provincia || Number(peso) <= 0) {
    return NextResponse.json({ error: 'provincia o peso non validi' }, { status: 400 });
  }
  const bancali = Math.ceil(Number(peso) / 1000);
  const prezzo = bancali * 50;
  return NextResponse.json({ provincia, peso, bancali, prezzo });
}
