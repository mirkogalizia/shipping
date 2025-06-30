import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    await writeFile(join(process.cwd(), 'tariffs.json'), JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true, rows: data.length });
  } catch (error) {
    console.error("Errore upload-tariffs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
