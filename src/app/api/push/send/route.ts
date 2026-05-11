import { NextRequest, NextResponse } from "next/server";
import webpush, { WebPushError } from "web-push";
import { createClient } from "@supabase/supabase-js";

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID details not found. Push notifications will not work.");
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication Check
    const apiKey = req.headers.get("x-api-key");
    const serverKey = process.env.PUSH_API_SECRET;
    
    // Allow if PUSH_API_SECRET is not set (lax mode for dev) or if it matches
    if (serverKey && apiKey !== serverKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Safe Supabase Instantiation for Backend (bypasses RLS to fetch all users)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase variables for push notification sending.");
      return NextResponse.json({ error: "Configuração do servidor incorreta." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { title, body, url } = await req.json();

    // Fetch all subscriptions (Ideally should be paginated if > 1000)
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, subscription");

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, removed: 0 });
    }

    const payload = JSON.stringify({
      title: title || "🚨 SOS Moto Resgate",
      body: body || "Nova solicitação de guincho!",
      url: url || "/dashboard",
      tag: "sos-alert",
    });

    let sent = 0;
    const endpointsToRemove: string[] = [];
    const CHUNK_SIZE = 50; // Process 50 pushes at a time

    // 3. Chunking to prevent OOM / Rate limits
    for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
      const chunk = subs.slice(i, i + CHUNK_SIZE);
      
      const chunkPromises = chunk.map(async (row) => {
        try {
          const sub = JSON.parse(row.subscription);
          await webpush.sendNotification(sub, payload);
          return { status: "fulfilled", endpoint: row.endpoint };
        } catch (err) {
          return { status: "rejected", err, endpoint: row.endpoint };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      
      // 4. Handle results and identify 410 Gone / NotRegistered
      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          sent++;
        } else if (result.status === "rejected") {
          const err = result.err;
          // Check if it's a 410 or invalid subscription error from WebPush
          if (err instanceof WebPushError && (err.statusCode === 410 || err.statusCode === 404)) {
             endpointsToRemove.push(result.endpoint);
          } else {
             console.error("Failed to send push notification:", err);
          }
        }
      }
      
      // Small artificial delay between chunks to prevent rate limiting
      if (i + CHUNK_SIZE < subs.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 5. Cleanup dead subscriptions
    let removed = 0;
    if (endpointsToRemove.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", endpointsToRemove);
        
      if (!deleteError) {
        removed = endpointsToRemove.length;
      } else {
        console.error("Erro ao deletar inscrições inválias:", deleteError);
      }
    }

    return NextResponse.json({ ok: true, sent, removed });
  } catch (err) {
    console.error("Erro ao enviar notificação:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
