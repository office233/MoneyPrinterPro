import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GENERATED_DIR, MIME_BY_EXT } from '@/lib/personas';
import { isValidFilename, safeJoin } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const { filename } = await params;

  // Reject anything that isn't a plain {slug}.{ext} from our whitelist.
  if (!isValidFilename(filename)) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  let filePath;
  try {
    filePath = safeJoin(GENERATED_DIR, filename);
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(data, {
      headers: {
        'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    if (err?.code === 'ENOENT') return new NextResponse('Not found', { status: 404 });
    console.error('[files:get] error:', err);
    return new NextResponse('Error', { status: 500 });
  }
}
