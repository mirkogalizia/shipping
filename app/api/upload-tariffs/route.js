import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Carica il file Excel originale senza convertirlo in JSON
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload('tariffs.xlsx', buffer, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (error) {
      console.error("Errore upload su Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Errore in upload-tariffs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

