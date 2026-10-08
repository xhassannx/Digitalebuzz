# Shopify App Store listing (Helicoptic Commerce)

## OAuth connect (built-in)

1. In **Shopify Partners**, create a custom/public app and copy **Client ID** and **Client secret**.
2. On your panel server, set:
   - `SHOPIFY_API_KEY` (or `SHOPIFY_CLIENT_ID`)
   - `SHOPIFY_API_SECRET` (or `SHOPIFY_CLIENT_SECRET`)
   - `BASE_URL` — public HTTPS URL of this panel
3. Allowed redirect URL: `{BASE_URL}/api/integrations/shopify/oauth/callback`
4. In the panel: **Integrations → Shopify → Connect with Shopify** (registers webhooks automatically).

Manual Admin API token connect remains available for private/custom apps.

## App submission assets

- Update `shopify.app.toml` with your `client_id` and production URLs.
- App listing screenshots: Commerce page, inbox catalog send, flow payment link action.
- Privacy policy URL and support contact (required by Shopify).

## Scopes

Default: `read_products,write_products,read_orders,read_draft_orders,write_draft_orders,read_customers`  
Override with `SHOPIFY_SCOPES` if needed.
