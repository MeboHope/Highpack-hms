# Phase 10.1 Auth Confirmation Fix

Fixes the tenant login experience when Supabase email confirmation is enabled.

Changes:
- AuthContext detects when signup returns a user without a session.
- AuthContext exposes resendConfirmation().
- Login maps Supabase 'Email not confirmed' to a clear tenant-friendly message.
- Register/login UI provides a resend confirmation action.

Important: this does not bypass email verification. If the intended business policy is that tenant accounts should be immediately usable without email verification, disable 'Confirm email' in Supabase Authentication settings. The application cannot safely bypass that hosted Auth policy from the browser.
