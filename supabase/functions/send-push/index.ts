import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const { pedido_id, type, motoboy_message } = await req.json();

    if (!pedido_id || !type) {
      return new Response(
        JSON.stringify({ error: "pedido_id ou type faltando" }),
        { status: 400 }
      );
    }

    // ===============================
    // BUSCA PEDIDO + TOKEN CLIENTE
    // ===============================
    const { data: pedido } = await supabase
      .from("pedidos")
      .select(`
        id,
        status,
        customer_id,
        motoboy_id,
        clientes (
          expo_push_token
        ),
        motoboys (
          expo_push_token
        )
      `)
      .eq("id", pedido_id)
      .single();

    if (!pedido) {
      throw new Error("Pedido não encontrado");
    }

    // ===============================
    // DEFINE DESTINO
    // ===============================
    let expoToken = "";

    if (type.startsWith("cliente")) {
      expoToken = pedido.clientes?.expo_push_token;
    }

    if (type.startsWith("motoboy")) {
      expoToken = pedido.motoboys?.expo_push_token;
    }

    if (!expoToken) {
      throw new Error("Expo token não encontrado");
    }

    // ===============================
    // MENSAGENS
    // ===============================
    let title = "";
    let body = "";

    switch (type) {
      case "cliente_pedido_aceito":
        title = "🛒 Pedido aceito";
        body = "Seu pedido foi confirmado.";
        break;

      case "cliente_pedido_retirado":
        title = "🛵 Pedido retirado";
        body = "O motoboy já pegou seu pedido.";
        break;

      case "cliente_motoboy_chegando":
        title = "📍 Motoboy chegando";
        body = "Ele está a poucos minutos.";
        break;

      case "cliente_pedido_cancelado":
        title = "❌ Pedido cancelado";
        body = "Seu pedido foi cancelado.";
        break;

      case "cliente_mensagem":
        title = "💬 Mensagem do motoboy";
        body = motoboy_message || "Nova mensagem.";
        break;

      case "motoboy_novo_pedido":
        title = "📦 Novo pedido";
        body = "Tem um pedido disponível pra você.";
        break;

      default:
        title = "Sapucaí Entrega";
        body = "Atualização do sistema.";
    }

    // ===============================
    // ENVIA PARA EXPO
    // ===============================
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: expoToken,
        sound: "default",
        title,
        body,
        priority: "high",
      }),
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
});
