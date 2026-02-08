const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const zlib = require('zlib');

const app = express();
const PORT = 3456;

// Enable CORS
app.use(cors());

// Anti-frame-busting script to inject
const INJECT_SCRIPT = `
<script>
  try {
    Object.defineProperty(window, 'top', { get: function() { return window.self; } });
    Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
    console.log('🔒 Pump.rekt: Frame protection neutralized');
  } catch(e) {}
</script>
`;

// Proxy config
const proxyConfig = {
  target: 'https://pump.fun',
  changeOrigin: true,
  secure: true,
  ws: true, // Proxy WebSockets
  selfHandleResponse: true, // Allow response modification
  onProxyRes: (proxyRes, req, res) => {
    // Strip blocking headers
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['frame-options'];
    
    // Allow all origins
    proxyRes.headers['access-control-allow-origin'] = '*';
    
    // Handle text/html responses to inject script
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
      let body = [];
      proxyRes.on('data', chunk => body.push(chunk));
      proxyRes.on('end', () => {
        let bodyBuffer = Buffer.concat(body);
        
        // Handle compression
        const encoding = proxyRes.headers['content-encoding'];
        try {
            if (encoding === 'gzip') {
            bodyBuffer = zlib.gunzipSync(bodyBuffer);
            } else if (encoding === 'deflate') {
            bodyBuffer = zlib.inflateSync(bodyBuffer);
            } else if (encoding === 'br') {
            bodyBuffer = zlib.brotliDecompressSync(bodyBuffer);
            }
        } catch (e) {
            console.error('Decompression error:', e);
            // If decompression fails, just send original buffer (might be broken but better than crashing)
        }

        let bodyString = bodyBuffer.toString('utf8');
        
        // Inject stealth script right after <head>
        bodyString = bodyString.replace('<head>', '<head>' + INJECT_SCRIPT);
        
        // Re-compress if needed (simplified: we just send uncompressed)
        res.removeHeader('content-encoding');
        res.removeHeader('content-length');
        res.set('content-type', 'text/html; charset=utf-8');
        // res.set('content-length', Buffer.byteLength(bodyString)); // Let express handle length
        
        res.status(proxyRes.statusCode);
        res.send(bodyString);
      });
    } else {
      // Pipe other content types directly
      res.status(proxyRes.statusCode);
      Object.keys(proxyRes.headers).forEach(key => {
        res.set(key, proxyRes.headers[key]);
      });
      proxyRes.pipe(res);
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy Error: ' + err.message);
  }
};

app.use('/', createProxyMiddleware(proxyConfig));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pump.fun Stealth Proxy running on http://0.0.0.0:${PORT}`);
});
