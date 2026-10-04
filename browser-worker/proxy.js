import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { webURL, resolvePublic } from './network.js';

// This proxy must never be exposed publicly. Production worker containers have
// no external route: this is their only path to the internet.
export function createEgressProxy() {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const url = webURL(req.url);
      if (url.protocol !== 'http:') throw new Error('Use CONNECT for TLS');
      const target = await resolvePublic(url.hostname);
      const headers = { ...req.headers, host: url.host };
      for (const key of ['proxy-authorization', 'proxy-connection', 'connection', 'upgrade']) delete headers[key];
      const upstream = http.request({ hostname: target.address, family: target.family, port: 80,
        method: req.method, path: url.pathname + url.search, headers, timeout: 20000 }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.on('timeout', () => upstream.destroy());
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    } catch { res.writeHead(403); res.end('Destination blocked'); }
  });
  server.on('connect', async (req, client, head) => {
    client.on('error', () => {});
    try {
      const url = webURL(`https://${req.url}`);
      if (url.port || !req.url.endsWith(':443')) throw new Error('Port blocked');
      const target = await resolvePublic(url.hostname);
      if (client.destroyed) return;
      const upstream = net.connect({ host: target.address, family: target.family, port: 443 });
      sockets.add(upstream);
      upstream.setTimeout(60000, () => upstream.destroy());
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream); upstream.pipe(client);
      });
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => { sockets.delete(upstream); client.destroy(); });
    } catch { client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  server.on('connection', socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.setTimeout(60000, () => socket.destroy());
  });
  server.shutdown = async () => { for (const socket of sockets) socket.destroy(); await new Promise(r => server.close(r)); };
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createEgressProxy().listen(Number(process.env.PROXY_PORT || 8091), process.env.PROXY_HOST || '127.0.0.1');
}
