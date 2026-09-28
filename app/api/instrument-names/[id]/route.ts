import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../../lib/supabase";
import { clientSafeMessage } from '../../../../lib/api-error'
import { hasRenderCredentials, isRenderAuthorizedFor, requireRoles, unauthorized } from '../../../../lib/api-auth'
import {
  INSTRUMENT_NAME_TEXT_COLUMNS,
  isMissingColumnError,
  normalizeInstrumentNameRow,
} from '../../../../lib/instrument-names-schema'

// Kompatibel dua schema: kolom teks nama bisa `name` (baru) atau `names` (lama).

async function fetchOne(id: string) {
  let lastError: any = null
  for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
    const { data, error } = await supabase
      .from("instrument_names")
      .select(`id, ${textCol}, code_alat, created_at`)
      .eq("id", id)
      .single()
    if (!error) return { row: normalizeInstrumentNameRow(data), error: null }
    lastError = error
    if (!isMissingColumnError(error, textCol)) break
  }
  return { row: null, error: lastError }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (hasRenderCredentials(request) && !await isRenderAuthorizedFor(request, { type: 'instrument-name', id })) {
      return unauthorized();
    }
    const { row, error } = await fetchOne(id)
    if (error || !row) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch instrument name" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator']);
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, names, code_alat, instrument_code_id } = body;

    const nameValue = names || name;
    if (!nameValue) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Resolve kode: eksplisit dari code_alat, atau turunkan dari instrument_code_id.
    let resolvedCode: string | null | undefined = code_alat;
    if (resolvedCode === undefined && instrument_code_id) {
      const { data: codeRow } = await supabase
        .from('instrument_names')
        .select('code_alat')
        .eq('id', instrument_code_id)
        .maybeSingle();
      resolvedCode = codeRow?.code_alat ?? null;
    }

    // Coba update dengan 'name', fallback ke 'names'.
    let updated: any = null
    let lastError: any = null
    for (const textCol of INSTRUMENT_NAME_TEXT_COLUMNS) {
      const payload: any = { [textCol]: nameValue }
      if (resolvedCode !== undefined) payload.code_alat = resolvedCode

      const { data, error } = await supabase
        .from("instrument_names")
        .update(payload)
        .eq("id", id)
        .select()
        .single()
      if (!error) { updated = data; break }
      lastError = error
      if (!isMissingColumnError(error, textCol)) break
    }

    if (!updated) {
      return NextResponse.json({ error: clientSafeMessage(lastError) }, { status: 500 });
    }

    const normalized = normalizeInstrumentNameRow(updated)
    return NextResponse.json({ ...updated, name: normalized.name, code_alat: normalized.code_alat });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update instrument name" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRoles(request, ['admin', 'calibrator']);
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await params;

    // Cek referensi instrument lewat FK (nama kolom FK sama di kedua schema).
    const { count: instrumentCount } = await supabase
      .from("instrument")
      .select("id", { count: "exact", head: true })
      .eq("instrument_names_id", id);

    if (instrumentCount && instrumentCount > 0) {
      return NextResponse.json(
        { error: `Tidak dapat menghapus nama instrumen karena masih digunakan oleh ${instrumentCount} instrumen. Hapus atau ubah referensi terlebih dahulu.` },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("instrument_names")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.message?.includes("foreign key constraint")) {
        return NextResponse.json(
          { error: "Tidak dapat menghapus nama instrumen karena masih digunakan oleh data lain." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json({
      message: "Instrument name deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete instrument name" },
      { status: 500 },
    );
  }
}
