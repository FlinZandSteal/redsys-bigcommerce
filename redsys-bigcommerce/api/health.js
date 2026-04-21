// api/health.js
// Endpoint de diagnóstico — verifica que todas las variables de entorno
// están configuradas y que la conexión con BigCommerce es correcta.
// Accede a: https://TU-PROYECTO.vercel.app/api/health

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const checks = {};

  // ── 1. Variables de Redsys ────────────────────────────────────────────────
  checks.redsys = {
    merchantCode:  !!process.env.REDSYS_MERCHANT_CODE  ? "✅ " + process.env.REDSYS_MERCHANT_CODE : "❌ NO CONFIGURADO",
    terminal:      !!process.env.REDSYS_TERMINAL        ? "✅ " + process.env.REDSYS_TERMINAL       : "❌ NO CONFIGURADO",
    secretKey:     !!process.env.REDSYS_SECRET_KEY      ? "✅ (oculta, " + process.env.REDSYS_SECRET_KEY.length + " chars)" : "❌ NO CONFIGURADO",
    environment:   process.env.REDSYS_ENVIRONMENT       || "⚠️  no definido (usará 'test')",
    tpvUrl:        (process.env.REDSYS_ENVIRONMENT === "production")
                     ? "https://sis.redsys.es/sis/realizarPago"
                     : "https://sis-t.redsys.es:25443/sis/realizarPago",
  };

  // ── 2. Variables de URLs ──────────────────────────────────────────────────
  checks.urls = {
    baseUrl:   process.env.BASE_URL   || "❌ NO CONFIGURADO",
    storeUrl:  process.env.STORE_URL  || "❌ NO CONFIGURADO",
  };

  // ── 3. Variables de BigCommerce ───────────────────────────────────────────
  checks.bigcommerce = {
    storeHash:   !!process.env.BC_STORE_HASH    ? "✅ " + process.env.BC_STORE_HASH    : "❌ NO CONFIGURADO",
    clientId:    !!process.env.BC_CLIENT_ID     ? "✅ " + process.env.BC_CLIENT_ID     : "❌ NO CONFIGURADO",
    accessToken: !!process.env.BC_ACCESS_TOKEN  ? "✅ (oculto, " + process.env.BC_ACCESS_TOKEN.length + " chars)" : "❌ NO CONFIGURADO",
  };

  // ── 4. Test de conexión con BigCommerce API ───────────────────────────────
  checks.bigcommerce.apiConnection = "⏳ comprobando...";

  if (process.env.BC_STORE_HASH && process.env.BC_ACCESS_TOKEN) {
    try {
      const bcUrl = `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/store`;
      const bcRes = await fetch(bcUrl, {
        headers: {
          "X-Auth-Token": process.env.BC_ACCESS_TOKEN,
          "Accept": "application/json",
        },
      });

      if (bcRes.ok) {
        const data = await bcRes.json();
        checks.bigcommerce.apiConnection = "✅ Conectado";
        checks.bigcommerce.storeName = data.name || "—";
        checks.bigcommerce.storePlan = data.plan_name || "—";
        checks.bigcommerce.storeAddress = data.address || "—";
      } else {
        const errText = await bcRes.text();
        checks.bigcommerce.apiConnection = `❌ Error HTTP ${bcRes.status}: ${errText.substring(0, 100)}`;
      }
    } catch (err) {
      checks.bigcommerce.apiConnection = `❌ Error de red: ${err.message}`;
    }
  } else {
    checks.bigcommerce.apiConnection = "⚠️  Saltado (faltan credenciales)";
  }

  // ── 5. Verificar firma Redsys ─────────────────────────────────────────────
  if (process.env.REDSYS_SECRET_KEY) {
    try {
      const { buildRedsysRequest, formatOrderNumber, toCents } = require("../lib/redsys");
      const testParams = buildRedsysRequest({
        secretKey: process.env.REDSYS_SECRET_KEY,
        merchantCode: process.env.REDSYS_MERCHANT_CODE || "000000000",
        terminal: process.env.REDSYS_TERMINAL || "001",
        order: formatOrderNumber("9999"),
        amount: toCents("1.00"),
        currency: "978",
        urlOK: "https://example.com/ok",
        urlKO: "https://example.com/ko",
        urlNotification: "https://example.com/notify",
      });
      checks.redsys.signatureTest = testParams.Ds_Signature
        ? "✅ Firma generada correctamente (" + testParams.Ds_Signature.substring(0, 16) + "...)"
        : "❌ Error al generar firma";
    } catch (e) {
      checks.redsys.signatureTest = "❌ Error: " + e.message;
    }
  }

  // ── 6. Resumen global ─────────────────────────────────────────────────────
  const allRedsysOk = process.env.REDSYS_MERCHANT_CODE && process.env.REDSYS_TERMINAL && process.env.REDSYS_SECRET_KEY;
  const allBCOk     = process.env.BC_STORE_HASH && process.env.BC_CLIENT_ID && process.env.BC_ACCESS_TOKEN;

  const status = {
    overall: (allRedsysOk && allBCOk) ? "✅ Todo configurado" : "⚠️  Configuración incompleta",
    redsys:  allRedsysOk ? "✅ OK" : "❌ Faltan variables",
    bigcommerce: allBCOk ? "✅ OK" : "❌ Faltan variables",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  };

  // HTML bonito para visualizarlo en el navegador
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagnóstico — Redsys Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #0f172a; color: #e2e8f0; padding: 32px; }
    h1 { font-size: 20px; color: #38bdf8; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 32px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #1e293b; }
    .row { display: flex; gap: 16px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #1e293b22; }
    .key { color: #94a3b8; min-width: 180px; }
    .val { color: #e2e8f0; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .ok  { background: #14532d; color: #4ade80; }
    .err { background: #450a0a; color: #f87171; }
    .warn { background: #422006; color: #fbbf24; }
    .overall { padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; font-weight: bold; }
    .overall.ok { background: #14532d22; border: 1px solid #4ade8044; color: #4ade80; }
    .overall.err { background: #450a0a22; border: 1px solid #f8717144; color: #f87171; }
  </style>
</head>
<body>
  <h1>🔍 Redsys ↔ BigCommerce Gateway</h1>
  <div class="subtitle">Diagnóstico del sistema · ${new Date().toLocaleString("es-ES")}</div>

  <div class="overall ${(allRedsysOk && allBCOk) ? 'ok' : 'err'}">
    ${status.overall}
  </div>

  <div class="section">
    <div class="section-title">Redsys</div>
    ${Object.entries(checks.redsys).map(([k, v]) => `
    <div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join("")}
  </div>

  <div class="section">
    <div class="section-title">BigCommerce</div>
    ${Object.entries(checks.bigcommerce).map(([k, v]) => `
    <div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join("")}
  </div>

  <div class="section">
    <div class="section-title">URLs</div>
    ${Object.entries(checks.urls).map(([k, v]) => `
    <div class="row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join("")}
  </div>

  <div class="section">
    <div class="section-title">Sistema</div>
    <div class="row"><span class="key">Node.js</span><span class="val">${process.version}</span></div>
    <div class="row"><span class="key">Timestamp</span><span class="val">${new Date().toISOString()}</span></div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
};
