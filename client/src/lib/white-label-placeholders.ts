/** Ensure a URL is absolute so <a href> opens an external site. */
export function normalizeExternalUrl(url: string | null | undefined): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Strip mailto: and whitespace from an email address. */
export function normalizeEmailAddress(value: string | null | undefined): string {
  return (value || "").trim().replace(/^mailto:/i, "");
}

/**
 * Replace YourBrand placeholders and keep Website: / Email: links in sync
 * with company profile (or with the visible link text when profile is empty).
 */
export function applyWhiteLabelPlaceholders(
  content: string,
  options: { brandName: string; email: string; website: string }
): string {
  const brandName = options.brandName || "YourBrand";
  const email = normalizeEmailAddress(options.email) || "support@yourbrand.com";
  const website = normalizeExternalUrl(options.website);

  let result = content;
  result = result.replace(/YourBrand/g, brandName);
  result = result.replace(/support@yourbrand\.com/gi, email);
  if (website) {
    result = result.replace(/https?:\/\/(?:www\.)?yourbrand\.com\/?/gi, website);
  }

  // Website: <a href="...">label</a> — href must match what users see / company website
  result = result.replace(
    /((?:<strong>\s*)?Website:(?:\s*<\/strong>)?\s*<a\b[^>]*?\bhref\s*=\s*)(["'])([^"']*)\2([^>]*>)([^<]*)(<\/a>)/gi,
    (_match, pre: string, quote: string, href: string, mid: string, text: string, post: string) => {
      const fromText = normalizeExternalUrl(text);
      const fromHref = normalizeExternalUrl(href);
      const url = website || fromText || fromHref || "https://yourbrand.com";
      const label = website || fromText || url;
      return `${pre}${quote}${url}${quote}${mid}${label}${post}`;
    }
  );

  // Email: <a href="...">label</a> — href must be mailto: so the OS mail client opens
  result = result.replace(
    /((?:<strong>\s*)?Email:(?:\s*<\/strong>)?\s*<a\b[^>]*?\bhref\s*=\s*)(["'])([^"']*)\2([^>]*>)([^<]*)(<\/a>)/gi,
    (_match, pre: string, quote: string, href: string, mid: string, text: string, post: string) => {
      const fromText = normalizeEmailAddress(text);
      const fromHref = normalizeEmailAddress(href);
      const addr = email || fromText || fromHref || "support@yourbrand.com";
      return `${pre}${quote}mailto:${addr}${quote}${mid}${addr}${post}`;
    }
  );

  // Email: plain text / <u> / styled span (no <a>) — wrap in a mailto link
  result = result.replace(
    /((?:<strong>\s*)?Email:(?:\s*<\/strong>)?\s*)(?!<a\b)(?:<(?:u|span|em|strong)\b[^>]*>)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:<\/(?:u|span|em|strong)>)?/gi,
    (_match, pre: string, addr: string) => {
      const finalEmail = email || normalizeEmailAddress(addr);
      return `${pre}<a href="mailto:${finalEmail}">${finalEmail}</a>`;
    }
  );

  return result;
}
