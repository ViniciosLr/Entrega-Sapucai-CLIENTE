import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.info("🔄 mp-webhook function started");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  // Responder OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Responder GET (verificação do Mercado Pago)
  if (req.method === "GET") {
    console.log("📡 Webhook verificado pelo MP");
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("📩 Webhook recebido!");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("📦 Body:", JSON.stringify(body, null, 2));

    // Extrair ID do pagamento
    let paymentId: string | null = null;

    if (body.data?.id) {
      paymentId = body.data.id;
    } else if (body.resource) {
      const match = body.resource.match(/\/payments\/(\d+)/);
      if (match) paymentId = match[1];
    }

    if (!paymentId) {
      console.error("❌ ID do pagamento não encontrado");
      return new Response(
        JSON.stringify({ success: false, error: "ID não encontrado" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`🔍 Buscando pagamento: ${paymentId}`);

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não configurado" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Consultar MP
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      }
    );

    if (!mpResponse.ok) {
      console.error(`❌ Erro ao buscar pagamento: ${mpResponse.status}`);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar pagamento" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const paymentData = await mpResponse.json();
    const newStatus = paymentData.status;
    const externalRef = paymentData.external_reference;

    console.log(`📊 Status: ${newStatus} | Ref: ${externalRef}`);

    // Atualizar tabela payments
    await supabase
      .from("payments")
      .update({
        status: newStatus,
        status_detail: paymentData.status_detail,
        payment_data: paymentData,
        updated_at: new Date().toISOString(),
        date_approved: paymentData.date_approved || null,
      })
      .eq("mp_payment_id", paymentId.toString());

    console.log("✅ Payment atualizado");

    // Buscar o pagamento para pegar o order_id
    const { data: payment } = await supabase
      .from("payments")
      .select("order_id")
      .eq("mp_payment_id", paymentId.toString())
      .single();

    if (payment?.order_id) {
      let orderStatus = "criado";
      let paymentStatus = "pending";

      switch (newStatus) {
        case "approved":
          orderStatus = "confirmado";
          paymentStatus = "approved";
          break;
        case "rejected":
          orderStatus = "cancelado";
          paymentStatus = "rejected";
          break;
        case "cancelled":
          orderStatus = "cancelado";
          paymentStatus = "cancelled";
          break;
        case "refunded":
          orderStatus = "reembolsado";
          paymentStatus = "refunded";
          break;
        case "in_process":
        case "pending":
          orderStatus = "aguardando_pagamento";
          paymentStatus = "pending";
          break;
      }

      await supabase
        .from("pedidos")
        .update({
          payment_status: paymentStatus,
          status: orderStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.order_id);

      console.log(`✅ Pedido ${payment.order_id} atualizado: ${orderStatus}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentId,
        status: newStatus,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error("❌ ERRO:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Erro interno",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
EOF