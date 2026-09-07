/**
 * Converts Supabase Auth email-delivery errors into safe, user-facing messages.
 *
 * We deliberately avoid exposing provider internals or implying that the user
 * caused a project-wide limit. Supabase can rate-limit the combined Auth email
 * service (signup confirmation + resend + password recovery), especially when
 * the built-in email provider is used.
 */
export function isAuthEmailRateLimitError(error: string | null | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return normalized.includes('rate limit')
    || normalized.includes('too many')
    || normalized.includes('429')
    || normalized.includes('over_email_send_rate_limit');
}

export function getAuthEmailErrorMessage(error: string | null | undefined, action: 'password_reset' | 'confirmation'): string {
  if (!error) return '';

  const normalized = error.toLowerCase();
  const isRateLimited = isAuthEmailRateLimitError(error);

  if (isRateLimited) {
    return action === 'password_reset'
      ? 'Password reset email is temporarily unavailable because authentication emails are being rate-limited. This can happen even on your first reset request. Please wait a few minutes and try again.'
      : 'Confirmation email is temporarily unavailable because authentication emails are being rate-limited. This can happen even on your first resend request. Please wait a few minutes and try again.';
  }

  if (normalized.includes('email address not authorized')) {
    return 'This email address is not currently authorized to receive authentication emails from the project. Please contact HighPark Consult support.';
  }

  if (normalized.includes('smtp') || normalized.includes('email')) {
    return 'We could not deliver the authentication email right now. Please try again shortly. If the problem continues, contact HighPark Consult support.';
  }

  return action === 'password_reset'
    ? 'We could not send the password reset email. Please try again shortly.'
    : 'We could not send the confirmation email. Please try again shortly.';
}
