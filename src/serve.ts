/** Kleiner Vorschauserver für die lokale Kontrolle: `npm run serve`. */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { OUT_DIR } from './config.js';

const PORT = Number(process.env.PORT ?? 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
  // normalize() verhindert, dass "../" aus dem Ausgabeverzeichnis herausführt.
  const relative = normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(OUT_DIR, relative);

  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Nicht gefunden');
  }
}).listen(PORT, () => console.log(`Vorschau: http://localhost:${PORT}/`));
