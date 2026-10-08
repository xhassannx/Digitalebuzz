# Facebook Lead Ads – App Review Guide

**Goal:** Request **Advanced Access** for all Lead Ads permissions so any Facebook user can connect.

---

## Permissions to Request

Click **"Request advanced access"** for each:

| Permission | Purpose |
|------------|---------|
| `leads_retrieval` | Retrieve leads from Facebook Lead Ads forms |
| `pages_manage_ads` | Manage Lead Ads and lead forms |
| `pages_read_engagement` | Read page engagement data |
| `pages_manage_metadata` | Manage page settings and webhooks |
| `pages_read_user_content` | Read user content on pages |
| `pages_show_list` | Show list of user's Facebook Pages |

---

## Step 1: Request Advanced Access

1. Go to **App Review** → **Permissions and Features**
2. For each permission above, click **"Request advanced access"**
3. You can submit all 6 together or one by one (Meta often groups related permissions)

---

## Step 2: Prepare Your Submission

### Required for each permission

1. **Use case description** – How your app uses the permission
2. **Demo video (screencast)** – 3–5 minutes showing the flow
3. **Privacy Policy URL** – Must be public and accessible
4. **Terms of Service** – Optional but recommended

### Use case (copy and adapt)

```
Our app syncs Facebook Lead Ads with our CRM. Business users connect their Facebook account via OAuth, grant permissions to access their Lead Ads data, and we retrieve leads from their lead forms. Leads are synced to contacts for follow-up (WhatsApp, email, etc.). We use:
- leads_retrieval: to fetch lead data from forms
- pages_*: to access Pages and manage Lead Ads settings
```

---

## Step 3: Screencast Script (Lead Ads)

### Part 1: OAuth connection (1–2 min)

| Step | Action | Caption |
|------|--------|---------|
| 1 | Open your app → **Integrations** | "Our CRM dashboard with integrations." |
| 2 | Click **Connect** on Facebook Lead Ads | "User connects Facebook Lead Ads." |
| 3 | Meta OAuth popup – user logs in | "User logs in with Facebook and grants permissions." |
| 4 | User selects Pages, grants access | "User grants access to Pages and Lead Ads." |
| 5 | Popup closes, shows "Connected" | "Connection complete." |

### Part 2: Retrieve and sync leads (2–3 min)

| Step | Action | Caption |
|------|--------|---------|
| 6 | Go to **Sync Leads** or Lead Ads section | "We sync leads from Facebook Lead Ads." |
| 7 | Click **Sync** or **Fetch Leads** | "Retrieving leads via leads_retrieval permission." |
| 8 | Show leads appearing in the app | "Leads are fetched and displayed." |
| 9 | Show leads synced to Contacts | "Leads are synced to our contact list for follow-up." |
| 10 | Optionally show a lead form in Ads Manager | "Leads come from Lead Ads created in Meta Ads Manager." |

### Part 3: **Required for `pages_show_list` review** (do not skip)

Meta often rejects if this is missing or only shown as an optional clip.

| Step | Action | Caption |
|------|--------|---------|
| 11 | After OAuth, open Facebook Lead Ads section | "Our app loads the Pages this user manages." |
| 12 | **Show the Page dropdown or list** (names visible) | "We use `pages_show_list` via GET /me/accounts to list Pages." |
| 13 | Select a Page, then open forms / sync leads | "User picks a Page, then syncs Lead Ads — end to end." |

See **`FACEBOOK_PAGES_SHOW_LIST_META_REVIEW.md`** if `pages_show_list` was rejected for “Screencast Not Aligned”.

---

## Step 4: Submission Notes (copy into Meta)

```
Our app integrates Facebook Lead Ads with our CRM. Business users:

1. Connect their Facebook account via OAuth (Facebook Login for Business)
2. Grant permissions to access their Pages and Lead Ads data
3. We retrieve leads from their lead forms using the leads_retrieval permission
4. Leads are synced to contacts for follow-up (WhatsApp, email, campaigns)

The screencast demonstrates:
- Complete OAuth flow and permission grant
- Retrieving leads from Facebook Lead Ads
- Syncing leads to our contact/CRM system

Permissions used:
- leads_retrieval: Fetch lead data from Lead Ads forms
- pages_manage_ads, pages_read_engagement, pages_manage_metadata, pages_read_user_content, pages_show_list: Access Pages and manage Lead Ads
```

---

## Checklist Before Submitting

- [ ] Privacy Policy URL is live and accessible
- [ ] Demo video is in English with captions
- [ ] Video shows: OAuth → Connect → Sync Leads → Leads in app
- [ ] No sensitive data (use test accounts)
- [ ] Record at 1080p, 3–5 minutes

---

## After Submission

- Meta typically reviews within **1–5 business days**
- You may receive questions – respond promptly
- Once approved, each permission will show **Advanced access** and any Facebook user can connect
