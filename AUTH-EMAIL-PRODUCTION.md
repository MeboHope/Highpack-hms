# HighPark Consult PMS — Production Authentication Email Setup

## Application hardening included

- Password-reset and confirmation-email errors are translated into safe, user-facing messages.
- Rate-limit errors no longer claim that the individual user necessarily requested too many emails.
- The application distinguishes common delivery/rate-limit conditions without exposing SMTP/provider internals.
- A short client-side retry cooldown is applied after successful requests and after a server-side rate-limit response.
- Email confirmation remains enabled; the application does not bypass Supabase Auth confirmation.

## Required production Supabase configuration

The Supabase built-in email provider is not suitable for a production PMS. Configure a custom SMTP provider in **Supabase Dashboard → Authentication → Email → SMTP Settings**. Suitable providers include Resend, Amazon SES, Postmark, Twilio SendGrid, and Brevo.

Use a dedicated authentication sending identity such as `no-reply@auth.yourdomain.example` rather than mixing authentication mail with marketing mail. Configure SPF, DKIM and DMARC with the email provider.

Keep **Confirm email** enabled for production account security. Configure the production Site URL and exact redirect URLs used by the PMS password-recovery flow.

## Why this matters

Supabase combines signup confirmation, confirmation resend, and password-recovery email sends under its Auth email sending controls. With the built-in provider, the current documented project-wide limit is 2 authentication emails per hour. Custom SMTP is required for a production-grade sending setup and allows the Auth email rate limits to be configured appropriately.

## Production verification checklist

1. Register a new tenant account.
2. Confirm the email arrives from the configured HighPark Consult authentication domain.
3. Verify the confirmation link returns to the PMS and the tenant can sign in.
4. Request password recovery and verify the reset email arrives.
5. Open the reset link and set a new password.
6. Request another reset immediately and confirm the UI prevents rapid repeated requests.
7. Verify rate-limit errors show the service-level message rather than blaming the user.
8. Check Supabase Auth logs and the SMTP provider delivery/bounce logs during testing.
9. Verify SPF, DKIM and DMARC before public launch.
