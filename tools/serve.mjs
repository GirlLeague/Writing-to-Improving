#!/usr/bin/env node
/**
 * 零依赖静态服务器 —— `npm start` 即可本地预览。
 *
 * 本仓库刻意不引入任何 npm 包，所以没有 node_modules，也不需要 npm install。
 * 这个文件只用到 Node 内置的 http / fs / path 模块。
 *
 * 用法：
 *   npm start                        # http://localhost:8080
 *   node tools/serve.mjs 3000        # 指定端口
 *   PORT=3000 node tools/serve.mjs   # 用环境变量指定端口
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// path.resolve 会去掉 fileURLToPath 留下的尾部反斜杠，避免下面的前缀校验误判
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url))); // 仓库根目录
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const send = (res, status, body, headers = {}) => {
  res
    .writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers })
    .end(body);
};

createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, '400 Bad Request');
  }

  let target = normalize(join(ROOT, urlPath));
  // 防目录穿越：归一化后必须仍在仓库根目录内
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return send(res, 403, '403 Forbidden');
  }
  if (urlPath.endsWith('/')) target = join(target, 'index.html');

  try {
    const body = await readFile(target);
    res
      .writeHead(200, {
        'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      })
      .end(body);
  } catch {
    send(res, 404, `404 Not Found: ${urlPath}`);
  }
}).listen(PORT, () => {
  console.log(`海怪！海怪！  →  http://localhost:${PORT}/`);
  console.log(`静态根目录：${ROOT}`);
  console.log('Ctrl+C 停止服务');
});
