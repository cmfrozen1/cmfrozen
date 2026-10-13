/**
 * Cloudflare Pages Function - mirror of worker.js for Pages deployment
 * Deploy via: npx wrangler pages deploy . --project-name=fukupetstore
 * This file re-exports the Worker logic for Pages Functions runtime.
 */
import worker from "../worker.js";

export async function onRequest(context) {
  // Pages Functions signature: { request, env, params, next }
  return worker.fetch(context.request, context.env, context);
}
