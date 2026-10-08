# Meta App Review: `pages_show_list` — rejection fix & screencast guide

Your rejection says the **use case is allowed**, but the **screencast** did not show the **full end-to-end experience** for that permission (Developer Policy 1.6). This is almost always fixed by **reshooting the video**, not by changing product logic.

---

## What `pages_show_list` is for (and what Meta wants to see)

In your app, this permission supports **listing Facebook Pages the customer manages**, which you then use to load lead forms and sync leads:

- **Graph API:** `GET /me/accounts?fields=id,name,...` (see `server/integrations/handlers/facebook-leads.ts`)
- **UI:** Page dropdown / list on **Integrations → Facebook Lead Ads** and in the leads sync dialog (`facebook-leads-manager.tsx`)

Meta reviewers must see, in **one continuous recording**:

1. **Complete Facebook / Meta login** (full dialog, not a cut).
2. **The screen where the user grants access**, including permissions relevant to Pages (so the grant is visible for a few seconds).
3. **Your app**, in **English**, showing **exactly** how **`pages_show_list`** is used:  
   **after** login, show the **list or dropdown of Pages** loading (not only “Connected”).
4. **End-to-end use case:** e.g. pick a Page → show forms → sync or show leads / contacts — so the Pages list is clearly **step 1** of the lead workflow.

---

## What went wrong in typical rejected videos

| Issue | Why Meta rejects |
|--------|------------------|
| Popup closes in &lt; 1–2 seconds | They cannot verify login + grant |
| No visible **Pages list** in your app | No proof of `pages_show_list` usage |
| Only “Integrations” card shows “Connected” | Does not demonstrate listing Pages |
| App UI not in English | Against their screen-recording guidance |
| No captions / narration | They ask for explanation of buttons and flow |
| Jump cuts skipping Facebook UI | Looks like login/grant was not real |

---

## Recommended screencast script (5–8 minutes, English UI)

Record at **1080p**. Use **on-screen captions** or **voiceover in English** for every step.

1. **Start (caption):** “SaaS panel — Facebook Lead Ads integration.”  
   Open your live app → **Integrations** (or direct link to Facebook Lead Ads).

2. **Connect (caption):** “User starts Facebook connection.”  
   Click **Connect** → **keep the Facebook/Meta window fully visible** until:
   - Email/password or session choice  
   - **Permission / data access** screen — **pause 3–5 seconds** on the list of permissions so `pages_show_list` (or grouped Pages access) is readable  
   - Click **Continue** / **Allow**

3. **Return to app (caption):** “Connection complete; loading Pages user manages.”  
   Expand the Facebook Lead Ads connection (if applicable).  
   **Critical shot:** Show the **Page selector** or **list of Page names** (from `/me/accounts`).  
   **Caption:** “We use Meta’s Pages list (`pages_show_list`) to show Pages this user administers.”

4. **End-to-end (caption):** “Selecting a Page to access Lead Ad forms.”  
   Select a Page → load forms → click **Sync** (or equivalent) → show leads or synced contacts.

5. **Optional (caption):** “Leads are stored for CRM / WhatsApp follow-up only.”  
   Briefly open Contacts or lead list (blur PII if needed).

**Do not** rely only on Ads Manager; the product under review is **your** app showing **your** Pages UI.

---

## Submission notes to paste for Meta (next resubmit)

Adapt and paste in **App Review** → notes for `pages_show_list`:

```
Authentication: Our app uses standard Facebook Login in the browser (OAuth redirect/popup). Users obtain a user access token; we are NOT a server-only app and we do NOT rely solely on a System User token for this flow. The screencast shows the full Meta login and permission grant in the Facebook dialog.

Use of pages_show_list: After the user grants access, our application calls the Graph API GET /me/accounts to retrieve the Facebook Pages the user manages. We display those Pages in our product UI so the user can choose which Page’s Lead Ads forms to sync. This is demonstrated in the video after connection: the Page list/dropdown appears, then the user selects a Page, views lead forms, and syncs leads to contacts.

Screencast: English UI; captions explain each step; includes full login, permission screen, Pages list in our app, and lead sync end-to-end per Meta Screen Recording Guide.
```

If you **also** use a System User for something else, say so clearly:  
*“We additionally use X for Y; the Lead Ads Pages list in the video uses the user OAuth flow above.”*

---

## Facebook Login for Business (`config_id`)

If you use **`FACEBOOK_LEAD_ADS_CONFIG_ID`** (recommended), permissions are defined in the **Meta app configuration**, not only in code.

1. In **Meta Developer Dashboard** → your app → **Facebook Login for Business** (or **Configurations**).
2. Open the **configuration** tied to `config_id`.
3. Ensure **`pages_show_list`** is included in that configuration’s permissions (with Advanced Access requested).

The codebase also lists scopes in `FACEBOOK_SCOPES` for the **non–config_id** fallback; `pages_show_list` was added there so scope-based OAuth matches the API usage.

---

## Code alignment (already in your repo)

| Area | Purpose |
|------|--------|
| `server/integrations/oauth/facebook.ts` | OAuth scopes include `pages_show_list` (fallback path). |
| `server/integrations/handlers/facebook-leads.ts` | `GET .../me/accounts` for pages list + sync. |
| `client/.../facebook-lead-ads-connections-page.tsx` | UI loads pages after connect. |
| `client/.../facebook-leads-manager.tsx` | Dialog lists pages for sync. |

---

## Checklist before re-uploading the screencast

- [ ] App language **English** for the demo recording  
- [ ] **Captions** or clear voiceover for each step  
- [ ] **Entire** Meta login + **permission** screen visible (no skip)  
- [ ] **Pages list/dropdown** visible in **your** app after connect  
- [ ] **Select Page → forms → sync** in the same video  
- [ ] Submission notes mention **user OAuth** (if that’s what you use)  
- [ ] `config_id` configuration in Meta includes **`pages_show_list`** (if using Login for Business)

---

## Official Meta links (for your team)

- [Screen Recording Guide](https://developers.facebook.com/docs/app-review/resources/screen-recording-guide)  
- [App Review introduction](https://developers.facebook.com/docs/app-review)  
- [Permissions reference — `pages_show_list`](https://developers.facebook.com/docs/permissions/reference/pages_show_list)

Rejection reason **“Screencast Not Aligned with Use Case”** is resolved by **a new video** that explicitly shows **Pages listing in your product** as part of the **full** login → grant → lead workflow, not by policy disagreement.
