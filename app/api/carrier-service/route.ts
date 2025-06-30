import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';

export async function POST(req: NextRequest) {
  let tariffs: any[][];
  try {
    const data = fs.readFileSync('/tmp/tariffs.json', 'utf8');
    if (!data) throw new Error('Tariffe vuote!');
    tariffs = JSON.parse(data);
  } catch (e) {
    return NextResponse.json({
      error: "Tariffe non disponibili. Devi prima caricare un file Excel.",
      details: (e as Error).message
    }, { status: 500 });
  }

  // Trova le intestazioni delle colonne (prima riga)
  const headers = tariffs[0];
  const provinciaIdx = headers.findIndex((h: string) => h.toLowerCase().includes('prov'));
  const pesoIdx = headers.findIndex((h: string) => h.toLowerCase().includes('peso'));
  const prezzoIdx = headers.findIndex((h: string) => h.toLowerCase().includes('prezzo'));

  if (provinciaIdx === -1 || pesoIdx === -1 || prezzoIdx === -1) {
    return NextResponse.json({
      error: "Impossibile trovare le colonne Provincia, Peso, Prezzo nell'Excel.",
      headers
    }, { status: 400 });
  }

  // Prendi input dal body Shopify
  const input = await req.json();
  const provinciaRichiesta = input.rate?.shipping_address?.province || input.shipping_address?.province || "";
  const items = input.rate?.line_items || input.line_items || [];
  const pesoTotaleKg = items.reduce((tot: number, li: any) => tot + (li.grams || 0) * (li.quantity || 1), 0) / 1000;

  // Filtra solo le tariffe della provincia giusta
  const list = tariffs
    .slice(1)
    .filter(row => String(row[provinciaIdx]).toLowerCase() === provinciaRichiesta.toLowerCase())
    .sort((a, b) => Number(a[pesoIdx]) - Number(b[pesoIdx]));

  if (!list.length) {
    return NextResponse.json({ error: `Nessuna tariffa trovata per provincia: ${provinciaRichiesta}` }, { status: 400 });
  }

  // Logica bancali (stessa di prima, ma su array)
  let rem = pesoTotaleKg, baseCost = 0, bancali = 0;
  while (rem > 0) {
    bancali++;
    const entry = list.find(d => Number(d[pesoIdx]) >= rem) || list[list.length - 1];
    if (!entry) {
      return NextResponse.json({ error: "Nessuna tariffa valida trovata per il peso richiesto." }, { status: 400 });
    }
    baseCost += Number(entry[prezzoIdx]);
    rem -= Number(entry[pesoIdx]);
  }
  const fuel = baseCost * 0.025;
  const subtotal = baseCost + fuel;
  const iva = subtotal * 0.22;
  const totalPriceCents = Math.round((subtotal + iva) * 100);

  const shippingRate = {
    service_name: 'Spedizione Personalizzata',
    service_code: 'CUSTOM',
    total_price: totalPriceCents.toString(),
    currency: 'EUR',
    description: 'Incluso carburante e IVA'
  };
  return NextResponse.json({ rates: [shippingRate] });
}
