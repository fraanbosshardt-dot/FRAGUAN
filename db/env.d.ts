declare namespace Cloudflare {
  interface Env {
    ONLINE_PAYMENT_WEBHOOK_SECRET?: string;
    MERCADO_PAGO_ACCESS_TOKEN?: string;
    MERCADO_PAGO_WEBHOOK_SECRET?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    RESEND_ORDER_TO?: string;
    CORREO_API_URL?: string;
    CORREO_API_USER?: string;
    CORREO_API_PASSWORD?: string;
    CORREO_CUSTOMER_ID?: string;
    CORREO_ORIGIN_POSTAL_CODE?: string;
    DB: D1Database;
    BOOTSTRAP_OWNER_EMAIL?: string;
    ADMIN_PIN?: string;
    SITE_ORIGIN?: string;
  }
}
