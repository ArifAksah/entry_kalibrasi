import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../../lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("instrument_code")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch instrument code" },
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
    const { code_alat, name } = body;

    if (!code_alat) {
      return NextResponse.json(
        { error: "Kode alat is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("instrument_code")
      .update({ code_alat, name })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update instrument code" },
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

    // Check if any instrument_names or instruments still reference this code
    const { count: namesCount } = await supabase
      .from("instrument_names")
      .select("id", { count: "exact", head: true })
      .eq("instrument_code_id", id);

    if (namesCount && namesCount > 0) {
      return NextResponse.json(
        { error: `Tidak dapat menghapus kode instrumen karena masih digunakan oleh ${namesCount} nama instrumen. Hapus atau ubah referensi terlebih dahulu.` },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("instrument_code")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.message?.includes("foreign key constraint")) {
        return NextResponse.json(
          { error: "Tidak dapat menghapus kode instrumen karena masih digunakan oleh data lain." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Instrument code deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete instrument code" },
      { status: 500 },
    );
  }
}
