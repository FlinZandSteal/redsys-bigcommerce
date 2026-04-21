// bigcommerce-script/checkout-redsys.js
//
// Script para inyectar en BigCommerce (Storefront Scripts o Script Manager).
// Se añade en: Tienda → Storefront → Script Manager → Añadir script
// Ubicación: "Checkout" | Tipo: "Script"
//
// Qué hace:
//   1. Detecta cuando el cliente llega a la página de pago en BigCommerce
//   2. Añade un botón "Pagar con tarjeta (Redsys)" en el checkout
//   3. Al pulsar, obtiene el pedido activo y lanza el endpoint /api/create-payment
//   4. El navegador es redirigido automáticamente al TPV Virtual de Redsys

(function () {
  "use strict";

  // ── Configuración ─────────────────────────────────────────────────────────
  // Cambia esta URL por la de tu despliegue en Vercel
  var GATEWAY_URL = "https://TU-PROYECTO.vercel.app";

  // ── Utilidades ────────────────────────────────────────────────────────────
  function log(msg) {
    console.log("[Redsys Gateway]", msg);
  }

  function getCheckoutToken() {
    // El token del checkout está en la URL: /checkout/order-confirmation/{token}
    // o en window.checkoutConfig si está disponible
    if (window.checkoutConfig && window.checkoutConfig.checkoutId) {
      return window.checkoutConfig.checkoutId;
    }
    var match = window.location.pathname.match(/\/checkout\/([a-f0-9]+)/i);
    return match ? match[1] : null;
  }

  function getCurrentOrderId() {
    // Intenta obtener el orderId desde la URL de confirmación
    var match = window.location.pathname.match(/order-confirmation\/(\d+)/i);
    return match ? match[1] : null;
  }

  // ── Inyección del botón de pago ───────────────────────────────────────────
  function injectPaymentButton() {
    // Evitar duplicados
    if (document.getElementById("redsys-pay-btn")) return;

    // Busca el contenedor de métodos de pago de BigCommerce
    var selectors = [
      ".checkout-step--payment .form-checklist",
      "[data-test='payment-list']",
      ".payment-form",
      "#checkout-payment-continue",
      ".checkout-form",
    ];

    var container = null;
    for (var i = 0; i < selectors.length; i++) {
      container = document.querySelector(selectors[i]);
      if (container) break;
    }

    if (!container) {
      log("No se encontró el contenedor de pago, reintentando...");
      setTimeout(injectPaymentButton, 1000);
      return;
    }

    log("Inyectando botón de pago Redsys");

    // Crear el wrapper
    var wrapper = document.createElement("div");
    wrapper.id = "redsys-payment-wrapper";
    wrapper.style.cssText = [
      "margin: 16px 0;",
      "padding: 16px;",
      "border: 1px solid #e0e0e0;",
      "border-radius: 8px;",
      "background: #fafafa;",
    ].join("");

    // Cabecera del método
    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px;";
    header.innerHTML = [
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2">',
      '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>',
      '<line x1="1" y1="10" x2="23" y2="10"/>',
      "</svg>",
      '<span style="font-weight:600;font-size:14px;color:#333;">Pago con tarjeta</span>',
      '<span style="margin-left:auto;font-size:12px;color:#888;">Redsys · TPV Seguro</span>',
    ].join("");

    // Botón principal
    var btn = document.createElement("button");
    btn.id = "redsys-pay-btn";
    btn.type = "button";
    btn.textContent = "Pagar con tarjeta";
    btn.style.cssText = [
      "width: 100%;",
      "padding: 14px 20px;",
      "background: #1a73e8;",
      "color: white;",
      "border: none;",
      "border-radius: 6px;",
      "font-size: 15px;",
      "font-weight: 600;",
      "cursor: pointer;",
      "transition: background 0.2s;",
      "display: flex;",
      "align-items: center;",
      "justify-content: center;",
      "gap: 8px;",
    ].join("");

    btn.addEventListener("mouseenter", function () {
      btn.style.background = "#1557b0";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.background = "#1a73e8";
    });

    // Icono de candado
    var lockIcon = document.createElement("span");
    lockIcon.innerHTML = [
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">',
      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>',
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      "</svg>",
    ].join("");

    btn.prepend(lockIcon);

    // Mensaje de seguridad
    var secureMsg = document.createElement("p");
    secureMsg.style.cssText = "font-size:11px;color:#888;margin-top:8px;text-align:center;";
    secureMsg.textContent = "Pago 100% seguro. Tus datos están cifrados y protegidos.";

    wrapper.appendChild(header);
    wrapper.appendChild(btn);
    wrapper.appendChild(secureMsg);
    container.parentNode.insertBefore(wrapper, container.nextSibling);

    // ── Click handler ──────────────────────────────────────────────────────
    btn.addEventListener("click", function () {
      handleRedsysPayment(btn);
    });
  }

  async function handleRedsysPayment(btn) {
    btn.disabled = true;
    btn.textContent = "Conectando con el banco...";

    try {
      // 1. Obtener datos del checkout activo de BigCommerce
      var checkoutData = await fetchCurrentCheckout();
      if (!checkoutData) {
        throw new Error("No se pudo obtener el checkout activo");
      }

      var orderId   = checkoutData.orderId;
      var amount    = checkoutData.grandTotal;
      var currency  = checkoutData.currency || "978";
      var description = "Pedido #" + orderId + " - Compralo24";

      log("Iniciando pago: orderId=" + orderId + ", amount=" + amount);

      // 2. Llamar al endpoint de Vercel para crear el pago en Redsys
      var response = await fetch(GATEWAY_URL + "/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount, currency, description }),
      });

      if (!response.ok) {
        throw new Error("Error del servidor: " + response.status);
      }

      // 3. El servidor devuelve un HTML con formulario auto-submit
      //    Lo inyectamos en un iframe invisible o reemplazamos el documento
      var html = await response.text();

      // Reemplazamos el documento actual con el HTML de redirección
      document.open();
      document.write(html);
      document.close();

    } catch (error) {
      log("Error al procesar el pago: " + error.message);
      btn.disabled = false;
      btn.textContent = "Pagar con tarjeta";
      showError("Ha ocurrido un error al conectar con el banco. Por favor, inténtalo de nuevo.");
    }
  }

  async function fetchCurrentCheckout() {
    try {
      // BigCommerce Storefront API - no requiere autenticación
      var res = await fetch("/api/storefront/checkout", {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return null;

      var data = await res.json();
      if (!data || !data.id) return null;

      // El grand total incluye impuestos y envío
      return {
        checkoutId: data.id,
        orderId: data.orderId || data.id,
        grandTotal: data.grandTotal || data.cartAmount || 0,
        currency: data.cart && data.cart.currency
          ? getCurrencyCode(data.cart.currency.code)
          : "978",
      };
    } catch (e) {
      log("Error obteniendo checkout: " + e.message);
      return null;
    }
  }

  function getCurrencyCode(isoCode) {
    var codes = { EUR: "978", USD: "840", GBP: "826" };
    return codes[isoCode] || "978";
  }

  function showError(msg) {
    var existing = document.getElementById("redsys-error-msg");
    if (existing) existing.remove();

    var err = document.createElement("div");
    err.id = "redsys-error-msg";
    err.style.cssText = [
      "margin-top: 10px;",
      "padding: 10px 14px;",
      "background: #fee2e2;",
      "border: 1px solid #fca5a5;",
      "border-radius: 6px;",
      "font-size: 13px;",
      "color: #dc2626;",
    ].join("");
    err.textContent = msg;

    var wrapper = document.getElementById("redsys-payment-wrapper");
    if (wrapper) wrapper.appendChild(err);
  }

  // ── Inicialización ────────────────────────────────────────────────────────
  function init() {
    // Solo actuar en la página de checkout
    var path = window.location.pathname;
    if (path.indexOf("/checkout") === -1) return;

    log("Página de checkout detectada");

    // Esperar a que el DOM del checkout esté listo
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(injectPaymentButton, 500);
      });
    } else {
      setTimeout(injectPaymentButton, 500);
    }

    // MutationObserver para SPAs donde el DOM cambia dinámicamente
    var observer = new MutationObserver(function (mutations) {
      if (!document.getElementById("redsys-pay-btn")) {
        var hasPaymentSection = mutations.some(function (m) {
          return Array.from(m.addedNodes).some(function (n) {
            return n.nodeType === 1 && (
              n.classList.contains("checkout-step--payment") ||
              n.querySelector && n.querySelector(".checkout-step--payment")
            );
          });
        });
        if (hasPaymentSection) {
          setTimeout(injectPaymentButton, 300);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
