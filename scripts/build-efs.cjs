const fs = require('fs');
const path = require('path');

const efsPath = path.join(__dirname, '../public/efs.html');
const efsDir = path.join(__dirname, '../public/efs');
const efsIndexPath = path.join(efsDir, 'index.html');

if (!fs.existsSync(efsPath)) {
  console.error('public/efs.html not found');
  process.exit(1);
}

let content = fs.readFileSync(efsPath, 'utf8');

const target = '        <!-- Minimal Heartbeat Status Indicator: AMHS -->';
const navHtml = `        <nav class="efs-top-nav" style="display: flex; gap: 6px; align-items: center; margin: 0 16px;">
          <a href="/" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #f1f5f9; text-decoration: none; border: 1px solid var(--outline); border-radius: 4px; background: rgba(255,255,255,0.08);">🏠 홈</a>
          <a href="/map" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #94a3b8; text-decoration: none; border: 1px solid var(--outline); border-radius: 4px; background: var(--surface-high);">🛰️ 관제 맵</a>
          <a href="/ifs" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #4ade80; text-decoration: none; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 4px; background: rgba(34, 197, 94, 0.1);">🖥️ IFS 단말</a>
          <a href="/api-dashboard" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #38bdf8; text-decoration: none; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 4px; background: rgba(56, 189, 248, 0.1);">📡 API 대시보드</a>
          <a href="/docs" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #c084fc; text-decoration: none; border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 4px; background: rgba(192, 132, 252, 0.1);">📖 API 명세</a>
          <a href="/swagger" class="nav-link-btn" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #38bdf8; text-decoration: none; border: 1px solid rgba(2, 132, 199, 0.4); border-radius: 4px; background: rgba(2, 132, 199, 0.15);">⚡ Swagger</a>
        </nav>\n\n`;

if (!content.includes('efs-top-nav') && content.includes(target)) {
  content = content.replace(target, navHtml + target);
  fs.writeFileSync(efsPath, content, 'utf8');
}

if (!fs.existsSync(efsDir)) fs.mkdirSync(efsDir, { recursive: true });
fs.writeFileSync(efsIndexPath, content, 'utf8');
console.log('Successfully synchronized public/efs.html and public/efs/index.html');
