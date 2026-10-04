// Node deployments read secrets from the hosting environment at runtime.
// The local Cloudflare build continues using its native worker bindings.
export const env = process.env;
