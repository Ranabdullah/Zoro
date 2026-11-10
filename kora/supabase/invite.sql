-- Run privately in Supabase SQL Editor after replacing this example email.
-- Do not commit personal emails to GitHub.
insert into kora_private.allowed_emails(email)
values(lower('replace-with-his-google-email@example.com')) on conflict do nothing;
