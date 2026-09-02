declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BOOTSTRAP_OWNER_EMAIL?: string;
    SITE_ORIGIN?: string;
  }
}
