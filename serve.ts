// serve.ts — serve game/ on http://localhost:8080 for local play-testing.
// Node 22 stdlib only. Run:  node serve.ts [port]
// Serves only files under game/, never anything above it.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const gameDir = join(process.cwd(), 'game');
const port = Number(process.argv[2] || 8080);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = normalize(rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, ''));
  const filePath = join(gameDir, relPath);
  // Stay inside game/: a path that climbs out gets a 404, not a file.
  if (!filePath.startsWith(gameDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

server.listen(port, () => {
  console.log(`The Midnight Vault at http://localhost:${port}/`);
});
