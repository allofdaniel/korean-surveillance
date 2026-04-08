// Playwright script to intercept and save Navigraph resources
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/navigraph-analysis';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const interceptedResources = {};

  // Intercept network responses
  page.on('response', async (response) => {
    const url = response.url();

    // Capture sprite.json
    if (url.includes('sprite.json')) {
      console.log(`Intercepted: sprite.json`);
      const body = await response.text();
      fs.writeFileSync(path.join(OUTPUT_DIR, 'sprite.json'), body);
      interceptedResources['sprite.json'] = true;
    }

    // Capture sprite.png
    if (url.includes('sprite.png')) {
      console.log(`Intercepted: sprite.png`);
      const buffer = await response.body();
      fs.writeFileSync(path.join(OUTPUT_DIR, 'sprite.png'), buffer);
      interceptedResources['sprite.png'] = true;
    }

    // Capture style.json
    if (url.includes('style.json')) {
      console.log(`Intercepted: style.json`);
      const body = await response.text();
      fs.writeFileSync(path.join(OUTPUT_DIR, 'style.json'), body);
      interceptedResources['style.json'] = true;
    }

    // Capture chart images
    if (url.includes('/v2/charts/RKPU/')) {
      const match = url.match(/rkpu(\d+[a-z]?)_d\.png/);
      if (match) {
        const chartCode = match[1];
        console.log(`Intercepted: rkpu${chartCode}_d.png`);
        const buffer = await response.body();
        const chartDir = path.join(OUTPUT_DIR, '../tbas/charts');
        if (!fs.existsSync(chartDir)) {
          fs.mkdirSync(chartDir, { recursive: true });
        }
        fs.writeFileSync(path.join(chartDir, `rkpu${chartCode}_d.png`), buffer);
      }
    }
  });

  console.log('Navigating to Navigraph Charts...');
  await page.goto('https://charts.navigraph.com/airport/RKPU');

  console.log('Waiting for resources to load...');
  await page.waitForTimeout(10000);

  console.log('\nIntercepted resources:');
  console.log(JSON.stringify(interceptedResources, null, 2));

  console.log('\nPress Ctrl+C to exit...');
  await page.waitForTimeout(300000); // Wait 5 minutes

  await browser.close();
}

main().catch(console.error);
