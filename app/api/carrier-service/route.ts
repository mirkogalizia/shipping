import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { data, error } = await supabase.storage.from(process.env.SUPABASE_BUCKET!).download("tariffs.json");
    if (error || !data) throw new Error("Tariffe non disponibili su Supabase!");

    const text = await data.text();
    const tariffs = JSON.parse(text) as { Provincia: string; Peso: number; Prezzo: number }[];

    const body = await req.json();
    const provinciaRichiesta = body.rate?.shipping_address?.province || "";
    const items = body.rate?.line_items || [];
    const pesoTotaleKg = items.reduce((tot: number, li: any) => tot + (li.grams || 0) * (li.quantity || 1), 0) / 1000;

    if (!provinciaRichiesta || pesoTotaleKg === 0) {
      return NextResponse.json({ error: "Dati di input mancanti o non validi" }, { status: 400 });
    }

    const list = tariffs
      .filter(t => t.Provincia.toLowerCase() === provinciaRichiesta.toLowerCase())
      .sort((a, b) => a.Peso - b.Peso);

    if (list.length === 0) {
      return NextResponse.json({ error: `Nessuna tariffa trovata per provincia: ${provinciaRichiesta}` }, { status: 400 });
    }

    let rem = pesoTotaleKg;
    let baseCost = 0;
    let bancali = 0;

    while (rem > 0) {
      bancali++;
      const entry = list.find(t => t.Peso >= rem) || list[list.length - 1];
      baseCost += entry.Prezzo;
      rem -= entry.Peso;
    }

    const fuel = baseCost * 0.025;
    const subtotal = baseCost + fuel;
    const iva = subtotal * 0.22;
    const totalPriceCents = Math.round((subtotal + iva) * 100);

    const shippingRate = {
      service_name: "Spedizione Personalizzata",
      service_code: "CUSTOM",
      total_price: totalPriceCents.toString(),
      currency: "EUR",
      description: "Incluso carburante e IVA"
    };

    return NextResponse.json({ rates: [shippingRate] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}


