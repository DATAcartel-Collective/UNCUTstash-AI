// check.cjs
const { chromium } = require('playwright');

(async () => {
    console.log('[UNCUTstash AI] Initiating Playwright E2E Diagnostics...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Target the new Spatial UI status bar (text-accent-pink)
    const statusElements = await page.$$('.text-accent-pink.uppercase');
    if(statusElements.length > 0) {
        const status = await statusElements[0].textContent();
        console.log('SYSTEM STATUS:', status);
    }
    
    // Target the new James Bond Mode toggle to verify interaction
    await page.click('button:has-text("J-BOND MODE")').catch(e => console.log('Could not click Security Toggle:', e.message));
    await page.waitForTimeout(1000);
    
    const statusAfter = await page.$$('.text-accent-pink.uppercase');
    if(statusAfter.length > 0) {
        const statusTextAfter = await statusAfter[0].textContent();
        console.log('STATUS AFTER SECURITY TOGGLE:', statusTextAfter);
    }
    
    await browser.close();
    console.log('[UNCUTstash AI] Diagnostics Complete.');
})();