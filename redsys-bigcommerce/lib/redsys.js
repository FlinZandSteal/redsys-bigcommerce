// lib/redsys.js
// Utilidades para generar y verificar firmas Redsys (HMAC-SHA256 / 3DES)

const crypto = require("crypto");

// ─── Constantes ────────────────────────────────────────────────────────────────
const REDSYS_URLS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  production: "https://sis.redsys.es/sis/realizarPago",
};

/**
 * Encripta con 3DES (CBC, cero-padding) usando la clave secreta Base64.
 * Se usa para derivar la clave de firma por pedido.
 */
function encrypt3DES(key, data) {
  const keyBuffer = Buffer.from(key, "base64");
  const dataBuffer = Buffer.from(data, "utf8");

  // Padding manual a múltiplo de 8 bytes
  const padLen = 8 - (dataBuffer.length % 8);
  const padded = Buffer.concat([dataBuffer, Buffer.alloc(padLen, 0)]);

  const cipher = crypto.createCipheriv(
    "des-ede3-cbc",
    keyBuffer,
    Buffer.alloc(8, 0)
  );
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

/**
 * Genera la firma HMAC-SHA256 para los parámetros del pedido.
 * Flujo oficial Redsys:
 *   1. Derivar clave = 3DES(secretKey, DS_MERCHANT_ORDER)
 *   2. Firma = HMAC-SHA256(Ds_MerchantParameters_Base64, claveDerivada)
 *   3. Codificar firma en Base64
 */
function createSignature(secretKey, order, merchantParamsBase64) {
  const derivedKey = encrypt3DES(secretKey, order);
  const hmac = crypto.createHmac("sha256", derivedKey);
  hmac.update(merchantParamsBase64);
  return hmac.digest("base64");
}

/**
 * Construye el objeto con los tres campos que necesita el formulario HTML de Redsys:
 *  - Ds_SignatureVersion
 *  - Ds_MerchantParameters  (JSON → Base64)
 *  - Ds_Signature
 */
function buildRedsysRequest({
  secretKey,
  merchantCode,
  terminal,
  order,
  amount,        // en céntimos, p.ej. 1999 para 19,99 €
  currency = "978",
  transactionType = "0",
  urlOK,
  urlKO,
  urlNotification,
  merchantName = "Compralo24",
  productDescription = "Pedido online",
}) {
  const params = {
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_AMOUNT: String(amount),
    DS_MERCHANT_CURRENCY: currency,
    DS_MERCHANT_TRANSACTIONTYPE: transactionType,
    DS_MERCHANT_MERCHANTURL: urlNotification,
    DS_MERCHANT_URLOK: urlOK,
    DS_MERCHANT_URLKO: urlKO,
    DS_MERCHANT_MERCHANTNAME: merchantName,
    DS_MERCHANT_PRODUCTDESCRIPTION: productDescription,
    DS_MERCHANT_CONSUMERLANGUAGE: "002", // Español
  };

  const paramsBase64 = Buffer.from(JSON.stringify(params)).toString("base64");
  const signature = createSignature(secretKey, order, paramsBase64);

  return {
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: paramsBase64,
    Ds_Signature: signature,
  };
}

/**
 * Verifica la firma de la notificación recibida desde Redsys.
 * Redsys envía Ds_MerchantParameters, Ds_Signature y Ds_SignatureVersion.
 */
function verifyRedsysNotification(secretKey, merchantParameters, receivedSignature) {
  try {
    const decoded = JSON.parse(
      Buffer.from(merchantParameters, "base64").toString("utf8")
    );
    const order = decoded.Ds_Order || decoded.DS_ORDER;
    if (!order) return { valid: false, data: null };

    const expectedSignature = createSignature(secretKey, order, merchantParameters);

    // Comparación segura (evita timing attacks)
    const expected = Buffer.from(expectedSignature, "base64");
    const received = Buffer.from(
      receivedSignature.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );

    const valid =
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received);

    return { valid, data: decoded };
  } catch (e) {
    return { valid: false, data: null };
  }
}

/**
 * Formatea el número de pedido según las reglas de Redsys:
 * - Entre 4 y 12 caracteres
 * - Debe empezar por 4 dígitos numéricos
 * - El resto puede ser alfanumérico
 */
function formatOrderNumber(rawOrder) {
  const clean = String(rawOrder).replace(/[^a-zA-Z0-9]/g, "");
  // Aseguramos que empieza con 4 dígitos
  const padded = clean.padStart(4, "0");
  return padded.substring(0, 12);
}

/**
 * Convierte un importe decimal (19.99) a céntimos enteros (1999).
 */
function toCents(amount) {
  return Math.round(parseFloat(amount) * 100);
}

module.exports = {
  REDSYS_URLS,
  buildRedsysRequest,
  verifyRedsysNotification,
  formatOrderNumber,
  toCents,
};
