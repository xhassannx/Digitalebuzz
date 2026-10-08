# Nginx and SPA routes (`/admin/platform-settings`, `/admin/onboarding-fees`, etc.)

If **opening a deep link** (refresh or direct URL) returns **404 from Nginx** (plain HTML, not the in-app “Did you forget to add the page…” card), the reverse proxy is looking for a **file** on disk instead of forwarding to Node.

The app is a **single-page application**: only `index.html` exists; `/admin/platform-settings` is handled in the browser by React.

## Fix: `try_files`

Inside your `server { ... }` block for the panel host, use something like:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;   # or your Node / PM2 port
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If you **serve static files from Nginx** (not proxying HTML):

```nginx
root /var/www/helicoptic/dist/public;

location / {
    try_files $uri $uri/ /index.html;
}
```

Then **only** `assets` and `index.html` need to exist under `root`; all admin paths fall back to `index.html` and the client router loads.

## In-app “404 Page Not Found” (React card)

If you see the message **“Did you forget to add the page to the router?”**, the server **did** serve `index.html`. That usually means:

- The logged-in user is **not** the SaaS platform owner (`is_saas_owner` is false in the database), **or**
- You are not logged in and hit a URL only defined for authenticated routes.

**Platform admin** pages (including `/admin/platform-settings`) require `is_saas_owner = true` on your user. The licensor can use **`/licensor-access`** with the production key to sign in as the SaaS owner.
