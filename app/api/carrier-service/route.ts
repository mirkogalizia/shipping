import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    // Leggi il JSON statico da public/tariffs.json
    const jsonPath = path.join(process.cwd(), "public", "tariffs.json");
    const file = await fs.readFile(jsonPath, "utf8");
    const tariffs: { Provincia: string; Peso: number; Prezzo: number }[] = JSON.parse(file);

    // Prendi il flag debug dalla query string
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // Input Shopify
    const { rate } = await req.json();
    const prov = rate.shipping_address?.province?.toString().toLowerCase() || "";
    const pesoTotaleKg =
      (rate.line_items || []).reduce(
        (sum: number, li: any) => sum + (li.grams || 0) * (li.quantity || 1),
        0
      ) / 1000;
    if (!prov || pesoTotaleKg <= 0) {
      return NextResponse.json({ error: "Provincia o peso non validi" }, { status: 400 });
    }

    // Filtra e ordina
    const list = tariffs
      .filter(t => t.Provincia.toLowerCase() === prov)
      .sort((a, b) => a.Peso - b.Peso);
    if (list.length === 0) {
      return NextResponse.json({ error: `Provincia "${prov}" non trovata.` }, { status: 400 });
    }

    const MAX_PER_PALLET = 1000;
    const bracketWeights = list.map(t => t.Peso).filter(w => w <= MAX_PER_PALLET);
    const bracketPrices  = list.filter(t => t.Peso <= MAX_PER_PALLET).map(t => t.Prezzo);

    const bancali      = Math.ceil(pesoTotaleKg / MAX_PER_PALLET);
    const firstWeight  = Math.min(pesoTotaleKg, MAX_PER_PALLET);
    let   idx          = bracketWeights.findIndex(w => firstWeight <= w);
    if (idx === -1) idx = bracketWeights.length - 1;

    const pricePerPallet   = bracketPrices[idx];
    const baseCost         = bancali * pricePerPallet;
    const fuel             = baseCost * 0.025;
    const subtotal         = baseCost + fuel;
    const iva              = subtotal * 0.22;
    const totalPriceCents  = Math.round((subtotal + iva) * 100);

    const shippingRate = {
      service_name: "Spedizione Personalizzata",
      service_code: "CUSTOM",
      total_price: totalPriceCents.toString(),
      currency: "EUR",
      description: `Bancali: ${bancali}, fascia fino a ${bracketWeights[idx]}kg`,
    };

    // Se debug, restituisci anche il breakdown
    if (debug) {
      return NextResponse.json({
        rates: [shippingRate],
        debug: {
          provincia: prov,
          pesoTotaleKg,
          bancali,
          firstWeight,
          bracketWeights,
          bracketPrices,
          idx,
          pricePerPallet,
          baseCost,
          fuel,
          subtotal,
          iva,
          totalPriceCents
        }
      });
    }

    // Altrimenti risposta normale
    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


