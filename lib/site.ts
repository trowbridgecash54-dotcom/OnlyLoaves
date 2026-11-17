/** Site navigation, in the order it appears in the header and footer. */
export const navigation = [
  { label: "Home", href: "/" },
  { label: "Our Bread", href: "/bread" },
  { label: "OnlyLoafs Club", href: "/club" },
  { label: "Our Story", href: "/story" },
  { label: "How to Order", href: "/how-to-order" },
  { label: "Contact", href: "/contact" },
] as const;

export const routes = {
  home: "/",
  bread: "/bread",
  order: "/order",
  club: "/club",
  clubJoin: "/club/join",
  story: "/story",
  howToOrder: "/how-to-order",
  contact: "/contact",
  faq: "/contact#faq",
  privacy: "/privacy",
} as const;

/**
 * The site's public address, used for search engines and link previews.
 * Set NEXT_PUBLIC_SITE_URL once a domain is connected. Until then this
 * falls back to the address Vercel assigns, or localhost in development.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** Link to the order form with one loaf prefilled. */
export function orderLink(productSlug: string, quantity = 1): string {
  return `${routes.order}?loaf=${encodeURIComponent(productSlug)}&qty=${quantity}`;
}
