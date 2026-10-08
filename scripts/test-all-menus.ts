import 'dotenv/config';
import mongoose from 'mongoose';
import cookieSignature from 'cookie-signature';

const SESSION_SECRET = process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production';
const BASE_URL = 'http://localhost:5002';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/digitalebuzz');
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const sessionsCol = db.collection('sessions');
  const usersCol = db.collection('users');
  const orgsCol = db.collection('organizations');

  const recentSession = await sessionsCol.findOne({}, { sort: { _id: -1 } });
  let cookieHeader = '';
  let activeUserId = '';
  let activeOrgId = '';

  if (recentSession) {
    const rawSid = recentSession._id;
    const signedSid = 's:' + cookieSignature.sign(rawSid, SESSION_SECRET);
    cookieHeader = `connect.sid=${encodeURIComponent(signedSid)}`;
    console.log('Using existing session from DB:', rawSid);
    try {
      const sess = typeof recentSession.session === 'string' ? JSON.parse(recentSession.session) : recentSession.session;
      activeUserId = sess?.passport?.user?.claims?.sub || '';
    } catch {}
  }

  if (!activeUserId) {
    const user = await usersCol.findOne({ isSaaSOwner: true }) || await usersCol.findOne({});
    if (!user) {
      console.error('No users found in DB!');
      process.exit(1);
    }
    activeUserId = String(user._id);
    const newSid = 'test_session_' + Date.now();
    const sessionDoc = {
      _id: newSid,
      expires: new Date(Date.now() + 24 * 3600 * 1000),
      session: {
        cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000).toISOString(), httpOnly: true, path: '/' },
        passport: { user: { claims: { sub: user._id, email: user.email } } },
      },
    };
    await sessionsCol.insertOne(sessionDoc);
    const signedSid = 's:' + cookieSignature.sign(newSid, SESSION_SECRET);
    cookieHeader = `connect.sid=${encodeURIComponent(signedSid)}`;
    console.log('Created test session for user:', user.email);
  }

  const org = await orgsCol.findOne({ ownerId: activeUserId }) || await orgsCol.findOne({});
  activeOrgId = org ? String(org._id) : '';

  // Comprehensive list of Platform & Admin endpoints
  const endpoints = [
    // Platform Menus
    { menu: 'Auth Check', path: '/api/auth/user' },
    { menu: 'Dashboard Stats', path: '/api/dashboard/stats' },
    { menu: 'Contacts List', path: '/api/contacts?limit=10&page=1' },
    { menu: 'Contact Columns', path: '/api/columns' },
    { menu: 'Contact Reminders (Due)', path: '/api/reminders/due' },
    { menu: 'Contact Reminders (List)', path: '/api/reminders/list' },
    { menu: 'Templates', path: '/api/templates' },
    { menu: 'Canned Messages', path: '/api/canned-messages' },
    { menu: 'Campaigns', path: '/api/campaigns' },
    { menu: 'Drip Campaigns', path: '/api/drip-campaigns' },
    { menu: 'Chatbots', path: '/api/chatbots' },
    { menu: 'AI Assistants', path: '/api/ai-assistants' },
    { menu: 'FAQ Items', path: '/api/faq' },
    { menu: 'FAQ Settings', path: '/api/faq/settings' },
    { menu: 'Booking Calendars', path: '/api/booking-calendars' },
    { menu: 'Scheduled Meetings', path: '/api/meetings' },
    { menu: 'Meeting Stats', path: '/api/meetings/stats' },
    { menu: 'Invoices', path: '/api/invoices' },
    { menu: 'Invoice Settings', path: '/api/invoice-settings' },
    { menu: 'Commerce Settings', path: '/api/commerce/settings' },
    { menu: 'Commerce Orders (WA Pay)', path: '/api/wa-pay/orders' },
    { menu: 'Support Tickets', path: '/api/support/tickets' },
    { menu: 'Integrations', path: '/api/integrations' },
    { menu: 'Webhooks', path: '/api/webhooks' },
    { menu: 'Leads List', path: '/api/leads' },
    { menu: 'Lead Statuses', path: '/api/leads/statuses' },
    { menu: 'Lead Sources', path: '/api/leads/sources' },
    { menu: 'User Settings', path: '/api/settings' },
    ...(activeOrgId ? [{ menu: 'Organization Theme', path: `/api/organizations/${activeOrgId}/theme` }] : []),
    { menu: 'Opt Keywords (In)', path: '/api/opt-keywords?type=opt_in' },
    { menu: 'Opt Keywords (Out)', path: '/api/opt-keywords?type=opt_out' },
    { menu: 'Subscription Current', path: '/api/subscriptions/current' },
    { menu: 'Payments History', path: '/api/payments/history' },
    { menu: 'Platform Plans', path: '/api/plans' },

    // Admin Menus
    { menu: 'Admin Users', path: '/api/admin/users' },
    { menu: 'Admin Plans', path: '/api/admin/plans' },
    { menu: 'Admin Orders', path: '/api/admin/orders' },
    { menu: 'Admin Organizations', path: '/api/admin/organizations' },
    { menu: 'Admin Platform Master', path: '/api/admin/platform-master-settings' },
    { menu: 'Admin Stats', path: '/api/admin/stats' },
    { menu: 'Admin Addons', path: '/api/admin/addons' },
    { menu: 'Admin Coupons', path: '/api/admin/coupons' },
    { menu: 'Admin Onboarding Fees', path: '/api/admin/onboarding-fees' },
    { menu: 'Admin Webhook Logs', path: '/api/admin/webhook-logs' },
    ...(activeUserId ? [{ menu: 'Admin User Activities', path: `/api/admin/users/${activeUserId}/activities` }] : []),
  ];

  console.log(`\nTesting ${endpoints.length} endpoints across all Platform and Admin menus...\n`);
  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        headers: {
          Cookie: cookieHeader,
          Accept: 'application/json',
        },
      });

      const status = res.status;
      let bodyText = await res.text();
      let isJson = false;
      let parsed: any = null;
      try {
        parsed = JSON.parse(bodyText);
        isJson = true;
      } catch {}

      if (status >= 200 && status < 400) {
        const count = Array.isArray(parsed)
          ? `array[${parsed.length}]`
          : (parsed && typeof parsed === 'object' ? `object(${Object.keys(parsed).length} keys)` : 'ok');
        console.log(`✅ [${status}] ${ep.menu.padEnd(28)} -> ${ep.path} (${count})`);
        passed++;
      } else {
        console.error(`❌ [${status}] ${ep.menu.padEnd(28)} -> ${ep.path}: ${bodyText.slice(0, 120)}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ [ERR] ${ep.menu.padEnd(28)} -> ${ep.path}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED out of ${endpoints.length} total endpoints`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
