// Cloudflare Worker - Proxy pump.fun and strip X-Frame-Options
// Deploy this at: https://workers.cloudflare.com

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Rewrite the URL to pump.fun
  const targetUrl = 'https://pump.fun' + url.pathname + url.search
  
  // Clone the request with the new URL
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  })
  
  // Fetch from pump.fun
  const response = await fetch(modifiedRequest)
  
  // Clone the response and modify headers
  const modifiedResponse = new Response(response.body, response)
  
  // Remove headers that block iframing
  modifiedResponse.headers.delete('X-Frame-Options')
  modifiedResponse.headers.delete('Content-Security-Policy')
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*')
  
  return modifiedResponse
}
