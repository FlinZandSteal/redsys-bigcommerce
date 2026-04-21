// api/redsys-notify.js
// Webhook que recibe la notificación asíncrona de Redsys (Ds_Notification).
// Verifica la firma, interpreta el resultado y actualiza el pedido en BigCommerce.

const { verifyRedsysNotification } = require("../lib/redsys");
const { updateOrderStatus, createPaymentTransaction } = require("../lib/bigcommerce");

// Códigos de respuesta Redsys: 0000-0099 = aprobado
// >= 0900 = rechazado/error (excepto algunos códigos especiales)
function isApproved(responseCode) {
  const code = parseInt(responseCode, 10);
  return !isNaN(code) && code >= 0 && code <= 99;
}

function getResponseMessage(code) {
  const messages = {
    "0000": "Autorización aprobada",
    "0101": "Tarjeta caducada",
    "0102": "Tarjeta en excepción transitoria",
    "0106": "Intentos PIN excedidos",
    "0125": "Tarjeta no efectiva",
    "0129": "Código de seguridad (CVV2/CVC2) incorrecto",
    "0180": "Tarjeta ajena al servicio",
    "0184": "Error en autenticación del titular",
    "0190": "Denegación sin especificar motivo",
    "0191": "Fecha de caducidad errónea",
    "0202": "Tarjeta en excepción transitoria con retirada",
    "0904": "Comercio no registrado en FUC",
    "0909": "Error de sistema",
    "0912": "Emisor no disponible",
    "0913": "Pedido repetido",
    "0944": "Sesión incorrecta",
    "0950": "Operación de devolución no permitida",
    "9064": "Número de posiciones de la tarjeta incorrecto",
    "9078": "Tipo de operación no permitido",
    "9093": "Tarjeta no existente",
    "9094": "Rechazo servidores internacionales",
    "9104": "Comercio con autenticación obligatoria, titular sin clave de compra segura",
    "9218": "El comercio no permite op. seguras por entrada canal",
    "9253": "Tarjeta no cumple el check-digit",
    "9256": "El comercio no puede realizar preautorizaciones",
    "9261": "Operación detenida por superar el control de restricciones",
    "9912": "Emisor no disponible",
    "9913": "Error en la confirmación que el comercio envía al TPV Virtual",
    "9914": "Confirmación KO del comercio",
    "9928": "Anulación de autorización en diferido por el Sistema",
    "9929": "Anulación de autorización en diferido por el Comercio",
    "9997": "Se está procesando otra transacción en SIS con la misma tarjeta",
    "9998": "Operación en proceso de solicitud de datos de tarjeta",
    "9999": "Operación que ha sido redirigida al emisor a autenticar",
  };
  return messages[code] || `Código de respuesta: ${code}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!secretKey) {
      console.error("[redsys-notify] REDSYS_SECRET_KEY no configurada");
      return res.status(500).send("KO");
    }

    // ── 1. Extraer parámetros de la notificación ──────────────────────────────
    const { Ds_MerchantParameters, Ds_Signature, Ds_SignatureVersion } = req.body;

    if (!Ds_MerchantParameters || !Ds_Signature) {
      console.error("[redsys-notify] Parámetros de notificación incompletos");
      return res.status(400).send("KO");
    }

    // ── 2. Verificar la firma ─────────────────────────────────────────────────
    const { valid, data } = verifyRedsysNotification(secretKey, Ds_MerchantParameters, Ds_Signature);

    if (!valid) {
      console.error("[redsys-notify] Firma inválida — posible fraude");
      return res.status(400).send("KO");
    }

    // ── 3. Interpretar la respuesta ───────────────────────────────────────────
    const responseCode  = data.Ds_Response || data.DS_RESPONSE || "";
    const redsysOrder   = data.Ds_Order    || data.DS_ORDER    || "";
    const amountCents   = data.Ds_Amount   || data.DS_AMOUNT   || "0";
    const currency      = data.Ds_Currency || data.DS_CURRENCY || "978";
    const authCode      = data.Ds_AuthorisationCode || "";

    // El número de pedido en Redsys es el ID de BigCommerce (posiblemente con padding)
    // Lo limpiamos para recuperar el ID original
    const orderId = String(parseInt(redsysOrder, 10));

    const approved = isApproved(responseCode);
    const message  = getResponseMessage(responseCode);

    console.log(`[redsys-notify] Pedido: ${redsysOrder} | Respuesta: ${responseCode} | ${approved ? "APROBADO" : "RECHAZADO"} | ${message}`);

    // ── 4. Actualizar estado en BigCommerce ───────────────────────────────────
    // Solo actualizamos si tenemos credenciales de BC configuradas
    const hasBCCredentials = process.env.BC_STORE_HASH && process.env.BC_ACCESS_TOKEN;

    if (hasBCCredentials) {
      try {
        if (approved) {
          // Estado 11 = "Awaiting Fulfillment" (pago recibido, a preparar envío)
          await updateOrderStatus(orderId, 11);

          // Registrar la transacción de pago
          await createPaymentTransaction(orderId, {
            event: "purchase",
            method: "credit_card",
            amount: parseFloat(amountCents) / 100,
            currency: currency,
            gateway: "redsys",
            gateway_transaction_id: authCode || redsysOrder,
            status: "ok",
          });

          console.log(`[redsys-notify] Pedido ${orderId} marcado como PAGADO en BigCommerce`);
        } else {
          // Estado 6 = "Cancelled"
          await updateOrderStatus(orderId, 6);
          console.log(`[redsys-notify] Pedido ${orderId} marcado como CANCELADO en BigCommerce`);
        }
      } catch (bcError) {
        // Logamos pero no fallamos: Redsys necesita recibir "OK" aunque BC falle
        console.error(`[redsys-notify] Error actualizando BigCommerce para pedido ${orderId}:`, bcError.message);
      }
    } else {
      console.warn("[redsys-notify] Credenciales de BigCommerce no configuradas — omitiendo actualización de pedido");
    }

    // ── 5. Responder OK a Redsys ──────────────────────────────────────────────
    // Redsys espera una respuesta HTTP 200 con body "OK" para confirmar la recepción.
    // Si respondemos KO o con error, Redsys reintentará la notificación.
    return res.status(200).send("OK");

  } catch (error) {
    console.error("[redsys-notify] Error inesperado:", error);
    // Respondemos 200 OK igualmente para evitar reintentos si el error es nuestro
    return res.status(200).send("OK");
  }
};
