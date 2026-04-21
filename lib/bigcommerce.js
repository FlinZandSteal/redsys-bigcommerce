// lib/bigcommerce.js
// Funciones auxiliares para interactuar con la API de BigCommerce

const BC_API_BASE = "https://api.bigcommerce.com/stores";

/**
 * Obtiene la cabecera de autenticación para la API de BigCommerce.
 */
function getBCHeaders() {
  return {
    "X-Auth-Token": process.env.BC_ACCESS_TOKEN,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Obtiene los detalles de un pedido de BigCommerce por su ID.
 */
async function getOrder(orderId) {
  const storeHash = process.env.BC_STORE_HASH;
  const url = `${BC_API_BASE}/${storeHash}/v2/orders/${orderId}`;

  const res = await fetch(url, { headers: getBCHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BC getOrder error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Actualiza el estado de un pedido en BigCommerce.
 * Estados comunes:
 *   0  = Pending
 *   1  = Awaiting Payment  (antes del pago)
 *   2  = Awaiting Fulfillment (pago recibido)
 *   6  = Cancelled
 *   8  = Declined
 *  11  = Awaiting Fulfillment (paid)
 */
async function updateOrderStatus(orderId, statusId) {
  const storeHash = process.env.BC_STORE_HASH;
  const url = `${BC_API_BASE}/${storeHash}/v2/orders/${orderId}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: getBCHeaders(),
    body: JSON.stringify({ status_id: statusId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BC updateOrderStatus error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Crea una transacción de pago en BigCommerce para registrar el cobro.
 */
async function createPaymentTransaction(orderId, transactionData) {
  const storeHash = process.env.BC_STORE_HASH;
  const url = `${BC_API_BASE}/${storeHash}/v3/orders/${orderId}/transactions`;

  const res = await fetch(url, {
    method: "POST",
    headers: getBCHeaders(),
    body: JSON.stringify(transactionData),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`BC createPaymentTransaction error ${res.status}: ${err}`);
    // No lanzamos error para no bloquear el flujo principal
    return null;
  }
  return res.json();
}

/**
 * Obtiene el checkout de BigCommerce a partir del token (checkoutId).
 * Útil para obtener el importe y los datos del cliente antes del pago.
 */
async function getCheckout(checkoutId) {
  const storeHash = process.env.BC_STORE_HASH;
  const url = `${BC_API_BASE}/${storeHash}/v3/checkouts/${checkoutId}`;

  const res = await fetch(url, { headers: getBCHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BC getCheckout error ${res.status}: ${err}`);
  }
  const json = await res.json();
  return json.data;
}

module.exports = {
  getOrder,
  updateOrderStatus,
  createPaymentTransaction,
  getCheckout,
};
