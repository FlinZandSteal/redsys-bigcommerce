// api/payment-ok.js
// Página de retorno tras pago exitoso.
// BigCommerce redirigirá al cliente aquí después de que Redsys confirme el pago.

module.exports = function handler(req, res) {
  const { orderId } = req.query;
  const storeUrl = process.env.STORE_URL || "https://compralo24.com";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Pago completado! — Compralo24</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
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
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg { width: 36px; height: 36px; color: #16a34a; }
    h1 { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 12px; }
    .order-id {
      display: inline-block;
      background: #f0fdf4;
      color: #16a34a;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    p { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 8px; }
    .actions { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
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
    .btn-primary { background: #16a34a; color: white; }
    .btn-secondary { background: #f5f5f5; color: #333; }
    .countdown { font-size: 13px; color: #aaa; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1>¡Pago completado!</h1>
    ${orderId ? `<span class="order-id">Pedido #${orderId}</span>` : ""}
    <p>Tu pago se ha procesado correctamente.</p>
    <p>Recibirás un email de confirmación con los detalles de tu pedido en breve.</p>
    <div class="actions">
      <a href="${storeUrl}/account.php?action=order_status" class="btn btn-primary">Ver mis pedidos</a>
      <a href="${storeUrl}" class="btn btn-secondary">Seguir comprando</a>
    </div>
    <p class="countdown">Serás redirigido automáticamente en <span id="counter">10</span>s</p>
  </div>

  <script>
    let n = 10;
    const el = document.getElementById('counter');
    const timer = setInterval(() => {
      n--;
      if (el) el.textContent = n;
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = "${storeUrl}/account.php?action=order_status";
      }
    }, 1000);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
};
