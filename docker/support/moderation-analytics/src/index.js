const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { LRUCache } = require('lru-cache');

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = process.env.MAX_BODY || '256kb';

// Simple token bucket limiter (per userId/ip) to protect moderation endpoint
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 10_000);
const RATE_MAX_TOKENS = Number(process.env.RATE_MAX_TOKENS || 30);
const RATE_REFILL_PER_WINDOW = Number(process.env.RATE_REFILL_PER_WINDOW || 30);

const limiter = new LRUCache({ max: 50_000, ttl: RATE_WINDOW_MS * 6, ttlAutopurge: true });

function requestIdFrom(req) {
  return req.headers['x-request-id'] || crypto.randomBytes(12).toString('hex');
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip;
}

function takeToken(bucketKey) {
  const now = Date.now();
  const bucket = limiter.get(bucketKey) || { tokens: RATE_MAX_TOKENS, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  const windows = Math.floor(elapsed / RATE_WINDOW_MS);
  if (windows > 0) {
    bucket.tokens = Math.min(RATE_MAX_TOKENS, bucket.tokens + windows * RATE_REFILL_PER_WINDOW);
    bucket.updatedAt = now;
  }
  if (bucket.tokens <= 0) {
    limiter.set(bucketKey, bucket);
    return false;
  }
  bucket.tokens -= 1;
  limiter.set(bucketKey, bucket);
  return true;
}

// PII + abuse heuristics (deterministic, no external calls)
const PATTERNS = {
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  cryptoAddress: /\b(?:0x[a-fA-F0-9]{40}|bc1[ac-hj-np-z02-9]{25,62})\b/g,
};

const PROFANITY = (process.env.PROFANITY_WORDS || 'fuck,shit,bitch,cunt,asshole').split(',').map(w => w.trim()).filter(Boolean);
const PROFANITY_RE = PROFANITY.length
  ? new RegExp(`\\b(${PROFANITY.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  : null;

function moderateMessage(message) {
  const original = String(message || '');
  let masked = original;
  const reasons = [];

  let piiDetected = false;
  for (const [name, re] of Object.entries(PATTERNS)) {
    if (re.test(masked)) {
      piiDetected = true;
      masked = masked.replace(re, `[REDACTED_${name.toUpperCase()}]`);
      reasons.push(`pii:${name}`);
    }
  }

  let toxicityScore = 0;
  if (PROFANITY_RE && PROFANITY_RE.test(masked)) {
    const matches = masked.match(PROFANITY_RE) || [];
    toxicityScore = Math.min(1, matches.length / 3);
    masked = masked.replace(PROFANITY_RE, '[CENSORED]');
    reasons.push('abuse:profanity');
  }

  // Very simple spam heuristic
  const repeated = /(.)\1{7,}/.test(masked);
  const urlSpam = /(https?:\/\/\S+)/i.test(masked) && masked.length < 40;
  if (repeated || urlSpam) {
    toxicityScore = Math.max(toxicityScore, 0.7);
    reasons.push('abuse:spam');
  }

  // Decide action
  let action = 'allow';
  if (toxicityScore >= 0.9) action = 'block';
  else if (piiDetected || toxicityScore >= 0.3) action = 'mask';

  return { action, maskedMessage: masked, reasons, piiDetected, toxicityScore };
}

// Analytics: store recent events in a rolling buffer
const MAX_EVENTS = Number(process.env.ANALYTICS_MAX_EVENTS || 200_000);
const events = [];

function pushEvent(ev) {
  events.push(ev);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function computeSummary(windowSeconds) {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const slice = events.filter(e => e.ts >= cutoff);

  const counts = { total: slice.length, allow: 0, mask: 0, block: 0, pii: 0 };
  const lat = [];
  for (const e of slice) {
    if (e.action && counts[e.action] !== undefined) counts[e.action] += 1;
    if (e.piiDetected) counts.pii += 1;
    if (typeof e.latencyMs === 'number') lat.push(e.latencyMs);
  }
  lat.sort((a, b) => a - b);
  const p95 = lat.length ? lat[Math.floor(lat.length * 0.95)] : 0;

  return {
    windowSeconds,
    counts,
    latency: {
      sampleSize: lat.length,
      p95_ms: Number(p95.toFixed(2)),
    },
  };
}

async function main() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: true, credentials: false }));
  app.use(bodyParser.json({ limit: MAX_BODY }));

  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  // Moderation endpoint
  app.post('/moderate', (req, res) => {
    const requestId = requestIdFrom(req);
    const userId = String(req.body?.userId || '');
    const ip = getClientIp(req);
    const key = userId ? `u:${userId}` : `ip:${ip}`;

    console.log(`[Moderation] Received moderation request`, { requestId, userId, ip, messageLength: req.body?.message?.length });

    if (!takeToken(key)) {
      console.warn(`[Moderation] Rate limited request`, { requestId, userId, ip });
      return res.status(429).json({ requestId, error: 'rate_limited' });
    }

    const t0 = Date.now();
    const { action, maskedMessage, reasons, piiDetected, toxicityScore } = moderateMessage(req.body?.message);
    const latencyMs = Date.now() - t0;

    console.log(`[Moderation] Moderation result`, { requestId, action, piiDetected, toxicityScore, latencyMs, reasons });

    pushEvent({
      ts: Date.now(),
      type: 'moderation',
      chatId: req.body?.chatId,
      userId: req.body?.userId,
      action,
      piiDetected,
      toxicityScore,
      latencyMs,
    });

    return res.json({ requestId, action, maskedMessage, reasons, piiDetected, toxicityScore, latencyMs });
  });

  // Generic ingestion endpoint for chat events (for future LHC hooks)
  app.post('/events/chat_message', (req, res) => {
    const requestId = requestIdFrom(req);
    const ev = {
      ts: Date.now(),
      type: 'chat_message',
      chatId: req.body?.chatId,
      userId: req.body?.userId,
      action: req.body?.action,
      piiDetected: Boolean(req.body?.piiDetected),
      latencyMs: typeof req.body?.latencyMs === 'number' ? req.body.latencyMs : undefined,
    };
    pushEvent(ev);
    return res.json({ requestId, ok: true });
  });

  // Summary analytics for dashboards / alerts
  app.get('/analytics/summary', (req, res) => {
    const requestId = requestIdFrom(req);
    const windowSeconds = Math.max(60, Math.min(24 * 3600, Number(req.query?.windowSeconds || 3600)));
    return res.json({ requestId, ...computeSummary(windowSeconds) });
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Support moderation+analytics listening on :${PORT}`);
  });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

