import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'File mancante' }, { status: 400 });
    }
    if (typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Formato file non valido (no arrayBuffer)' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Salva TUTTA la tabella come array di array (esattamente come l’Excel!)
    const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    await writeFile('/tmp/tariffs.json', JSON.stringify(raw, null, 2));
    return NextResponse.json({ ok: true, rows: raw.length });
  } catch (error) {
    console.error("Errore upload-tariffs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

