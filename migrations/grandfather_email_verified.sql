-- Grandfather existing accounts: only NEW signups need first-login email OTP.
-- New users are created with email_verified = false by signup.
UPDATE users SET email_verified = true WHERE email_verified = false;
