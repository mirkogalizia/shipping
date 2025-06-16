// app/api/carrier-service/route.ts
import { NextResponse } from 'next/server';
import tariffs from '../../../tariffs.json';

interface LineItem {
  quantity: number;
  grams: number;
}

export async function POST(req: Request) {
  // Shopify invia { rate: {...}, ... }
  const { rate } = await req.json();
  const province = rate.shipping_address.province;
  const items: LineItem[] = rate.line_items;

  // Calcolo peso totale in kg
  const totalKg =
    items.reduce((sum, li) => sum + li.grams * li.quantity, 0) / 1000;

  // Filtra e ordina le tariffe per provincia
  const list = (tariffs as any[])
    .filter(t => t.Provincia.toLowerCase() === province.toLowerCase())
    .sort((a, b) => a.Peso - b.Peso);

  // Scala a blocchi da 1000 kg
  let rem = totalKg;
  let baseCost = 0;
  while (rem > 0) {
    const entry = list.find(d => d.Peso >= rem) || list[list.length - 1];
    baseCost += entry.Prezzo;
    rem -= entry.Peso;
  }

  // Supplemento carburante e IVA
  const fuelSurcharge = baseCost * 0.025;
  const subtotal = baseCost + fuelSurcharge;
  const iva = subtotal * 0.22;
  const totalPriceCents = Math.round((subtotal + iva) * 100);

  const shippingRate = {
    service_name: 'Spedizione Personalizzata',
    service_code: 'CUSTOM_B2B',
    total_price: totalPriceCents.toString(),
    currency: 'EUR',
    description: 'Incluso carburante e IVA',
  };

  // Shopify si aspetta un array `rates`
  return NextResponse.json({ rates: [shippingRate] });
}
