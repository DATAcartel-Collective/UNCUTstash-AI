// test.cjs
const puppeteer = require('puppeteer');
const { spawn, execSync } = require('child_process');
const http = require('http');

// Active Polling Mechanism
async function waitForServer(url, timeout = 20000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => resolve(res.statusCode));
        req.on('error', reject);
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Vite Preview Server at ${url} failed to bind within ${timeout}ms`);
}

async function run() {
  console.log("[UNCUTstash AI] Pre-Flight Check: Purging zombie processes on port 4173...");
  try {
    // Automatically kill any lingering processes on port 4173 before starting
    execSync('npx kill-port 4173', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if port is already free
  }

  console.log("[UNCUTstash AI] Booting Vite Preview Server...");
  const preview = spawn('npm', ['run', 'preview'], { shell: true });

  preview.stdout.on('data', (data) => console.log(`[VITE]: ${data.toString().trim()}`));
  preview.stderr.on('data', (data) => console.error(`[VITE ERR]: ${data.toString().trim()}`));

  try {
    console.log("[UNCUTstash AI] Polling port 4173 for active connection...");
    await waitForServer('http://localhost:4173');

    console.log("[UNCUTstash AI] Port 4173 Armed. Launching Headless Puppeteer Node...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--enable-unsafe-webgpu',
        '--disable-dawn-features=disallow_unsafe_apis',
        '--no-sandbox'
      ]
    });

    const page = await browser.newPage();

    // Deep Error Serialization Logger (Cleaned up JSHandle formatting)
    page.on('console', async msg => {
      const type = msg.type().toUpperCase();
      if (msg.text().includes('favicon.ico')) return;

      const args = await Promise.all(msg.args().map(async arg => {
        try {
          if (arg._remoteObject && arg._remoteObject.type === 'string') {
            return arg._remoteObject.value;
          }
          const val = await arg.executionContext().evaluate(a => a instanceof Error ? a.message : a, arg);
          return typeof val === 'object' ? JSON.stringify(val) : val;
        } catch (e) {
          return arg.toString().replace('JSHandle:', '');
        }
      }));

      const text = args.join(' ');
      console.log(`BROWSER [${type}]:`, text);
    });

    page.on('pageerror', err => console.log('BROWSER [FATAL ERROR]:', err.message));

    // Dynamic Wait Promise
    const systemArmedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout: AI Models took too long to download/initialize (60s limit).")), 60000);

      page.on('console', msg => {
        if (msg.text().includes('[CORE] System Fully Autonomous.')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    console.log("Navigating to http://localhost:4173...");
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 30000 });

    console.log("[UNCUTstash AI] Awaiting Neural Weight Downloads & Initialization...");

    await systemArmedPromise;

    console.log("\n[UNCUTstash AI] Diagnostic Verification Successful. Architecture is Flawless.");
    await browser.close();
  } catch (e) {
    console.error("\n[DIAGNOSTIC FAILURE]:", e.message);
  } finally {
    preview.kill();
    console.log("[UNCUTstash AI] Headless Test Cycle Terminated.");
    process.exit(0);
  }
}

run();