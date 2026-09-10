import express from 'express';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import next from 'next';
import { randomUUID } from 'node:crypto';
import prisma from './Workers/db.ts';
import { normalizeWhatsAppNumber, whatsappConfigured } from './Workers/whatsapp-service.ts';
import { runReminderCycle, startReminderScheduler } from './Workers/reminder-scheduler.ts';
import { safeTimeZone } from './Workers/reminder-utils.ts';
import { sealGmailTokens, openGmailTokens } from './Workers/gmail-token.ts';
import {
  cancelExtractionJob,
  confirmExtractionJob,
  getExtractionJob,
  publicJob,
  startExtraction,
} from './Workers/extractor/extraction-jobs.ts';
import type { SubscriptionResult } from './Workers/extractor/types.ts';
import { subscriptionStore, SubscriptionValidationError } from './Workers/subscription-store.ts';
import { enqueueGmailPush, saveGmailConnection, serializeCandidate, startGmailWatchWorker, webhookTokenIsValid } from './Workers/gmail-watch.ts';
import {
  passport,
  generateSessionToken,
  authenticateJWT,
  verifySessionToken,
  SESSION_EXPIRY_MS,
} from './Workers/Authentication-JWT.ts';
import type { UserProfile } from './Workers/Authentication-JWT.ts';


dotenv.config();
if (process.env.EXTRACTOR_ENV_PATH) {
  dotenv.config({ path: process.env.EXTRACTOR_ENV_PATH, override: false });
}

const app = express();
const PORT = process.env.PORT || 3500;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !process.argv.includes('--production');
const nextApp = next({ dev: isDevelopment, dir: __dirname });
const handleNextRequest = nextApp.getRequestHandler();


app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());

/* ==========================================================================
   AUTHENTICATION ROUTES (Passport.js)
   ========================================================================== */

// 1. Google OAuth Initiation Route
app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'consent',
    accessType: 'offline',
  })
);

// Request Gmail read-only access only when the user chooses to connect Gmail.
app.get(
  '/auth/google/connect',
  authenticateJWT,
  (req: Request, res: Response, next) => {
    res.cookie('oauth_intent', 'gmail_connect', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    passport.authenticate('google', {
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent',
      accessType: 'offline',
    })(req, res, next);
  },
);


// 2. Google OAuth Callback Route
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/?error=google_auth_failed',
  }),
  async (req: Request, res: Response) => {
    const googleUser = req.user as UserProfile;
    const isGmailConnection = req.cookies.oauth_intent === 'gmail_connect';
    const appUser = isGmailConnection ? verifySessionToken(req.cookies.session_token) : null;

    if (!isGmailConnection) {
      const token = generateSessionToken(googleUser);
      // Set HttpOnly session cookie valid for 90 days (3 months)
      res.cookie('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_EXPIRY_MS,
        sameSite: 'lax',
      });
    }

    if (isGmailConnection && !appUser) {
      res.clearCookie('oauth_intent');
      res.redirect('/?error=session_expired');
      return;
    }

    if (isGmailConnection && appUser && googleUser.gmailAccessToken) {
      const gmailTokens = { accessToken: googleUser.gmailAccessToken, refreshToken: googleUser.gmailRefreshToken, connectedAt: Date.now() };
      res.cookie(
        'gmail_connection',
        sealGmailTokens(gmailTokens),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: SESSION_EXPIRY_MS,
          sameSite: 'lax',
        },
      );
      try { await saveGmailConnection(appUser.email.toLowerCase(), gmailTokens, googleUser.email.toLowerCase()); }
      catch (error) { console.warn('[Gmail watch] Setup failed:', error instanceof Error ? error.message : error); }
    }
    res.clearCookie('oauth_intent');

    res.redirect(isGmailConnection ? '/dashboard?gmail=connected' : '/dashboard');
  }
);

// 3. Logout Route
app.get('/auth/logout', (_req: Request, res: Response)=> {
  res.clearCookie('session_token');
  res.clearCookie('gmail_connection');
  res.redirect('/?auth_status=logged_out');
});


/* ==========================================================================
   PROTECTED API ENDPOINTS
   ========================================================================== */

// Protected endpoint to fetch current user session
app.get('/api/me', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user!;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const secondsRemaining = user.exp ? user.exp - nowInSeconds : 0;
  const daysRemaining = (secondsRemaining / (24 * 60 * 60)).toFixed(2);

  res.json({
    authenticated: true,
    user,
    sessionMetadata: {
      expiryDuration: '3 Months (90 Days)',
      issuedAt: user.iat ? new Date(user.iat * 1000).toISOString() : null,
      expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
      secondsRemaining,
      daysRemaining: `${daysRemaining} days`,
    },
  });
});

