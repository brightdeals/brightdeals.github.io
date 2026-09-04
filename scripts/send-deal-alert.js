const { execFileSync } = require('node:child_process');

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL;
const senderName = process.env.BREVO_SENDER_NAME || 'BrightDeals';
const listId = Number(process.env.BREVO_ALERT_LIST_ID || '4');
const siteUrl = process.env.SITE_URL || 'https://brightdeals.github.io/';

if (!apiKey || !senderEmail) {
  console.log('Deal alerts are not configured yet; no email was sent.');
  process.exit(0);
}

const diff = execFileSync('git', ['diff', '--unified=0', 'HEAD^', 'HEAD', '--', 'index.html'], { encoding: 'utf8' });
const addedLines = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1)).join('\n');
const cards = [...addedLines.matchAll(/<article class="product-card">([\s\S]*?)<\/article>/g)];

if (!cards.length) {
  console.log('No new product card was added; no deal alert was sent.');
  process.exit(0);
}

const latestCard = cards.at(-1)[1];
const title = latestCard.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || 'A new BrightDeals pick';
const productUrl = latestCard.match(/<a href="([^"]+)"/)?.[1] || siteUrl;
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

(async () => {
  const created = await request('/emailCampaigns', { method: 'POST', body: JSON.stringify(campaign) });
  await request(`/emailCampaigns/${created.id}/sendNow`, { method: 'POST' });
  console.log(`Sent instant deal alert campaign ${created.id} for ${title}.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
