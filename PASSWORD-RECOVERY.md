# HighPark Consult — Password Recovery

Password recovery is now implemented using Supabase Auth.

## User flow

1. User opens **Sign In**.
2. User selects **Forgot password?**.
3. User enters their email and selects **Send reset link**.
4. Supabase sends the password recovery email.
5. The recovery link returns to the application root with Supabase's recovery session in the URL fragment.
6. The application's hash router detects the Supabase recovery callback and opens `/reset-password`.
7. User chooses a new password.
8. Supabase updates the password and the user can return to **Sign In**.

## Supabase configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Set **Site URL** to the deployed application's origin, for example `https://your-domain.example`.
- Add the deployed application's origin to **Redirect URLs**.
- During local development, also add the local Vite origin, normally `http://localhost:5173`.

The application deliberately uses the current origin as the password-reset redirect URL so the flow works with the project's hash-based router.

## Security notes

- Passwords are never sent to or stored by the React application.
- Password reset is performed through Supabase Auth.
- The application does not reveal whether an email address belongs to an account when Supabase accepts the reset request.
- The same strong password policy used during registration is enforced when creating the new password.
- An expired/invalid recovery session is rejected with a friendly message and the user can request a new link.

## Production email delivery and rate limits

The application treats Supabase Auth email rate-limit responses as a service-level delivery condition rather than telling the user that they personally made too many requests. This matters because Supabase can apply combined project-wide limits to authentication emails, including signup confirmations, confirmation resends, and password-recovery messages.

For production, configure a custom SMTP provider in Supabase Authentication settings. The built-in Supabase email service is intended for testing and has a very low sending limit. Keep email confirmation enabled for account security, and configure a trusted sending domain with SPF/DKIM/DMARC through the SMTP provider.

The frontend also applies a short client-side cooldown after a successful email request to prevent accidental repeated clicks. This cooldown does not replace Supabase's server-side abuse protection.