// Public status route to report environment setup status
app.get('/api/status', (_req: Request, res: Response) => {
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('your_google_client_id')
  );
  res.json({
    googleConfigured,
    sessionExpiryDuration: '90 Days (3 Months)',
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
  });
});

// Public endpoint called by the Google Cloud Pub/Sub push subscription.
app.post('/api/webhooks/gmail', async (req: Request, res: Response) => {
  if (!webhookTokenIsValid(req.query.token)) {
    res.status(401).json({ error: 'Invalid webhook token.' });
    return;
  }
  try {
    await enqueueGmailPush(req.body);
    res.status(204).end();
  } catch (error) {
    console.warn('[Gmail webhook] Rejected notification:', error instanceof Error ? error.message : error);
    res.status(400).json({ error: 'Invalid Gmail notification.' });
  }
});










/* ==========================================================================
   START SERVER
   ========================================================================== */

async function startServer(): Promise<void> {
  await nextApp.prepare();

  app.all('*', (req, res) => handleNextRequest(req, res));

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SubTrack running on http://localhost:${PORT}`);
    console.log(`🔒 JWT Session Lifetime: 3 Months (90 Days / 7,776,000s)`);
    console.log(`🌐 Sign in with Google: http://localhost:${PORT}/auth/google`);
    console.log(`=======================================================`);
    startReminderScheduler();
    startGmailWatchWorker();
  });
}

startServer().catch((error) => {
  console.error('Failed to start SubTrack:', error);
  process.exit(1);
});

// Browser requests to account data must originate from this app, despite legacy CORS settings.
app.use(['/api/subscriptions', '/api/extraction', '/api/review-candidates', '/api/exchange-rates', '/api/reminders', '/api/connections'], (req, res, next) => {
  const origin = req.get('Origin');
  let crossOrigin = req.get('Sec-Fetch-Site') === 'cross-site';
  if (origin) {
    try { crossOrigin ||= new URL(origin).host !== req.get('Host'); }
    catch { crossOrigin = true; }
  }
  if (crossOrigin) { res.status(403).json({ error: 'Open SubTrack directly to continue.' }); return; }
  next();
});

const usdRateCache = new Map<string, { rate: number; expiresAt: number }>();

