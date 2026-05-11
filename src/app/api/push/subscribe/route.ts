import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Subscription inválida" }, { status: 400 });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ endpoint: subscription.endpoint, subscription: JSON.stringify(subscription) }, 
               { onConflict: "endpoint" });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar subscription:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar subscription:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
