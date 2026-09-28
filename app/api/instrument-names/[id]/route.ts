import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../../lib/supabase";
import { clientSafeMessage } from '../../../../lib/api-error'
import { hasRenderCredentials, isRenderAuthorizedFor, requireRoles, unauthorized } from '../../../../lib/api-auth'

// Schema production: instrument_names(id, name, code_alat, created_at).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (hasRenderCredentials(request) && !await isRenderAuthorizedFor(request, { type: 'instrument-name', id })) {
      return unauthorized();
    }
    const { data, error } = await supabase
      .from("instrument_names")
      .select("id, name, code_alat, created_at")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json(data);
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

    const updatePayload: any = { name: nameValue };
    if (resolvedCode !== undefined) updatePayload.code_alat = resolvedCode;

    const { data, error } = await supabase
      .from("instrument_names")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json(data);
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

    // Cek referensi dari instrument lewat FK production: instrument.instrument_names_id.
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
