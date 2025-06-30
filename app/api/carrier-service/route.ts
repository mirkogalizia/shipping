import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1) Scarico l’Excel originale
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .download('tariffs.xlsx');
    if (error || !data) throw new Error('Tariffe non disponibili su Supabase!');

    const buffer = Buffer.from(await data.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const tariffs: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // 2) Leggo input da Shopify
    const body = await req.json();
    const provincia = body.rate?.shipping_address?.province?.toString().toLowerCase() || '';
    const items = body.rate?.line_items || [];
    const pesoTotaleKg = items.reduce(
      (sum: number, li: any) => sum + (li.grams || 0) * (li.quantity || 1),
      0
    ) / 1000;
    if (!provincia || pesoTotaleKg <= 0) {
      return NextResponse.json({ error: 'Provincia o peso non validi' }, { status: 400 });
    }

    // 3) Estraggo la riga "pesature" (ad es. 4ª riga, indice 3) e ne prendo solo i numeri
    const weightsRowIdx = 3;
    const rawWeights = tariffs[weightsRowIdx].slice(3);
    const weightsAll: number[] = rawWeights.map(w => {
      const n = parseFloat(String(w).replace(',', '.'));
      return isNaN(n) ? -1 : n;
    });

    // 4) Trovo la riga della provincia
    const provRowIdx = tariffs.findIndex(
      row => Array.isArray(row)
           && row[1]?.toString().toLowerCase() === provincia
    );
    if (provRowIdx === -1) {
      return NextResponse.json({ error: `Provincia "${provincia}" non trovata.` }, { status: 400 });
    }
    const rawPrices = tariffs[provRowIdx].slice(3);
    const pricesAll: number[] = rawPrices.map(p => {
      const n = parseFloat(String(p).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    });

    // 5) Definisco fasce fino a 1000 kg
    const MAX_PER_PALLET = 1000;
    const bracketWeights = weightsAll.filter(w => w > 0 && w <= MAX_PER_PALLET);
    const bracketPrices  = pricesAll.slice(0, bracketWeights.length);

    // 6) Calcolo numero di bancali
    const bancali = Math.ceil(pesoTotaleKg / MAX_PER_PALLET);

    // 7) Determino il peso del primo bancale (se >1000, uso 1000)
    const firstWeight = Math.min(pesoTotaleKg, MAX_PER_PALLET);

    // 8) Trovo in quale fascia rientra firstWeight
    let idx = bracketWeights.findIndex(w => firstWeight <= w);
    if (idx === -1) idx = bracketWeights.length - 1;

    // 9) Prezzo per bancale e costo base totale
    const pricePerPallet = bracketPrices[idx];
    const baseCost = bancali * pricePerPallet;

    // 10) Aggiungo carburante e IVA
    const fuel = baseCost * 0.025;
    const subtotal = baseCost + fuel;
    const iva = subtotal * 0.22;
    const totalPriceCents = Math.round((subtotal + iva) * 100);

    // 11) Ritorno risposta a Shopify
    const shippingRate = {
      service_name: 'Spedizione Personalizzata',
      service_code: 'CUSTOM',
      total_price: totalPriceCents.toString(),
      currency: 'EUR',
      description: `Bancali: ${bancali}, fascia ${bracketWeights[idx]}kg`
    };

    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


