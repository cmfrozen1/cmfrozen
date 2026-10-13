/**
 * Middleware บล็อกไฟล์อ่อนไหวไม่ให้เข้าถึงผ่าน static
 * กัน wrangler.toml, .env, .wrangler เปิดเผย PASSWORD
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const p = url.pathname;
  if (
    p === '/wrangler.toml' ||
    p === '/_headers' ||
    p === '/_redirects' ||
    p.endsWith('.toml') ||
    p.startsWith('/.wrangler') ||
    p.startsWith('/.env') ||
    p.includes('wrangler.toml')
  ) {
    return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return context.next();
}
