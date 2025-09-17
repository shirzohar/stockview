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
    // Normalize Unicode minus (U+2212) to ASCII '-', remove bidi/control chars
    const normalizeText = (t) => (t || '')
      .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/\s+/g, ' ');

    const parsePercentToken = (token) => {
      if (!token) return null;
      const s = token.replace(/[\u2212\u2012\u2013\u2014]/g, '-');
      // Detect minus anywhere (prefix or suffix or inside parentheses)
      const isNegative = /-/.test(s) || /\(\s*\d/.test(s) && /\)/.test(s) && /-/.test(s);
      // Extract numeric part
      const numMatch = s.match(/\d+(?:\.\d+)?/);
      if (!numMatch) return null;
      const val = parseFloat(numMatch[0]);
      return isNegative ? -val : val;
    };

    const text = normalizeText(document.body.innerText || '');
    const priceRx = /שווי\s*יחידה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    const lastPriceRx = /שער\s*אחרון[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    const openRx = /שער\s*פתיחה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/;
    // Capture flexible percent token (handles trailing minus and parentheses)
    const percentToken = '([()\\-\\u2212\\d.\u2012\u2013\u2014\u200E\u200F]+?)';
    const changeDailyRx = new RegExp(`שינוי\\s*יומי[^%]{0,30}${percentToken}%`);
    const anyPercentRx = new RegExp(`${percentToken}%`);

    let priceMatch = text.match(lastPriceRx) || text.match(priceRx) || text.match(openRx);
    let percentMatch = text.match(changeDailyRx) || text.match(anyPercentRx);

    const priceAgorot = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10) : null;
    const currentPrice = priceAgorot !== null ? priceAgorot : null; // return in agorot
    const rawToken = percentMatch ? percentMatch[1] : null;
    // find context around token for debugging (not returned to client, only for server log)
    let context = null;
    if (percentMatch && percentMatch.index !== undefined) {
      const start = Math.max(0, percentMatch.index - 40);
      const end = Math.min(text.length, percentMatch.index + (percentMatch[0] ? percentMatch[0].length : 0) + 40);
      context = text.slice(start, end);
    }
    let changePercent = percentMatch ? parsePercentToken(rawToken) : null;

    // Heuristic: if no explicit minus parsed but DOM styling suggests negative, flip sign
    if (changePercent !== null && changePercent > 0 && rawToken && !/-/.test(rawToken)) {
      try {
        const needle = (rawToken + '%').replace(/\s+/g, '');
        const candidates = Array.from(document.querySelectorAll('*'))
          .filter(el => el.childElementCount === 0 && /%/.test(el.textContent || ''))
          .map(el => ({ el, txt: (el.textContent || '').replace(/\s+/g, '') }))
          .filter(item => item.txt.includes(needle));
        const looksNegative = (el) => {
          const cs = window.getComputedStyle(el);
          const color = (cs && cs.color || '').toLowerCase();
          const cls = (el.className || '').toString().toLowerCase();
          const title = (el.getAttribute('title') || '').toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const text = (el.textContent || '').toLowerCase();
          const negWord = /(ירידה|שלילי|minus|neg|down|ירד|אדום)/.test(cls + ' ' + title + ' ' + aria + ' ' + text);
          const redish = /rgb\(\s*(1?5\d|2[0-5]\d)\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/.test(color) || /#(d[0-9a-f]{5}|c[0-9a-f]{5})/.test(color);
          return negWord || redish;
        };
        const negByStyle = candidates.some(c => looksNegative(c.el) || (c.el.parentElement && looksNegative(c.el.parentElement)));
        if (negByStyle) {
          changePercent = -Math.abs(changePercent);
        }
      } catch (_) {}
    }

    return { currentPrice, changePercent };
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
  const normalizeText = (t) => (t || '')
    .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ');
  const fullText = normalizeText($('body').text());
  const priceMatch = fullText.match(/שווי\s*יחידה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/) || fullText.match(/שער\s*פתיחה[^\d]{0,50}(\d{2,3}[\s,]?\d{3})/);
  const percentToken = '([()\\-\\u2212\\d.\u2012\u2013\u2014\u200E\u200F]+?)';
  const percentMatch = fullText.match(new RegExp(`שינוי\\s*יומי[^%]{0,30}${percentToken}%`)) || fullText.match(new RegExp(`${percentToken}%`));
  const currentPrice = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10) : null;
  const parsePercentToken = (token) => {
    if (!token) return null;
    const s = token.replace(/[\u2212\u2012\u2013\u2014]/g, '-');
    // negative if any '-' exists OR parentheses contain a number with optional '-'
    const isNegative = /-/.test(s) || /\(\s*-?\d/.test(s) && /\)/.test(s);
    const numMatch = s.match(/\d+(?:\.\d+)?/);
    if (!numMatch) return null;
    const val = parseFloat(numMatch[0]);
    return isNegative ? -val : val;
  };
  const rawToken = percentMatch ? percentMatch[1] : null;
  const changePercent = percentMatch ? parsePercentToken(rawToken) : null;
  // include raw for server-side log only
  return { currentPrice, changePercent, _rawPercentToken: rawToken };
}

app.get('/api/israeli-stock/:id', async (req, res) => {
  const stockId = req.params.id;
  const taseUrl = `https://market.tase.co.il/he/market_data/security/${stockId}/major_data`;
  try {
    const result = await scrapeTaseWithPuppeteer(taseUrl);
    return res.json({ currentPrice: result.currentPrice, changePercent: result.changePercent });
  } catch (err) {
    try {
      const result = await scrapeTaseFallbackWithAxios(taseUrl);
      return res.json({ currentPrice: result.currentPrice, changePercent: result.changePercent });
    } catch (e2) {
      return res.json({ currentPrice: null, changePercent: null });
    }
  }
});

// נתיב דיבאג להחזרת דוגמת טקסט מהדף (לעזור בכיול רג'קס)
// Debug route removed by request

app.listen(5000, () => {
});
