# Redsys ↔ BigCommerce Gateway

Middleware desplegado en **Vercel** que conecta BigCommerce con el TPV Virtual de **Redsys** (HMAC SHA-256 v1).

---

## Arquitectura

```
Cliente (BigCommerce Checkout)
        │
        │  POST /api/create-payment  {orderId, amount}
        ▼
┌─────────────────────────────┐
│     Vercel (este proyecto)  │──── genera firma Redsys ────► TPV Virtual Redsys
│                             │◄─── notificación async ──────  (Ds_Notification)
└─────────────────────────────┘
        │
        │  PUT /v2/orders/:id  (actualiza estado del pedido)
        ▼
   BigCommerce API
```

## Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/create-payment` | POST | Recibe `{orderId, amount}`, genera la firma Redsys y devuelve HTML con auto-redirect al TPV |
| `/api/redsys-notify` | POST | Webhook asíncrono de Redsys. Verifica la firma y actualiza el pedido en BigCommerce |
| `/api/payment-ok` | GET | Página de éxito mostrada al cliente tras el pago |
| `/api/payment-ko` | GET | Página de error mostrada al cliente si el pago falla |
| `/api/health` | GET | **Diagnóstico**: verifica variables de entorno y conexión con BigCommerce |

---

## Despliegue paso a paso

### Paso 1 — Obtener el Store Hash de BigCommerce

El Store Hash es el identificador único de tu tienda. Puedes encontrarlo de dos formas:

**Opción A** — Desde la URL del panel de administración:
```
https://store-XXXXXXXX.mybigcommerce.com/manage/
                ^^^^^^^^
          Este es tu Store Hash
```

**Opción B** — Desde la sección de API Keys:
1. Ve a **BigCommerce Admin → Configuración → API → Claves y aplicaciones de la API**
2. Haz clic en la clave que ya tienes creada
3. La "Ruta de la API" tiene este formato:
   ```
   https://api.bigcommerce.com/stores/XXXXXXXX/v2/
                                      ^^^^^^^^
                                  Store Hash aquí
   ```

---

### Paso 2 — Subir el proyecto a GitHub

```bash
cd redsys-bigcommerce
git init
git add .
git commit -m "Initial commit: Redsys BigCommerce gateway"
git remote add origin https://github.com/TU_USUARIO/redsys-bigcommerce.git
git push -u origin main
```

---

### Paso 3 — Importar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa el repositorio de GitHub
3. **NO hagas Deploy todavía** — primero configura las variables de entorno

---

### Paso 4 — Variables de entorno en Vercel

En **Project Settings → Environment Variables**, añade estas variables:

| Variable | Valor |
|---|---|
| `REDSYS_MERCHANT_CODE` | `370221459` |
| `REDSYS_TERMINAL` | `001` |
| `REDSYS_SECRET_KEY` | `sq7HjrUOBfKmC576ILgskD5srU870gJ7` |
| `REDSYS_ENVIRONMENT` | `test` |
| `BASE_URL` | `https://TU-PROYECTO.vercel.app` *(actualiza tras el primer deploy)* |
| `STORE_URL` | `https://compralo24.com` |
| `BC_STORE_HASH` | `28gf5jpl7l` |
| `BC_CLIENT_ID` | `gu6pd6n3rqitvkmkiu1cb3xo26us1v` |
| `BC_ACCESS_TOKEN` | `qej3gcgailbxc7udc93jfeaf0fu6ghz` |

> ⚠️ **BASE_URL**: Haz un primer deploy, copia la URL que te da Vercel (ej: `https://redsys-abc123.vercel.app`), actualiza `BASE_URL` con ese valor y vuelve a hacer deploy.

---

### Paso 5 — Deploy

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

### Paso 6 — Verificar que todo funciona

Abre en el navegador:
```
https://TU-PROYECTO.vercel.app/api/health
```

Verás un panel de diagnóstico con el estado de cada variable y la conexión con BigCommerce.

---

### Paso 7 — Añadir el script al checkout de BigCommerce

1. Ve a **BigCommerce Admin → Storefront → Script Manager**
2. **Crear un script** con esta configuración:

| Campo | Valor |
|---|---|
| Nombre | `Redsys Payment Gateway` |
| Ubicación en la página | `Footer` |
| Seleccionar páginas | `Checkout` |
| Tipo de script | `Script` |

3. Pega el contenido completo del archivo `bigcommerce-script/checkout-redsys.js`
4. **Cambia la línea 14** con tu URL real de Vercel:
   ```javascript
   var GATEWAY_URL = "https://TU-PROYECTO.vercel.app"; // ← pon tu URL aquí
   ```
5. Guarda el script

---

## Tarjetas de prueba Redsys

| Tarjeta | Resultado |
|---|---|
| `4548 8121 0300 0003` | ✅ Aprobado (Visa) |
| `5526 0600 0000 0006` | ✅ Aprobado (Mastercard) |

- CVV: cualquier 3 dígitos · Caducidad: cualquier fecha futura
- PIN 3DS: `123456`

---

## Paso a producción

Cuando Redsys te proporcione las credenciales de producción, solo cambia **2 variables** en Vercel:

1. `REDSYS_ENVIRONMENT` → `production`
2. `REDSYS_SECRET_KEY` → la nueva clave de producción

```bash
vercel --prod
```

---

## Flujo completo de un pago

```
1. Cliente llega al checkout de BigCommerce
2. Script Manager inyecta el botón "Pagar con tarjeta"
3. Cliente hace clic → se llama a POST /api/create-payment {orderId, amount}
4. Vercel genera la firma HMAC-SHA256 → devuelve HTML con formulario auto-submit
5. Navegador redirige al TPV Virtual de Redsys (dominio seguro del banco)
6. Cliente introduce datos de tarjeta
7. Redsys notifica el resultado a POST /api/redsys-notify (servidor a servidor)
8. Vercel verifica la firma → actualiza pedido en BigCommerce via API
9. Redsys redirige al cliente a /api/payment-ok o /api/payment-ko
```

---

## Estructura del proyecto

```
├── api/
│   ├── create-payment.js    # Genera la firma y redirige al TPV
│   ├── redsys-notify.js     # Webhook de notificación de Redsys
│   ├── payment-ok.js        # Página de pago exitoso
│   ├── payment-ko.js        # Página de pago fallido
│   └── health.js            # Diagnóstico del sistema
├── lib/
│   ├── redsys.js            # Firma HMAC-SHA256, utilidades Redsys
│   └── bigcommerce.js       # Cliente de la API de BigCommerce
├── bigcommerce-script/
│   └── checkout-redsys.js   # Script para inyectar en el checkout de BC
├── .env.example             # Plantilla de variables de entorno
├── vercel.json              # Configuración de Vercel
└── package.json
```
