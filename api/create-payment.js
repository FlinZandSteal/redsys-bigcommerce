// api/create-payment.js
// Endpoint principal: recibe los datos del pedido de BigCommerce,
// genera los parámetros firmados de Redsys y devuelve un HTML
// con auto-submit que redirige al TPV virtual.

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

  // Preflight request (CORS check del navegador)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ─────────────────────────────────────────────────────────────────────

  // Solo aceptamos POST
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
    const merchantCode   = process.env.REDSYS_MERCHANT_CODE;
    const terminal       = process.env.REDSYS_TERMINAL;
    const environment    = process.env.REDSYS_ENVIRONMENT || "test";
    const baseUrl        = process.env.BASE_URL || "https://redsys.compralo24.com";

    if (!secretKey || !merchantCode || !terminal) {
      console.error("Variables de entorno de Redsys no configuradas");
      return res.status(500).json({ error: "Configuración del servidor incompleta" });
    }

    // ── 3. Preparar datos del pedido ──────────────────────────────────────────
    const order       = formatOrderNumber(orderId);
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

    console.log(
      `[create-payment] Pedido ${orderId} → order Redsys: ${order}, importe: ${amountCents} céntimos`
    );

    // ── 5. HTML auto-submit ───────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirigiendo al pago seguro...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #333;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 400px;
      width: 100%;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid #e0e0e0;
      border-top-color: #1a73e8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #666; line-height: 1.5; }
    .secure {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 24px; font-size: 12px; color: #888;
    }
    .secure svg { width: 14px; height: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Redirigiendo al pago seguro</h1>
    <p>Por favor, no cierres esta ventana.<br>Serás redirigido al TPV Virtual en un momento.</p>
    <div class="secure">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Pago seguro con Redsys
    </div>
  </div>

  <form id="redsysForm" action="${redsysUrl}" method="POST" style="display:none;">
    <input type="hidden" name="Ds_SignatureVersion" value="${redsysParams.Ds_SignatureVersion}">
    <input type="hidden" name="Ds_MerchantParameters" value="${redsysParams.Ds_MerchantParameters}">
    <input type="hidden" name="Ds_Signature" value="${redsysParams.Ds_Signature}">
  </form>

  <script>
    setTimeout(function() {
      document.getElementById('redsysForm').submit();
    }, 500);
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);

  } catch (error) {
    console.error("[create-payment] Error:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detail: error.message
    });
  }
};
