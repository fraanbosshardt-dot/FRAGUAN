declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BOOTSTRAP_OWNER_EMAIL?: string;
    ADMIN_PIN?: string;
    SITE_ORIGIN?: string;
  }
}