app.get('/api/exchange-rates', authenticateJWT, async (req: Request, res: Response) => {
  const currencies = String(req.query.currencies || '')
    .split(',')
    .map((currency) => currency.trim().toUpperCase())
    .filter((currency, index, all) => /^[A-Z]{3}$/.test(currency) && currency !== 'USD' && all.indexOf(currency) === index)
    .slice(0, 20);
  const rates: Record<string, number> = { USD: 1 };
  try {
    await Promise.all(currencies.map(async (currency) => {
      const cached = usdRateCache.get(currency);
      if (cached && cached.expiresAt > Date.now()) {
        rates[currency] = cached.rate;
        return;
      }
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/USD`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`No USD rate is available for ${currency}.`);
      const data = await response.json() as { rate?: number };
      if (!Number.isFinite(data.rate) || Number(data.rate) <= 0) throw new Error(`Invalid USD rate for ${currency}.`);
      rates[currency] = Number(data.rate);
      usdRateCache.set(currency, { rate: rates[currency], expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    }));
    res.set('Cache-Control', 'private, max-age=1800');
    res.json({ base: 'USD', rates });
  } catch {
    res.status(503).json({ error: 'Dollar conversion rates are temporarily unavailable.' });
  }
});

app.get('/api/subscriptions', authenticateJWT, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ subscriptions: await subscriptionStore.list(req.user!) }); }
  catch { res.status(500).json({ error: 'Unable to load saved subscriptions. Please retry.' }); }
});

app.post('/api/subscriptions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const subscription = await subscriptionStore.addManual(req.user!, req.body);
    res.status(201).json({ subscription });
  } catch (error) {
    res.status(error instanceof SubscriptionValidationError ? 400 : 500).json({
      error: error instanceof SubscriptionValidationError ? error.message : 'Unable to save the subscription. Your form is still available; please retry.',
    });
  }
});

app.patch('/api/subscriptions/:id/reminder', authenticateJWT, async (req: Request, res: Response) => {
  if (typeof req.body?.enabled !== 'boolean') { res.status(400).json({ error: 'Choose whether the reminder is enabled.' }); return; }
  try {
    const subscription = await subscriptionStore.setReminder(req.user!, req.params.id, req.body.enabled);
    if (!subscription) { res.status(404).json({ error: 'Subscription not found.' }); return; }
    if (!req.body.enabled) {
      await prisma.reminderDelivery.updateMany({
        where: { subscriptionId: req.params.id, status: 'pending' },
        data: { status: 'cancelled', lastError: 'Reminder disabled by the user.' },
      });
    } else void runReminderCycle();
    res.json({ subscription });
  } catch { res.status(500).json({ error: 'Unable to update the reminder. Please retry.' }); }
});

app.get('/api/reminders/settings', authenticateJWT, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await prisma.user.upsert({
      where: { email: req.user!.email },
      update: { name: req.user!.name, avatar: req.user!.avatar },
      create: { email: req.user!.email, name: req.user!.name, avatar: req.user!.avatar, provider: req.user!.provider, providerId: req.user!.id },
    });
    const latestTest = await prisma.reminderDelivery.findFirst({
      where: { userEmail: req.user!.email, kind: 'connection_test' },
      orderBy: { createdAt: 'desc' },
      select: { status: true, scheduledFor: true, sentAt: true, lastError: true },
    });
    res.json({
      whatsappNumber: user.whatsappNumber ? `+${user.whatsappNumber}` : null,
      connectedAt: user.whatsappConnectedAt?.toISOString() || null,
      reminderLeadDays: user.reminderLeadDays,
      timeZone: user.timeZone,
      whatsappConfigured: whatsappConfigured(),
      latestTest: latestTest ? { ...latestTest, scheduledFor: latestTest.scheduledFor.toISOString(), sentAt: latestTest.sentAt?.toISOString() || null } : null,
    });
  } catch { res.status(500).json({ error: 'Unable to load reminder settings.' }); }
});

app.patch('/api/reminders/settings', authenticateJWT, async (req: Request, res: Response) => {
  const leadDays = Number(req.body?.reminderLeadDays);
  if (![1, 3, 7].includes(leadDays)) { res.status(400).json({ error: 'Choose a reminder lead time of 1, 3, or 7 days.' }); return; }
  const timeZone = safeTimeZone(typeof req.body?.timeZone === 'string' ? req.body.timeZone : undefined);
  try {
    const user = await prisma.user.upsert({
      where: { email: req.user!.email },
      update: { name: req.user!.name, avatar: req.user!.avatar, reminderLeadDays: leadDays, timeZone },
      create: { email: req.user!.email, name: req.user!.name, avatar: req.user!.avatar, provider: req.user!.provider, providerId: req.user!.id, reminderLeadDays: leadDays, timeZone },
    });
    await prisma.reminderDelivery.updateMany({
      where: { userEmail: req.user!.email, kind: 'renewal', status: 'pending' },
      data: { status: 'cancelled', lastError: 'Reminder timing changed by the user.' },
    });
    void runReminderCycle();
    res.json({ reminderLeadDays: user.reminderLeadDays, timeZone: user.timeZone });
  } catch { res.status(500).json({ error: 'Unable to update reminder timing.' }); }
});

app.post('/api/connections/whatsapp', authenticateJWT, async (req: Request, res: Response) => {
  let number: string;
  try { number = normalizeWhatsAppNumber(req.body?.number); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Enter a valid WhatsApp number.' }); return; }
  if (!whatsappConfigured()) { res.status(503).json({ error: 'WhatsApp delivery is not configured yet.' }); return; }
  const scheduledFor = new Date(Date.now() + 10_000);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: req.user!.email },
        update: { name: req.user!.name, avatar: req.user!.avatar, whatsappNumber: number, whatsappConnectedAt: new Date() },
        create: { email: req.user!.email, name: req.user!.name, avatar: req.user!.avatar, provider: req.user!.provider, providerId: req.user!.id, whatsappNumber: number, whatsappConnectedAt: new Date() },
      });
      await tx.reminderDelivery.updateMany({
        where: { userEmail: req.user!.email, status: 'pending' },
        data: { status: 'cancelled', lastError: 'WhatsApp number changed by the user.' },
      });
      await tx.reminderDelivery.create({
        data: {
          userEmail: req.user!.email,
          kind: 'connection_test',
          deliveryKey: `connection:${req.user!.email}:${randomUUID()}`,
          message: 'SubTrack is connected. Renewal reminders you enable will arrive on this WhatsApp number.',
          scheduledFor,
        },
      });
    });
    const deliveryWake = setTimeout(() => void runReminderCycle(), Math.max(0, scheduledFor.getTime() - Date.now()));
    deliveryWake.unref?.();
    res.status(202).json({ whatsappNumber: `+${number}`, status: 'pending', scheduledFor: scheduledFor.toISOString() });
  } catch { res.status(500).json({ error: 'Unable to save this WhatsApp number.' }); }
});

app.post('/api/extraction/start', authenticateJWT, async (req: Request, res: Response) => {
  const gmailTokens = openGmailTokens(req.cookies.gmail_connection);
  if (!gmailTokens) {
    res.status(409).json({
      error: 'Gmail is not connected. Connect Gmail before starting a scan.',
      reconnectUrl: '/auth/google/connect',
    });
    return;
  }

  // Also migrates Gmail connections created before persistent monitoring existed.
  void saveGmailConnection(req.user!.email.toLowerCase(), gmailTokens).catch((error) => {
    console.warn('[Gmail watch] Could not enable monitoring:', error instanceof Error ? error.message : error);
  });

  const job = startExtraction(req.user!.id, gmailTokens);
  res.status(202).json(publicJob(job));
});

app.get('/api/extraction/status/:jobId', authenticateJWT, (req: Request, res: Response) => {
  const job = getExtractionJob(req.params.jobId, req.user!.id);
  if (!job) {
    res.status(404).json({ error: 'Extraction job not found.' });
    return;
  }
  res.json(publicJob(job));
});

app.post('/api/extraction/cancel/:jobId', authenticateJWT, (req: Request, res: Response) => {
  const job = cancelExtractionJob(req.params.jobId, req.user!.id);
  if (!job) {
    res.status(404).json({ error: 'Extraction job not found.' });
    return;
  }
  res.json(publicJob(job));
});

app.post('/api/extraction/confirm', authenticateJWT, async (req: Request, res: Response) => {
  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  const incoming = Array.isArray(req.body?.subscriptions) ? req.body.subscriptions : [];
  const subscriptions: SubscriptionResult[] = incoming.slice(0, 500).map((item: any) => {
    const value = item && typeof item === 'object' ? item : {};
    return {
    emailId: String(value.emailId || ''),
    subject: String(value.subject || ''),
    from: String(value.from || ''),
    date: String(value.date || ''),
    timestamp: Number(value.timestamp) || Date.now(),
    isQualified: true,
    tag: value.tag === 'trial' ? 'trial' : 'subscription',
    serviceName: String(value.serviceName || 'Subscription').slice(0, 160),
    amount: value.amount ? String(value.amount).slice(0, 80) : undefined,
    billingFrequency: value.billingFrequency
      ? String(value.billingFrequency).slice(0, 40)
      : undefined,
    renewalOrEndDate: value.renewalOrEndDate
      ? String(value.renewalOrEndDate).slice(0, 80)
      : undefined,
    summary: String(value.summary || '').slice(0, 500),
  }});

  const original = getExtractionJob(jobId, req.user!.id);
  if (!original || !['completed', 'failed', 'cancelled', 'confirmed'].includes(original.stage) || !original.results.length ||
      subscriptions.some((item) => !original.results.some((result) => result.emailId === item.emailId))) {
    res.status(409).json({ error: 'This extraction is not ready to confirm.' });
    return;
  }
  if (subscriptions.some((item) => !item.serviceName.trim() || !['weekly', 'monthly', 'quarterly', 'annually'].includes(item.billingFrequency || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.renewalOrEndDate || ''))) {
    res.status(400).json({ error: 'Merchant, billing frequency, and renewal date are required for every subscription.' });
    return;
  }
  let savedSubscriptions;
  try { savedSubscriptions = await subscriptionStore.addExtracted(req.user!, subscriptions); }
  catch {
    res.status(500).json({ error: 'Unable to save subscriptions. Your review is still available; please retry.' });
    return;
  }
  const job = original.stage === 'confirmed' ? original : confirmExtractionJob(jobId, req.user!.id, subscriptions);
  if (!job) {
    res.status(409).json({ error: 'This extraction is not ready to confirm.' });
    return;
  }
  res.json({ success: true, count: job.results.length, savedSubscriptions, ...publicJob(job) });
});

app.get('/api/review-candidates', authenticateJWT, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const userEmail = req.user!.email.toLowerCase();
    let connections = await prisma.gmailConnection.findMany({ where: { ownerEmail: userEmail }, select: { watchStatus: true, watchExpiration: true, lastError: true } });
    if (!connections.length) {
      const cookieTokens = openGmailTokens(req.cookies.gmail_connection);
      if (cookieTokens) {
        await saveGmailConnection(userEmail, cookieTokens);
        connections = await prisma.gmailConnection.findMany({ where: { ownerEmail: userEmail }, select: { watchStatus: true, watchExpiration: true, lastError: true } });
      }
    }
    const records = await prisma.reviewCandidate.findMany({ where: { userEmail, status: 'pending' }, orderBy: { receivedAt: 'desc' }, take: 200 });
    res.json({
      candidates: records.map(serializeCandidate),
      monitoring: connections[0] ? { status: connections[0].watchStatus, expiresAt: connections[0].watchExpiration?.toISOString() || null, error: connections[0].lastError }
        : { status: 'disconnected', expiresAt: null, error: null },
    });
  } catch { res.status(500).json({ error: 'Unable to load new Gmail findings.' }); }
});

app.get('/api/connections/gmail', authenticateJWT, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const connections = await prisma.gmailConnection.findMany({
      where: { ownerEmail: req.user!.email.toLowerCase() },
      orderBy: { createdAt: 'asc' },
      select: { gmailEmail: true, watchStatus: true, lastSyncAt: true, createdAt: true, lastError: true },
    });
    res.json({ connections: connections.map((connection) => ({
      email: connection.gmailEmail,
      status: connection.watchStatus,
      connectedAt: connection.createdAt.toISOString(),
      lastSyncAt: connection.lastSyncAt?.toISOString() || null,
      error: connection.lastError,
    })) });
  } catch { res.status(500).json({ error: 'Unable to load Gmail connections.' }); }
});

app.post('/api/review-candidates/confirm', authenticateJWT, async (req: Request, res: Response) => {
  const incoming = Array.isArray(req.body?.subscriptions) ? req.body.subscriptions.slice(0, 200) : [];
  const candidateIds = incoming.map((item: any) => String(item?.candidateId || '')).filter(Boolean);
  if (!candidateIds.length || candidateIds.length !== incoming.length) {
    res.status(400).json({ error: 'Choose at least one new subscription to confirm.' });
    return;
  }
  const userEmail = req.user!.email.toLowerCase();
  const records = await prisma.reviewCandidate.findMany({ where: { id: { in: candidateIds }, userEmail, status: 'pending' } });
  if (records.length !== candidateIds.length) {
    res.status(409).json({ error: 'One of these findings is no longer awaiting review.' });
    return;
  }
  const allowed = new Map(records.map((record) => [record.id, record]));
  const subscriptions: SubscriptionResult[] = incoming.map((item: any) => {
    const original = allowed.get(String(item.candidateId))!;
    return {
      emailId: original.emailId, subject: original.subject, from: original.sender,
      date: original.receivedAt.toUTCString(), timestamp: original.receivedAt.getTime(), isQualified: true,
      tag: item.tag === 'trial' ? 'trial' : 'subscription',
      serviceName: String(item.serviceName || '').trim().slice(0, 160),
      amount: item.amount ? String(item.amount).slice(0, 80) : undefined,
      billingFrequency: item.billingFrequency ? String(item.billingFrequency).slice(0, 40) : undefined,
      renewalOrEndDate: item.renewalOrEndDate ? String(item.renewalOrEndDate).slice(0, 10) : undefined,
      summary: original.summary,
    };
  });
  if (subscriptions.some((item) => !item.serviceName || !['weekly', 'monthly', 'quarterly', 'annually'].includes(item.billingFrequency || '') || !/^\d{4}-\d{2}-\d{2}$/.test(item.renewalOrEndDate || ''))) {
    res.status(400).json({ error: 'Merchant, billing frequency, and renewal date are required for every subscription.' });
    return;
  }
  try {
    const savedSubscriptions = await subscriptionStore.addExtracted(req.user!, subscriptions);
    await prisma.reviewCandidate.updateMany({ where: { id: { in: candidateIds }, userEmail }, data: { status: 'confirmed' } });
    res.json({ success: true, count: subscriptions.length, savedSubscriptions });
  } catch { res.status(500).json({ error: 'Unable to save these subscriptions. Your review is still available.' }); }
});

app.post('/api/review-candidates/:id/dismiss', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await prisma.reviewCandidate.updateMany({ where: { id: req.params.id, userEmail: req.user!.email.toLowerCase(), status: 'pending' }, data: { status: 'dismissed' } });
    if (!result.count) { res.status(404).json({ error: 'Review item not found.' }); return; }
    res.status(204).end();
  } catch { res.status(500).json({ error: 'Unable to dismiss this finding.' }); }
});
