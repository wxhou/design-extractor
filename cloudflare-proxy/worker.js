// Placeholder for future url2design.com cutover — swap Host/redirect rewrites when DNS is live.
const URL2DESIGN_HOST = 'url2design.com';
const VERCEL_URL = 'design-extractor-five.vercel.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = VERCEL_URL;
    url.protocol = 'https:';

    const headers = new Headers(request.headers);
    headers.set('Host', VERCEL_URL);
    headers.set('X-Forwarded-Host', VERCEL_URL);
    headers.delete('x-forwarded-proto');
    headers.delete('x-real-ip');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    });

    const response = await fetch(newRequest);

    // Handle redirects - rewrite Location header to proxy URL
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (location) {
        const newLocation = location
          .replace(`https://${VERCEL_URL}`, '')
          .replace(`http://${VERCEL_URL}`, '');
        const redirectResponse = new Response(null, {
          status: response.status,
          headers: { Location: newLocation },
        });
        return redirectResponse;
      }
    }

    const newResponse = new Response(response.body, response);
    newResponse.headers.delete('Content-Encoding');
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  },
};
