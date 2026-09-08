/**
 * Canonical public URL used for authentication callbacks.
 *
 * Set VITE_SITE_URL in every deployed environment (for example,
 * https://pms.highparkconsult.com). During local development we safely fall
 * back to the browser origin so the same build continues to work locally.
 */
export function getSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  const base = configured || window.location.origin;
  return base.replace(/\/$/, '');
}

export function getPasswordRecoveryRedirectUrl(): string {
  return `${getSiteUrl()}/?auth=recovery`;
}
