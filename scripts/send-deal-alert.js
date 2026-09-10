const { execFileSync } = require('node:child_process');

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL;
const senderName = process.env.BREVO_SENDER_NAME || 'BrightDeals';
const listId = Number(process.env.BREVO_ALERT_LIST_ID || '4');
const emailPublishingEnabled = process.env.EMAIL_PUBLISHING_ENABLED === 'true';
const siteUrl = process.env.SITE_URL || 'https://brightdeals.github.io/';
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const facebookPageId = process.env.FACEBOOK_PAGE_ID;
const facebookToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const facebookPublishingEnabled = process.env.FACEBOOK_PUBLISHING_ENABLED === 'true';
const publishAllProducts = process.env.PUBLISH_ALL_PRODUCTS === 'true';

const targetCommit = process.env.ALERT_COMMIT || 'HEAD';
if (!/^(?:HEAD|[a-f0-9]{40})$/.test(targetCommit)) throw new Error('Invalid alert commit');
const diff = execFileSync('git', ['diff', '--unified=0', `${targetCommit}^`, targetCommit, '--', 'index.html'], { encoding: 'utf8' });
const previousHtml = execFileSync('git', ['show', `${targetCommit}^:index.html`], { encoding: 'utf8' });
const targetHtml = execFileSync('git', ['show', `${targetCommit}:index.html`], { encoding: 'utf8' });
const decodeHtml = (value) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const cardUrl = (card) => decodeHtml(card.match(/<a href="([^"]+)"/)?.[1] || siteUrl);
const productCardPattern = /<article class="product-card"[^>]*>([\s\S]*?)<\/article>/g;
const textOnly = (value) => decodeHtml(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
const priceFromAttribute = (card, name) => card.match(new RegExp(`${name}="([^"]+)"`))?.[1] || '';
const priceDetails = (card) => {
  const originalPrice = priceFromAttribute(card, 'data-original-price') || textOnly(card.match(/<s>([\s\S]*?)<\/s>/)?.[1] || '');
  const salePrice = priceFromAttribute(card, 'data-sale-price') || textOnly(card.match(/<div class="final-price">[\s\S]*?<strong>([\s\S]*?)<\/strong>/)?.[1] || '');
  if (!originalPrice || !salePrice) {
    throw new Error('Every new product card needs data-original-price and data-sale-price before it can be posted to Telegram or Facebook.');
  }
  return { originalPrice, salePrice };
};
const previousUrls = new Set([...previousHtml.matchAll(productCardPattern)].map((card) => cardUrl(card[1])));
const skipAsins = (process.env.SKIP_ASINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const addedLines = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n');
const cards = publishAllProducts
  ? [...targetHtml.matchAll(productCardPattern)]
  : [...addedLines.matchAll(productCardPattern)];

if (!cards.length) {
  console.log(publishAllProducts ? 'No product cards were found; no deal alert was sent.' : 'No new product card was added; no deal alert was sent.');
  process.exit(0);
}

async function sendCard(latestCard) {
const title = latestCard.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || 'A new BrightDeals pick';
const productUrl = cardUrl(latestCard);
const imageUrl = decodeHtml(latestCard.match(/<img[^>]+src="([^"]+)"/)?.[1] || '');
const { originalPrice, salePrice } = priceDetails(latestCard);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const safeTitle = escapeHtml(title);
const safeProductUrl = escapeHtml(productUrl);

const campaign = {
  name: `Deal alert — ${title}`,
  subject: `New deal drop: ${title}`,
  sender: { name: senderName, email: senderEmail },
  replyTo: senderEmail,
  type: 'classic',
  recipients: { listIds: [listId] },
  htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#4a3042"><p style="font-size:12px;letter-spacing:1px;color:#e75480">BRIGHTDEALS ALERT</p><h1 style="font-size:28px">A new deal just dropped.</h1><h2 style="font-size:20px">${safeTitle}</h2><p>Tap below to see the current price and details on Amazon. Prices and availability can change.</p><p><a href="${safeProductUrl}" style="display:inline-block;background:#e75480;color:#ffffff;padding:14px 20px;text-decoration:none;font-weight:bold">View the deal →</a></p><p style="font-size:12px;color:#806878">You received this because you subscribed to BrightDeals instant deal alerts. You can unsubscribe at any time.</p></body></html>`,
};

async function request(path, options = {}) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    ...options,
    headers: { 'api-key': apiKey, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Brevo API error ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

  const tasks = [];
  if (emailPublishingEnabled && apiKey && senderEmail) {
    tasks.push((async () => {
      const created = await request('/emailCampaigns', { method: 'POST', body: JSON.stringify(campaign) });
      await request(`/emailCampaigns/${created.id}/sendNow`, { method: 'POST' });
      console.log(`Sent instant email deal alert campaign ${created.id} for ${title}.`);
    })());
  } else {
    console.log('Brevo email alerts are not configured; skipped email.');
  }
  if (telegramToken && telegramChatId) {
    tasks.push((async () => {
      const priceLines = originalPrice === salePrice
        ? `\n\nCurrent price: ${salePrice}`
        : `\n\nOriginal price: ${originalPrice}\nDiscounted price: ${salePrice}`;
      const message = `✨ New BrightDeals drop!\n\n${title}${priceLines}\n\nView the deal: ${productUrl}\n\n#ad`;
      const method = imageUrl ? 'sendPhoto' : 'sendMessage';
      const body = imageUrl
        ? { chat_id: telegramChatId, photo: imageUrl, caption: message }
        : { chat_id: telegramChatId, text: message, disable_web_page_preview: false };
      let response = await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok && imageUrl) {
        console.warn(`Telegram could not load the product image for ${title}; sending the text alert instead.`);
        response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: message, disable_web_page_preview: false }),
        });
      }
      if (!response.ok) throw new Error(`Telegram API error ${response.status}: ${await response.text()}`);
      console.log(`Sent Telegram deal alert${imageUrl ? ' with product image' : ''} for ${title}.`);
    })());
  } else if (!emailPublishingEnabled) {
    console.log('Email alerts are disabled for this run; skipped email.');
  } else {
    console.log('Telegram alerts are not configured; skipped Telegram.');
  }
  if (facebookPublishingEnabled && facebookPageId && facebookToken) {
    tasks.push((async () => {
      const priceLines = originalPrice === salePrice
        ? `\n\nCurrent price: ${salePrice}`
        : `\n\nOriginal price: ${originalPrice}\nDiscounted price: ${salePrice}`;
      const message = `✨ New BrightDeals drop!\n\n${title}${priceLines}\n\nSee the current price and details: ${productUrl}\n\n#ad`;
      const response = await fetch(`https://graph.facebook.com/v26.0/${facebookPageId}/feed`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message, link: productUrl, access_token: facebookToken }),
      });
      if (!response.ok) throw new Error(`Facebook Graph API error ${response.status}: ${await response.text()}`);
      const created = await response.json();
      console.log(`Published Facebook deal alert ${created.id || ''} for ${title}.`);
    })());
  } else if (facebookToken && facebookPageId) {
    console.log('Facebook deal alerts are connected but disabled; skipped Facebook.');
  } else {
    console.log('Facebook deal alerts are not configured; skipped Facebook.');
  }
  await Promise.all(tasks);
}

(async () => {
  if (publishAllProducts) console.log(`Publishing ${cards.length} listed products to the selected channels.`);
  const sentUrls = new Set();
  for (const [, card] of cards) {
    const url = cardUrl(card);
    if ((!publishAllProducts && previousUrls.has(url)) || sentUrls.has(url) || skipAsins.some((asin) => url.includes('/dp/' + asin))) continue;
    await sendCard(card);
    sentUrls.add(url);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
