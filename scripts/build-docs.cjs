const fs = require('fs');

const docsJs = fs.readFileSync('api/docs.js', 'utf8');
const startIdx = docsJs.indexOf('<!DOCTYPE html>');
const endIdx = docsJs.indexOf('</html>`;');

if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to locate HTML in api/docs.js');
  process.exit(1);
}

let html = docsJs.substring(startIdx, endIdx + 7);

const oldNav = `<div class="header-links">
      <a href="/api-dashboard" class="btn-link btn-cyan">실시간 대시보드</a>
      <a href="/openapi.json" target="_blank" class="btn-link">OpenAPI JSON</a>
      <a href="/" class="btn-link">관제 맵</a>
    </div>`;

const newNav = `<nav class="header-links" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
      <a href="/" class="btn-link">🏠 홈</a>
      <a href="/map" class="btn-link">🛰️ 관제 맵</a>
      <a href="/ifs" class="btn-link">🖥️ IFS 단말</a>
      <a href="/efs" class="btn-link">📋 EFS 스트립</a>
      <a href="/api-dashboard" class="btn-link">📡 API 대시보드</a>
      <a href="/docs" class="btn-link btn-cyan" style="background:rgba(6,182,212,0.2); border-color:#0284c7; color:#38bdf8;">📖 API 문서</a>
      <a href="/swagger" class="btn-link">⚡ Swagger UI</a>
      <a href="/openapi.json" target="_blank" class="btn-link">📄 OpenAPI JSON</a>
    </nav>`;

html = html.replace(oldNav, newNav);

fs.writeFileSync('public/docs.html', html, 'utf8');
console.log('Successfully written public/docs.html, size:', fs.statSync('public/docs.html').size);
