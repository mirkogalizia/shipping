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

  const provinciaRichiesta = (await req.json()).rate?.shipping_address?.province || '';

  const pesoTotaleKg = (await req.json()).rate?.line_items?.reduce((tot: number, li: any) => {
    return tot + (li.grams || 0) * (li.quantity || 1);
  }, 0) / 1000;

  if (!provinciaRichiesta || pesoTotaleKg === undefined) {
    return NextResponse.json({ error: "Dati di input mancanti" }, { status: 400 });
  }

  // Indici chiave nel file JSON
  const headersWeightRowIdx = 3; // Riga che contiene i pesi max per le colonne (indice 3, quarta riga)
  const provinceDataStartIdx = 5; // Riga da cui partono i dati provincia (indice 5, sesta riga)

  const weightsRow = tariffs[headersWeightRowIdx].slice(3).map((w: any) => {
    // Assicurati che siano numeri (a volte potrebbero essere stringhe)
    const num = Number(w);
    return isNaN(num) ? Infinity : num;
  });

  // Trova la colonna peso più piccola >= pesoTotaleKg
  let colIndex = weightsRow.findIndex((w: number) => pesoTotaleKg <= w);
  if (colIndex === -1) colIndex = weightsRow.length - 1; // prendi ultimo se peso troppo alto

  // Trova la riga della provincia richiesta (case-insensitive)
  let provinciaIdx = tariffs.findIndex((row: any[]) => {
    if (!Array.isArray(row)) return false;
    return String(row[1]).toLowerCase() === provinciaRichiesta.toLowerCase();
  });

  if (provinciaIdx === -1 || provinciaIdx < provinceDataStartIdx) {
    return NextResponse.json({ error: `Provincia "${provinciaRichiesta}" non trovata.` }, { status: 400 });
  }

  // Prezzo è nella colonna con offset +3 (perché le prime 3 colonne sono Regione, Provincia, Tempi)
  const prezzoRaw = tariffs[provinciaIdx][colIndex + 3];

  // Pulizia e conversione prezzo
  const prezzo = Number(String(prezzoRaw).replace(',', '.'));
  if (isNaN(prezzo)) {
    return NextResponse.json({ error: "Prezzo non valido per la combinazione scelta." }, { status: 400 });
  }

  // Calcola supplemento carburante e iva
  const fuel = prezzo * 0.025;
  const subtotal = prezzo + fuel;
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


