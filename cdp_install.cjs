const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/12');
let id = 1;

ws.on('open', () => {
  console.log('Connected to Chrome DevTools');
  ws.send(JSON.stringify({id: id++, method: 'Page.getAppManifest'}));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Response id:', msg.id, 'method:', msg.method || '');

  if (msg.method) return; // Skip events

  if (msg.id === 1) {
    if (msg.result && msg.result.url) {
      console.log('Manifest URL:', msg.result.url);
    } else {
      console.log('No manifest found:', JSON.stringify(msg.result));
    }
    ws.send(JSON.stringify({id: id++, method: 'Page.getInstallabilityErrors'}));
  } else if (msg.id === 2) {
    console.log('Installability:', JSON.stringify(msg.result));
    ws.send(JSON.stringify({
      id: id++,
      method: 'Runtime.evaluate',
      params: {
        expression: 'navigator.serviceWorker.controller ? "SW active" : "No SW"',
        returnByValue: true
      }
    }));
  } else if (msg.id === 3) {
    console.log('SW status:', msg.result && msg.result.result && msg.result.result.value);
    // Try to trigger install prompt
    ws.send(JSON.stringify({
      id: id++,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (async () => {
            try {
              // Try triggering beforeinstallprompt
              const event = new Event('beforeinstallprompt');
              window.dispatchEvent(event);
              return 'dispatched beforeinstallprompt';
            } catch(e) {
              return 'error: ' + e.message;
            }
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      }
    }));
  } else if (msg.id === 4) {
    console.log('Prompt result:', msg.result && msg.result.result && msg.result.result.value);
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout - no response');
  ws.close();
  process.exit(0);
}, 10000);
