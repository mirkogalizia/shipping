import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(req: NextRequest) {
  let tariffs: any[][];
  try {
    const { data, error } = await supabase.storage.from(process.env.SUPABASE_BUCKET!).download('tariffs.json');
    if (error || !data) throw new Error('Tariffe non disponibili su Supabase!');

    const text = await data.text();
    tariffs = JSON.parse(text);
  } catch (e) {
    return NextResponse.json({
      error: "Tariffe non disponibili. Devi prima caricare un file Excel.",
      details: (e as Error).message
    }, { status: 500 });
  }

  // Trova la riga con intestazioni corrette
  const headersRowIdx = tariffs.findIndex(
    row =>
      Array.isArray(row) &&
      row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('prov')) &&
      row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('peso')) &&
      row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('prezzo'))
  );

  if (headersRowIdx === -1) {
    return NextResponse.json({
      error: "Impossibile trovare le colonne Provincia, Peso, Prezzo nell'Excel.",
      headers: tariffs[0]
    }, { status: 400 });
  }

  const headers = tariffs[headersRowIdx];
  const provinciaIdx = headers.findIndex((h: string) => h.toLowerCase().includes('prov'));
  const pesoIdx = headers.findIndex((h: string) => h.toLowerCase().includes('peso'));
  const prezzoIdx = headers.findIndex((h: string) => h.toLowerCase().includes('prezzo'));

  const input = await req.json();
  const provinciaRichiesta = input.rate?.shipping_address?.province || input.shipping_address?.province || '';
  const items = input.rate?.line_items || input.line_items || [];
  const pesoTotaleKg = items.reduce((tot: number, li: any) => tot + (li.grams || 0) * (li.quantity || 1), 0) / 1000;

  const list = tariffs
    .slice(headersRowIdx + 1)
    .filter(row => String(row[provinciaIdx]).toLowerCase() === provinciaRichiesta.toLowerCase())
    .sort((a, b) => Number(a[pesoIdx]) - Number(b[pesoIdx]));

  if (list.length === 0) {
    return NextResponse.json({ error: `Nessuna tariffa trovata per provincia: ${provinciaRichiesta}` }, { status: 400 });
  }

  let rem = pesoTotaleKg;
  let baseCost = 0;
  let bancali = 0;

  while (rem > 0) {
    bancali++;
    const entry = list.find(d => Number(d[pesoIdx]) >= rem) || list[list.length - 1];
    if (!entry) {
      return NextResponse.json({ error: 'Nessuna tariffa valida trovata per il peso richiesto.' }, { status: 400 });
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

