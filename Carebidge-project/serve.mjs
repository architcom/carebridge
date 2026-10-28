import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const requestedPort = Number(process.env.PORT);
const ports = requestedPort ? [requestedPort] : [8000, 8123, 8124, 8125, 8126];
let portIndex = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.on('error', error => {
  if ((error.code === 'EADDRINUSE' || error.code === 'EACCES') && portIndex < ports.length - 1) {
    portIndex += 1;
    server.listen(ports[portIndex]);
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
server.on('listening', () => console.log(`Open http://localhost:${server.address().port}/login.html`));
server.listen(ports[portIndex]);
