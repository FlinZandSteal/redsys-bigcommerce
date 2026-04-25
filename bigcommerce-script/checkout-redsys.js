(function () {
  "use strict";

  // 🔧 IMPORTANTE: sin slash final
  var GATEWAY_URL = "https://redsys-bigcommerce.vercel.app";

  function log(msg) {
    console.log("[Redsys Gateway]", msg);
  }

  function getCheckoutToken() {
    if (window.checkoutConfig && window.checkoutConfig.checkoutId) {
      return window.checkoutConfig.checkoutId;
    }
    var match = window.location.pathname.match(/\/checkout\/([a-f0-9]+)/i);
    return match ? match[1] : null;
  }

  function getCurrentOrderId() {
    var match = window.location.pathname.match(/order-confirmation\/(\d+)/i);
    return match ? match[1] : null;
  }

  function injectPaymentButton() {
    if (document.getElementById("redsys-pay-btn")) return;

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
      setTimeout(injectPaymentButton, 1000);
      return;
    }

    var wrapper = document.createElement("div");
    wrapper.id = "redsys-payment-wrapper";
    wrapper.style.cssText = "margin:16px 0;padding:16px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;";

    var btn = document.createElement("button");
    btn.id = "redsys-pay-btn";
    btn.type = "button";
    btn.textContent = "Pagar con tarjeta";
    btn.style.cssText = "width:100%;padding:14px;background:#1a73e8;color:#fff;border:none;border-radius:6px;cursor:pointer;";

    wrapper.appendChild(btn);
    container.parentNode.insertBefore(wrapper, container.nextSibling);

    btn.addEventListener("click", function () {
      handleRedsysPayment(btn);
    });
  }

  // ✅ FUNCIÓN NUEVA
  async function handleRedsysPayment(btn) {
    btn.disabled = true;
    btn.textContent = "Conectando con el banco...";

    try {
      var checkoutData = await fetchCurrentCheckout();
      if (!checkoutData) throw new Error("No se pudo obtener el checkout activo");

      var response = await fetch(GATEWAY_URL + "/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutData.orderId,
          amount: checkoutData.grandTotal,
          currency: checkoutData.currency,
          description: "Pedido compralo24"
        }),
      });

      if (!response.ok) throw new Error("Error del servidor: " + response.status);

      var data = await response.json();

      // 🔥 Crear formulario dinámico
      var form = document.createElement("form");
      form.method = "POST";
      form.action = data.redsysUrl;
      form.style.display = "none";

      var fields = {
        Ds_SignatureVersion:   data.Ds_SignatureVersion,
        Ds_MerchantParameters: data.Ds_MerchantParameters,
        Ds_Signature:          data.Ds_Signature
      };

      Object.keys(fields).forEach(function(key) {
        var input = document.createElement("input");
        input.type  = "hidden";
        input.name  = key;
        input.value = fields[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

    } catch (error) {
      log("Error: " + error.message);
      btn.disabled = false;
      btn.textContent = "Pagar con tarjeta";
      alert("Error al conectar con el banco: " + error.message);
    }
  }

  async function fetchCurrentCheckout() {
    try {
      var res = await fetch("/api/storefront/checkout", {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return null;

      var data = await res.json();
      if (!data || !data.id) return null;

      return {
        checkoutId: data.id,
        orderId: data.orderId || data.id,
        grandTotal: data.grandTotal || data.cartAmount || 0,
        currency: "978",
      };
    } catch (e) {
      return null;
    }
  }

  function init() {
    if (window.location.pathname.indexOf("/checkout") === -1) return;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(injectPaymentButton, 500);
      });
    } else {
      setTimeout(injectPaymentButton, 500);
    }
  }

  init();
})();
