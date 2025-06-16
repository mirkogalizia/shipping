import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provincia = searchParams.get('provincia');
  const peso = parseFloat(searchParams.get('peso') || '0');

  if (!provincia || peso <= 0) {
    return NextResponse.json({ error: 'provincia o peso non validi' }, { status: 400 });
  }

  const bancali = Math.ceil(peso / 1000);
  const prezzo = bancali * 50;

  return NextResponse.json({ provincia, peso, bancali, prezzo });
}