import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function cleanCPF(cpf: string | undefined) {
  if (!cpf) return null;
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return null;
  return cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Token MP não configurado" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");

    // ========================
    // GET STATUS PAYMENT
    // ========================
    if (req.method === "GET" && paymentId) {
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
          },
        }
      );

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: mpData.message || "Erro ao verificar pagamento",
          }),
          { status: mpResponse.status, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: mpData.id,
          status: mpData.status,
          status_detail: mpData.status_detail,
          external_reference: mpData.external_reference,
          date_created: mpData.date_created,
          date_approved: mpData.date_approved,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ========================
    // BODY (POST ONLY)
    // ========================
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Body inválido" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("📦 BODY:", body);

    // ========================
    // TOKENIZA CARTÃO
    // ========================
    if (body.action === "tokenize_card") {
      const mpResponse = await fetch(
        "https://api.mercadopago.com/v1/card_tokens",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            card_number: body.card_number,
            cardholder: {
              name: body.cardholder_name,
            },
            expiration_month: body.expiration_month,
            expiration_year: body.expiration_year,
            security_code: body.security_code,
          }),
        }
      );

      const tokenData = await mpResponse.json();

      if (!mpResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: tokenData.message || "Erro ao tokenizar cartão",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          token: tokenData.id,
          last_four_digits: tokenData.last_four_digits,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ========================
    // AUTH CHECK
    // ========================
    if (!req.headers.get("Authorization")) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem autorização" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const {
      amount,
      paymentMethod,
      cardToken,
      cardBrand,
      installments,
      payerEmail,
      payerName,
      payerCpf,
    } = body;

    // ========================
    // VALIDAÇÕES IMPORTANTES
    // ========================
    const cpf = cleanCPF(payerCpf);

    if (!cpf) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CPF inválido ou não enviado corretamente",
          code: "INVALID_CPF",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const value = Number(amount);

    if (!value || value < 0.5) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Valor mínimo R$ 0,50",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const payer = {
      email: payerEmail || "cliente@email.com",
      first_name: (payerName || "Cliente").split(" ")[0],
      last_name: (payerName || "Cliente").split(" ").slice(1).join(" ") || "Silva",
      identification: {
        type: "CPF",
        number: cpf,
      },
    };

    const externalRef = `pedido-${Date.now()}`;

    let mpPayload: any;

    // ========================
    // PIX
    // ========================
    if (paymentMethod === "pix") {
      mpPayload = {
        transaction_amount: value,
        description: `Pedido ${externalRef}`,
        payment_method_id: "pix",
        payer,
        external_reference: externalRef,
      };
    }

    // ========================
    // CARTÃO
    // ========================
    else if (
      paymentMethod === "credit_card" ||
      paymentMethod === "debit_card"
    ) {
      if (!cardToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Token do cartão não enviado",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      mpPayload = {
        transaction_amount: value,
        description: `Pedido ${externalRef}`,
        token: cardToken,
        installments: installments || 1,
        payment_method_id: cardBrand || "visa",
        payer,
        external_reference: externalRef,
      };
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Método inválido" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("📤 MP PAYLOAD:", mpPayload);

    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": externalRef,
        },
        body: JSON.stringify(mpPayload),
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: mpData.message || "Erro Mercado Pago",
          details: mpData,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: mpData.id,
        status: mpData.status,
        pix: mpData.point_of_interaction?.transaction_data
          ? {
              qr_code: mpData.point_of_interaction.transaction_data.qr_code,
              qr_code_base64:
                mpData.point_of_interaction.transaction_data.qr_code_base64,
              ticket_url:
                mpData.point_of_interaction.transaction_data.ticket_url,
            }
          : null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});