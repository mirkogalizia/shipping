import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';

export async function POST(req: NextRequest) {
  let tariffs;
  try {
    const data = fs.readFileSync('/tmp/tariffs.json', 'utf8');
    if (!data) throw new Error('Tariffe vuote!');
    tariffs = JSON.parse(data);
  } catch (e) {
    return NextResponse.json({ error: "Tariffe non disponibili. Devi prima caricare un file Excel.", details: e.message }, { status: 500 });
  }

  // Estrai i dati dall’input Shopify
  let rate;
  try {
    rate = typeof req.body === 'object' ? req.body : await req.json();
  } catch {
    rate = await req.json();
  }
  const provinceRequested = rate.shipping_address?.province || rate.rate?.shipping_address?.province;
  const items = rate.line_items || rate.rate?.line_items || [];

  // Filtra la lista per provincia (case-insensitive)
  const list = tariffs
    .filter(t => (t.Provincia || '').toLowerCase() === (provinceRequested || '').toLowerCase())
    .sort((a, b) => a.Peso - b.Peso);

  if (list.length === 0) {
    return NextResponse.json({ error: "Nessuna tariffa trovata per la provincia richiesta: " + provinceRequested }, { status: 400 });
  }

  // Calcola il peso totale (in kg)
  const totalKg = items.reduce((sum, li) => sum + (li.grams || 0) * (li.quantity || 1), 0) / 1000;

  // Calcolo logica bancali
  let rem = totalKg;
  let baseCost = 0, bancali = 0;
  while (rem > 0) {
    bancali++;
    const entry = list.find(d => d.Peso >= rem) || list[list.length - 1];
    if (!entry || typeof entry.Prezzo === 'undefined') {
      return NextResponse.json({ error: "Nessuna tariffa valida trovata per il peso richiesto." }, { status: 400 });
    }
    baseCost += entry.Prezzo;
    rem -= entry.Peso;
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
