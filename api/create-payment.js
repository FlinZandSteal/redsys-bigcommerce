// api/create-payment.js

const {
  REDSYS_URLS,
  buildRedsysRequest,
  formatOrderNumber,
  toCents,
} = require("../lib/redsys");

module.exports = async function handler(req, res) {

  // ── CORS ──────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "https://compralo24.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ── 1. Extraer parámetros del body ────────────────────────────────────────
    const {
      orderId,
      amount,
      currency = "978",
      description = "Pedido Compralo24",
    } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        error: "Faltan parámetros: orderId y amount son obligatorios"
      });
    }

    // ── 2. Configuración desde variables de entorno ───────────────────────────
    const secretKey     = process.env.REDSYS_SECRET_KEY;
    const merchantCode  = process.env.REDSYS_MERCHANT_CODE;
    const terminal      = process.env.REDSYS_TERMINAL;
    const environment   = process.env.REDSYS_ENVIRONMENT || "test";
    const baseUrl       = process.env.BASE_URL || "https://redsys.compralo24.com";

    if (!secretKey || !merchantCode || !terminal) {
      console.error("Variables de entorno de Redsys no configuradas");
      return res.status(500).json({ error: "Configuración del servidor incompleta" });
    }

    // ── 3. Preparar datos del pedido ──────────────────────────────────────────
    const timestamp   = Date.now().toString().slice(-6);
    const rawOrder    = String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    const order       = formatOrderNumber(rawOrder + timestamp);

    const amountCents = toCents(amount);
    const redsysUrl   = REDSYS_URLS[environment] || REDSYS_URLS.test;

    const urlOK           = `${baseUrl}/api/payment-ok?orderId=${orderId}`;
    const urlKO           = `${baseUrl}/api/payment-ko?orderId=${orderId}`;
    const urlNotification = `${baseUrl}/api/redsys-notify`;

    // ── 4. Construir petición firmada ─────────────────────────────────────────
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

    // ── 5. Devolver JSON ─────────────────────────────────────────────────────
    console.log(`[create-payment] Pedido ${orderId} → order Redsys: ${order}, importe: ${amountCents} céntimos`);

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      redsysUrl,
      Ds_SignatureVersion: redsysParams.Ds_SignatureVersion,
      Ds_MerchantParameters: redsysParams.Ds_MerchantParameters,
      Ds_Signature: redsysParams.Ds_Signature,
    });

  } catch (error) {
    console.error("[create-payment] Error:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detail: error.message
    });
  }
};
