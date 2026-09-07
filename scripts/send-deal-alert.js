const { execFileSync } = require('node:child_process');

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL;
const senderName = process.env.BREVO_SENDER_NAME || 'BrightDeals';
const listId = Number(process.env.BREVO_ALERT_LIST_ID || '4');
const siteUrl = process.env.SITE_URL || 'https://brightdeals.github.io/';
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const targetCommit = process.env.ALERT_COMMIT || 'HEAD';
if (!/^(?:HEAD|[a-f0-9]{40})$/.test(targetCommit)) throw new Error('Invalid alert commit');
const diff = execFileSync('git', ['diff', '--unified=0', `${targetCommit}^`, targetCommit, '--', 'index.html'], { encoding: 'utf8' });
const previousHtml = execFileSync('git', ['show', `${targetCommit}^:index.html`], { encoding: 'utf8' });
const decodeHtml = (value) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const cardUrl = (card) => decodeHtml(card.match(/<a href="([^"]+)"/)?.[1] || siteUrl);
const previousUrls = new Set([...previousHtml.matchAll(/<article class="product-card">([\s\S]*?)<\/article>/g)].map((card) => cardUrl(card[1])));
const skipAsins = (process.env.SKIP_ASINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const addedLines = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n');
const cards = [...addedLines.matchAll(/<article class="product-card">([\s\S]*?)<\/article>/g)];

if (!cards.length) {
  console.log('No new product card was added; no deal alert was sent.');
  process.exit(0);
}

async function sendCard(latestCard) {
const title = latestCard.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || 'A new BrightDeals pick';
const productUrl = cardUrl(latestCard);
const imageUrl = decodeHtml(latestCard.match(/<img[^>]+src="([^"]+)"/)?.[1] || '');
const originalPrice = latestCard.match(/data-original-price="([^"]+)"/)?.[1] || '';
const salePrice = latestCard.match(/data-sale-price="([^"]+)"/)?.[1] || '';
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
  if (apiKey && senderEmail) {
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
      const priceLines = originalPrice && salePrice
        ? `\n\nOriginal price: ${originalPrice}\nNew price: ${salePrice}`
        : '';
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
  } else {
    console.log('Telegram alerts are not configured; skipped Telegram.');
  }
  await Promise.all(tasks);
}

(async () => {
  const sentUrls = new Set();
  for (const [, card] of cards) {
    const url = cardUrl(card);
    if (previousUrls.has(url) || sentUrls.has(url) || skipAsins.some((asin) => url.includes('/dp/' + asin))) continue;
    await sendCard(card);
    sentUrls.add(url);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
