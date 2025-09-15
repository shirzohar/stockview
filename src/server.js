// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

async function scrapeTaseWithPuppeteer(taseUrl) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.goto(taseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  try {
    await page.waitForFunction(() => /שווי\s*יחידה|%/.test((document.body.innerText || '').replace(/\s+/g, ' ')), { timeout: 20000 });
  } catch (_) {
    await new Promise((r) => setTimeout(r, 2000));
  }
  const result = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ');
    const priceRx = /שווי\s*יחידה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    const lastPriceRx = /שער\s*אחרון[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    const openRx = /שער\s*פתיחה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    const changeDailyRx = /שינוי\s*יומי[^%\d]{0,20}([+-]?\d+(?:\.\d+)?)%/;
    const changeGenericRx = /שינוי[^%\d]{0,20}([+-]?\d+(?:\.\d+)?)%/;
    let priceMatch = text.match(lastPriceRx) || text.match(priceRx) || text.match(openRx);
    let percentMatch = text.match(changeDailyRx) || text.match(changeGenericRx) || text.match(/([+-]?\d+(?:\.\d+)?)%/);
    const priceAgorot = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10) : null;
    const currentPrice = priceAgorot !== null ? priceAgorot : null; // החזרה באגורות
    const changePercent = percentMatch ? parseFloat(percentMatch[1]) : null;
    return { currentPrice, changePercent, _debugSample: text.slice(0, 800) };
  });
  await browser.close();
  return result;
}

async function scrapeTaseFallbackWithAxios(taseUrl) {
  const { data } = await axios.get(taseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    timeout: 12000
  });
  const $ = cheerio.load(typeof data === 'string' ? data : '');
  const fullText = $('body').text().replace(/\s+/g, ' ');
  const priceMatch = fullText.match(/שווי\s*יחידה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/) || fullText.match(/שער\s*פתיחה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/);
  const percentMatch = fullText.match(/שינוי\s*יומי[^%\d]{0,20}([+-]?\d+(?:\.\d+)?)%/) || fullText.match(/([+-]?\d+(?:\.\d+)?)%/);
  const currentPrice = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10) : null;
  const changePercent = percentMatch ? parseFloat(percentMatch[1]) : null;
  return { currentPrice, changePercent, _debugSample: fullText.slice(0, 800) };
}

app.get('/api/israeli-stock/:id', async (req, res) => {
  const stockId = req.params.id;
  const taseUrl = `https://market.tase.co.il/he/market_data/security/${stockId}/major_data`;
  try {
    const result = await scrapeTaseWithPuppeteer(taseUrl);
    console.log(`TASE scrape ${stockId}:`, { currentPrice: result.currentPrice, changePercent: result.changePercent });
    return res.json({ currentPrice: result.currentPrice, changePercent: result.changePercent });
  } catch (err) {
    console.error('TASE puppeteer error:', err.message);
    try {
      const result = await scrapeTaseFallbackWithAxios(taseUrl);
      console.log(`TASE fallback ${stockId}:`, { currentPrice: result.currentPrice, changePercent: result.changePercent });
      return res.json({ currentPrice: result.currentPrice, changePercent: result.changePercent });
    } catch (e2) {
      console.error('TASE axios fallback error:', e2.message);
      return res.json({ currentPrice: null, changePercent: null });
    }
  }
});

// נתיב דיבאג להחזרת דוגמת טקסט מהדף (לעזור בכיול רג'קס)
app.get('/api/israeli-stock-debug/:id', async (req, res) => {
  const stockId = req.params.id;
  const taseUrl = `https://market.tase.co.il/he/market_data/security/${stockId}/major_data`;
  try {
    const result = await scrapeTaseWithPuppeteer(taseUrl);
    return res.json(result);
  } catch (err) {
    try {
      const result = await scrapeTaseFallbackWithAxios(taseUrl);
      return res.json(result);
    } catch (e2) {
      return res.json({ currentPrice: null, changePercent: null, _debugSample: null, error: e2.message });
    }
  }
});

app.listen(5000, () => {
  console.log('✅ Server running on http://localhost:5000');
});
