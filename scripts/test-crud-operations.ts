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
  const orgMembersCol = db.collection('organization_members');
  const contactsCol = db.collection('managed_contacts');

  const recentSession = await sessionsCol.findOne({}, { sort: { _id: -1 } });
  let cookieHeader = '';
  let activeUserId = '';

  if (recentSession) {
    const rawSid = recentSession._id;
    const signedSid = 's:' + cookieSignature.sign(rawSid, SESSION_SECRET);
    cookieHeader = `connect.sid=${encodeURIComponent(signedSid)}`;
    try {
      const sess = typeof recentSession.session === 'string' ? JSON.parse(recentSession.session) : recentSession.session;
      activeUserId = sess?.passport?.user?.claims?.sub || '';
    } catch {}
  }

  // Get user profile via API to get actual session context
  const authRes = await fetch(`${BASE_URL}/api/auth/user`, {
    headers: { Cookie: cookieHeader, Accept: 'application/json' },
  });
  const authData = await authRes.json();
  const currentUserId = authData.id || authData._id || activeUserId;
  let currentOrgId = authData.organizationId || (authData.organizations?.[0]?.id) || '';
  if (!currentOrgId) {
    const userOrg = await orgMembersCol.findOne({ userId: currentUserId });
    if (userOrg) {
      currentOrgId = userOrg.organizationId;
    } else {
      const anyOrg = await db.collection('organizations').findOne({});
      currentOrgId = anyOrg ? String(anyOrg._id) : '';
    }
  }

  // Get a host user who is actually an org member
  const member = await orgMembersCol.findOne({ organizationId: currentOrgId }) || { userId: currentUserId };
  const hostUserId = member?.userId || currentUserId;

  const headers = {
    Cookie: cookieHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-organization-id': currentOrgId,
  };

  // Get a contact in this organization (or create one for testing)
  let sampleContact = await contactsCol.findOne({ organizationId: currentOrgId });
  if (!sampleContact) {
    sampleContact = await contactsCol.findOne({});
  }
  let sampleContactId = sampleContact ? String(sampleContact._id) : '';

  if (!sampleContactId) {
    // Create a contact for testing invoices
    const createContactRes = await fetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Invoice Customer',
        phone: '+919876543210',
        phoneNumber: '+919876543210',
      }),
    });
    if (createContactRes.ok) {
      const createdContact = await createContactRes.json();
      sampleContactId = createdContact.id || createdContact._id;
    }
  }

  console.log(`Current User: ${currentUserId}, Current Org: ${currentOrgId}, Host Member: ${hostUserId}, Contact: ${sampleContactId}\n`);

  let passed = 0;
  let failed = 0;

  async function testStep(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Canned Messages CRUD
  let cannedId = '';
  await testStep('Canned Message: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/canned-messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Quick Reply',
        type: 'TEXT',
        text: 'Hello, this is a test canned message in MongoDB!',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    cannedId = data.id || data._id;
    if (!cannedId) throw new Error('No id returned');
  });

  await testStep('Canned Message: READ & LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/canned-messages`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some((item: any) => (item.id || item._id) === cannedId)) {
      throw new Error('Created canned message not in list');
    }
  });

  await testStep('Canned Message: UPDATE', async () => {
    const res = await fetch(`${BASE_URL}/api/canned-messages/${cannedId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Updated Test Quick Reply',
        text: 'Updated text content in Mongo!',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('Canned Message: DELETE', async () => {
    const res = await fetch(`${BASE_URL}/api/canned-messages/${cannedId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 2. Contact Columns CRUD
  let colId = '';
  await testStep('Contact Column: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/columns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: `test_col_${Date.now()}`,
        label: 'Test Custom Column',
        type: 'text',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    colId = data.id || data._id;
    if (!colId) throw new Error('No id returned');
  });

  await testStep('Contact Column: LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/columns`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some((item: any) => (item.id || item._id) === colId)) {
      throw new Error('Created column not in list');
    }
  });

  await testStep('Contact Column: DELETE', async () => {
    const res = await fetch(`${BASE_URL}/api/columns/${colId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 3. FAQ Items CRUD
  let faqId = '';
  await testStep('FAQ Item: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/faq`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'What is DigitaleBuzz?',
        answer: 'DigitaleBuzz is an all-in-one WhatsApp Marketing & CRM platform running on MongoDB.',
        keywords: ['digitalebuzz', 'about', 'what'],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    faqId = data.id || data._id;
    if (!faqId) throw new Error('No id returned');
  });

  await testStep('FAQ Item: READ & LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/faq`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some((item: any) => (item.id || item._id) === faqId)) {
      throw new Error('Created FAQ not in list');
    }
  });

  await testStep('FAQ Item: UPDATE', async () => {
    const res = await fetch(`${BASE_URL}/api/faq/${faqId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        answer: 'Updated answer for FAQ!',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('FAQ Item: DELETE', async () => {
    const res = await fetch(`${BASE_URL}/api/faq/${faqId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 4. Booking Calendars CRUD
  let calId = '';
  await testStep('Booking Calendar: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/booking-calendars`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Demo Consultations',
        hostUserId: hostUserId,
        slug: `consultation-${Date.now()}`,
        durationMinutes: 30,
        description: 'Product walkthrough call',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    calId = data.calendar?.id || data.calendar?._id || data.id || data._id;
    if (!calId) throw new Error('No id returned');
  });

  await testStep('Booking Calendar: LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/booking-calendars`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const cals = data.calendars || data;
    if (!Array.isArray(cals) || !cals.some((c: any) => (c.id || c._id) === calId)) {
      throw new Error('Created calendar not in list');
    }
  });

  await testStep('Booking Calendar: UPDATE', async () => {
    const res = await fetch(`${BASE_URL}/api/booking-calendars/${calId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        durationMinutes: 45,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('Booking Calendar: DELETE', async () => {
    const res = await fetch(`${BASE_URL}/api/booking-calendars/${calId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 5. Invoices CRUD
  let invoiceId = '';
  if (sampleContactId) {
    await testStep('Invoice: CREATE via Contact', async () => {
      const res = await fetch(`${BASE_URL}/api/contacts/${sampleContactId}/create-invoice`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lineItems: [
            { name: 'WhatsApp Marketing Setup', cost: 1500, qty: 1, discount: 0 }
          ],
          invoiceStatus: 'paid',
          amountPaid: 1500,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      invoiceId = data.invoiceId || data.id || data._id;
      if (!invoiceId) throw new Error('No id returned');
    });

    await testStep('Invoice: READ', async () => {
      const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if ((data.id || data._id) !== invoiceId) throw new Error('Invoice id mismatch');
    });

    await testStep('Invoice: UPDATE', async () => {
      const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          invoiceStatus: 'paid',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });

    await testStep('Invoice: DELETE', async () => {
      const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });
  }

  // 6. Lead Statuses CRUD
  let statusId = '';
  await testStep('Lead Status: ENSURE DEFAULTS & LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/leads/statuses`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('Lead Status: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/leads/statuses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Test Stage ${Date.now()}`,
        slug: `test_stage_${Date.now()}`,
        color: '#10b981',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    statusId = data.id || data._id;
    if (!statusId) throw new Error('No id returned');
  });

  await testStep('Lead Status: UPDATE', async () => {
    const res = await fetch(`${BASE_URL}/api/leads/statuses/${statusId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        color: '#3b82f6',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('Lead Status: DELETE', async () => {
    const res = await fetch(`${BASE_URL}/api/leads/statuses/${statusId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 7. Opt Keywords CRUD
  await testStep('Opt Keywords: UPDATE / SAVE', async () => {
    const res = await fetch(`${BASE_URL}/api/opt-keywords`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'opt_in',
        keywords: ['START', 'SUBSCRIBE', 'YES'],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  await testStep('Opt Keywords: READ', async () => {
    const res = await fetch(`${BASE_URL}/api/opt-keywords?type=opt_in`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('Opt keywords not saved');
  });

  // 8. Support Ticket CRUD
  let ticketId = '';
  await testStep('Support Ticket: CREATE', async () => {
    const res = await fetch(`${BASE_URL}/api/me/support/tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: currentOrgId,
        subject: 'Need help with WhatsApp connection',
        description: 'Unable to scan QR code, please check.',
        customerPhone: '+919876543210',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    ticketId = data.ticket?.id || data.ticket?._id || data.id || data._id;
    if (!ticketId) throw new Error('No ticket id returned');
  });

  await testStep('Support Ticket: LIST', async () => {
    const res = await fetch(`${BASE_URL}/api/me/support/tickets`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const list = await res.json();
    const tickets = Array.isArray(list) ? list : (list.tickets || []);
    if (!tickets.some((t: any) => (t.id || t._id) === ticketId)) {
      throw new Error('Created ticket not in list');
    }
  });

  console.log(`\n========================================`);
  console.log(`CRUD Test Results: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
