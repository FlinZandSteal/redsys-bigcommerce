// api/payment-ko.js
// Página de retorno tras pago fallido o cancelado.

module.exports = function handler(req, res) {
  const { orderId } = req.query;
  const storeUrl = process.env.STORE_URL || "https://compralo24.com";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago no completado — Compralo24</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #fff7f7 0%, #fee2e2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      max-width: 440px;
      width: 100%;
    }
    .icon {
      width: 72px; height: 72px;
      background: #fee2e2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg { width: 36px; height: 36px; color: #dc2626; }
    h1 { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 12px; }
    .order-id {
      display: inline-block;
      background: #fff7f7;
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    p { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 8px; }
    .tip {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #92400e;
      margin: 20px 0;
      text-align: left;
    }
    .tip strong { display: block; margin-bottom: 4px; }
    .actions { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
    .btn {
      display: block;
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #dc2626; color: white; }
    .btn-secondary { background: #f5f5f5; color: #333; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </div>
    <h1>Pago no completado</h1>
    ${orderId ? `<span class="order-id">Pedido #${orderId}</span>` : ""}
    <p>No hemos podido procesar tu pago. El pedido no ha sido cobrado.</p>
    <div class="tip">
      <strong>¿Qué puedo hacer?</strong>
      Comprueba que los datos de tu tarjeta son correctos y que dispones de saldo suficiente. Si el problema persiste, contacta con tu banco.
    </div>
    <div class="actions">
      <a href="${storeUrl}/checkout" class="btn btn-primary">Intentar de nuevo</a>
      <a href="${storeUrl}" class="btn btn-secondary">Volver a la tienda</a>
    </div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
};
