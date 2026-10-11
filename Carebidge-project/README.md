# Carebidge local setup

## Run in Chrome

1. Install Node.js 18 or later.
2. Extract `Carebidge-project.zip` to a folder.
3. Double-click `start-local.cmd`, or open a terminal in that folder and run `node serve.mjs`.
4. In Chrome, open `http://localhost:8000/login.html`. Keep the terminal open while using the site.

Opening the HTML files directly with `file://` will not work for Supabase Auth. The website needs the local HTTP server and an internet connection for Supabase and the Unbounded font.

## Supabase setup

The project is configured for the existing **carebridge** Supabase project. Its `login_accounts` table and `user_roles`/`patient_profiles` tables are already installed. `supabase_schema.sql` and `roles_schema.sql` inside the ZIP contain the repeatable SQL commands. In another Supabase project, run them in that order and update the project URL and publishable key in `auth.js`, `reset.js`, and `app.js`.

In **Authentication > Providers > Email**, ensure email/password sign-in and **Confirm email** are enabled. In **Authentication > URL Configuration**, set Site URL to `http://localhost:8000/login.html` for local work and add both `http://localhost:8000/login.html` and `http://localhost:8000/reset.html` as redirect URLs. Add the corresponding HTTPS URLs when deploying. Configure custom SMTP for reliable production verification and reset emails.

In **Authentication > Settings > Security**, enable leaked-password protection if available on your plan. The Supabase security advisor currently reports that it is disabled. It also reports an unrelated existing `public.rls_auto_enable()` function executable by anonymous and signed-in clients; review that function before using this project for real patient data.

The account `architanand272@gmail.com` is already confirmed and assigned the **doctor** role in carebridge. Choose **Doctor** on the login screen and use its existing password. If that password is unknown, enter the email and click **Forgot password?**, then follow the email link. The reset page asks the account owner to choose a new password; no password was changed by this project setup.

New registrations receive the **patient** role. Patients can view only their own profile page, edit their own details and emergency contact, and see simulated vitals. Doctors can see the main hub, doctor profile, and demonstration patient profiles. To assign another doctor, an administrator can run:

```sql
update public.user_roles set role = 'doctor'
where user_id = (select id from auth.users where lower(email) = lower('doctor@example.com'));
```

Supabase Auth stores protected password hashes in `auth.users`. The application table receives the email immediately through a trigger after registration. Never create a readable password column in a public table.

## Demo data and emergency alert

The main hub uses six fictional profiles and simulated graphs. Normal, Intermediate, and Critical are display labels based on the supplied age 35–70 spreadsheet. The patient profile shows a red alert when a simulated reading is critical; **Simulate critical reading** lets you preview it. The alert stays on screen and does not message or call anyone automatically. Real clinical monitoring and emergency dispatch require a separate validated system. The supplied thesis PDF was empty (0 bytes), so it could not be used as a reference.
