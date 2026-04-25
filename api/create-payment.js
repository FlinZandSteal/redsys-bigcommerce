// api/create-payment.js
const {
  REDSYS_URLS,
  buildRedsysRequest,
  formatOrderNumber,
  toCents,
} = require("../lib/redsys");

module.exports = async function handler(req, res) {

  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const {
      orderId,       // puede ser checkoutId o un orderId real
      checkoutId,    // el UUID del checkout de BigCommerce
      amount,
      currency = "978",
      description = "Pedido Compralo24",
    } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Falta el parámetro amount" });
    }

    const secretKey    = process.env.REDSYS_SECRET_KEY;
    const merchantCode = process.env.REDSYS_MERCHANT_CODE;
    const terminal     = process.env.REDSYS_TERMINAL;
    const environment  = process.env.REDSYS_ENVIRONMENT || "test";
    const baseUrl      = process.env.BASE_URL || "https://redsys-bigcommerce.vercel.app";
    const bcStoreHash  = process.env.BC_STORE_HASH;
    const bcToken      = process.env.BC_ACCESS_TOKEN;

    if (!secretKey || !merchantCode || !terminal) {
      return res.status(500).json({ error: "Configuración de Redsys incompleta" });
    }

    // ── Crear pedido real en BigCommerce desde el checkout ──────────────────
    let realOrderId = orderId;

    const checkoutUUID = checkoutId || (orderId && orderId.length > 10 && !orderId.startsWith("checkout-") ? orderId : null);

    if (checkoutUUID && bcStoreHash && bcToken) {
      try {
        console.log(`[create-payment] Convirtiendo checkout ${checkoutUUID} en pedido BC...`);
        const bcRes = await fetch(
          `https://api.bigcommerce.com/stores/${bcStoreHash}/v3/checkouts/${checkoutUUID}/orders`,
          {
            method: "POST",
            headers: {
              "X-Auth-Token": bcToken,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (bcRes.ok) {
          const bcData = await bcRes.json();
          realOrderId = String(bcData.data && bcData.data.id ? bcData.data.id : orderId);
          console.log(`[create-payment] Pedido BC creado: #${realOrderId}`);
        } else {
          const errText = await bcRes.text();
          console.warn(`[create-payment] No se pudo crear el pedido BC (${bcRes.status}): ${errText}`);
          // Continuamos con el orderId original
        }
      } catch (bcErr) {
        console.warn(`[create-payment] Error llamando a BC API: ${bcErr.message}`);
      }
    }

    // ── Preparar número de pedido para Redsys ───────────────────────────────
    const timestamp   = Date.now().toString().slice(-6);
    const rawOrder    = String(realOrderId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    const order       = formatOrderNumber(rawOrder + timestamp);
    const amountCents = toCents(amount);
    const redsysUrl   = REDSYS_URLS[environment] || REDSYS_URLS.test;

    const urlOK           = `${baseUrl}/api/payment-ok?orderId=${realOrderId}`;
    const urlKO           = `${baseUrl}/api/payment-ko?orderId=${realOrderId}`;
    const urlNotification = `${baseUrl}/api/redsys-notify`;

    const redsysParams = buildRedsysRequest({
      secretKey,
      merchantCode,
      terminal,
      order,
      amount: amountCents,
      currency,
      urlOK,
      urlKO,
      urlNotification,
      merchantName: "Compralo24",
      productDescription: description,
    });

    console.log(`[create-payment] Pedido BC #${realOrderId} → Redsys order: ${order}, importe: ${amountCents} céntimos`);

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      redsysUrl,
      Ds_SignatureVersion:   redsysParams.Ds_SignatureVersion,
      Ds_MerchantParameters: redsysParams.Ds_MerchantParameters,
      Ds_Signature:          redsysParams.Ds_Signature,
      realOrderId,
    });

  } catch (error) {
    console.error("[create-payment] Error:", error);
    return res.status(500).json({ error: "Error interno", detail: error.message });
  }
};
