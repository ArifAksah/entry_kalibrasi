import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../../lib/supabase";
import { InstrumentNameUpdate } from "../../../../lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("instrument_names")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, names, code_alat, instrument_code_id } = body;

    const nameValue = names || name;
    if (!nameValue) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updatePayload: any = { names: nameValue };
    if (code_alat !== undefined) updatePayload.code_alat = code_alat;
    if (instrument_code_id !== undefined)
      updatePayload.instrument_code_id = instrument_code_id;

    const { data, error } = await supabase
      .from("instrument_names")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map 'names' to 'name' for frontend compatibility
    const mapped = { ...data, name: data.names ?? data.name };

    return NextResponse.json(mapped);
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
  try {
    const { id } = await params;

    // Check if any instruments still reference this name
    const { count: instrumentCount } = await supabase
      .from("instrument")
      .select("id", { count: "exact", head: true })
      .eq("names", id);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
