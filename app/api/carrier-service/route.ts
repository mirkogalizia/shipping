import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as xlsx from "xlsx";

// Se non usi Supabase per l’Excel, vai pure a prendere il JSON statico da public:
// import tariffsData from "../../../public/tariffs.json";

export async function POST(req: NextRequest) {
  try {
    // Se usi statico JSON, decommenta qui e salta il parsing Excel
    // const tariffs = tariffsData as { Provincia: string; Peso: number; Prezzo: number }[];

    // Se invece vuoi leggere Excel dal filesystem (in Vercel non è permesso),
    // mantieni il parsing su JSON statico:
    const url = new URL(req.url);
    const jsonRes = await fetch(`${url.origin}/tariffs.json`);
    const tariffs = (await jsonRes.json()) as {
      Provincia: string;
      Peso: number;
      Prezzo: number;
    }[];

    const body = await req.json();
    const prov = body.rate?.shipping_address?.province?.toString().toLowerCase() || "";
    const items = body.rate?.line_items || [];
    const pesoTotaleKg =
      items.reduce((sum: number, li: any) => sum + (li.grams || 0) * (li.quantity || 1), 0) /
      1000;
    if (!prov || pesoTotaleKg <= 0) {
      return NextResponse.json({ error: "Provincia o peso non validi" }, { status: 400 });
    }

    // Filtra le tariffe per provincia
    const list = tariffs
      .filter(t => t.Provincia.toLowerCase() === prov)
      .sort((a, b) => a.Peso - b.Peso);

    if (list.length === 0) {
      return NextResponse.json({ error: `Provincia "${prov}" non trovata.` }, { status: 400 });
    }

    // Limite fascia 1000kg
    const MAX_PER_PALLET = 1000;
    // Estrai fasce e prezzi
    const bracketWeights = list.map(t => t.Peso).filter(w => w <= MAX_PER_PALLET);
    const bracketPrices = list
      .filter(t => t.Peso <= MAX_PER_PALLET)
      .map(t => t.Prezzo);

    // Numero di bancali
    const bancali = Math.ceil(pesoTotaleKg / MAX_PER_PALLET);
    const firstWeight = Math.min(pesoTotaleKg, MAX_PER_PALLET);

    // Trova indice fascia
    let idx = bracketWeights.findIndex(w => firstWeight <= w);
    if (idx === -1) idx = bracketWeights.length - 1;

    // Prezzo per pallet e costo base
    const pricePerPallet = bracketPrices[idx];
    const baseCost = bancali * pricePerPallet;

    // Carburante e IVA
    const fuel = baseCost * 0.025;
    const subtotal = baseCost + fuel;
    const iva = subtotal * 0.22;
    const totalPriceCents = Math.round((subtotal + iva) * 100);

    const shippingRate = {
      service_name: "Spedizione Personalizzata",
      service_code: "CUSTOM",
      total_price: totalPriceCents.toString(),
      currency: "EUR",
      description: `Bancali: ${bancali}, fascia fino a ${bracketWeights[idx]}kg`
    };

    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


