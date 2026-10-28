# Carebidge local setup

## Run in Chrome

1. Install Node.js 18 or later.
2. Extract `Carebidge-project.zip`.
3. Double-click `start-local.cmd`, or run `node serve.mjs` in the extracted folder.
4. Open the URL printed by the server in Chrome. It tries ports 8000 and 8123-8126 in order. Keep the server window open.

The app needs local HTTP and an internet connection. Opening an HTML file with `file://` will not work with Supabase Auth.

## Supabase setup

This ZIP is configured for the existing **carebridge** Supabase project. The schema is already installed there. For a new project, run these files in the Supabase SQL Editor, in order: `supabase_schema.sql`, `roles_schema.sql`, `care_features.sql`, `real_model.sql`. Then replace the Supabase URL and publishable key in `auth.js`, `reset.js`, and `app.js`.

In **Authentication → Providers → Email**, enable email/password sign-in and Confirm email. In **Authentication → URL Configuration**, add the printed local origin's `login.html` and `reset.html` URLs as redirect URLs. Configure custom SMTP before relying on verification or password-reset mail. In **Authentication → Settings → Security**, enable leaked-password protection if available on your plan.

The verified account `architanand272@gmail.com` has the doctor role. Log in as Doctor with its existing password, or use Forgot password. New registrations start as patients. Supabase Auth stores password hashes; application tables never store readable passwords.

## How the connected workflow works

1. A patient registers, confirms email, signs in, and fills in their profile and emergency contact.
2. In **Connected doctors**, the patient chooses a doctor. This grants that doctor access to the patient's profile, vital readings, and SOS log. The patient can disconnect the doctor.
3. The patient records actual measurements from a device in the reading form. The graphs show only saved measurements, with their timestamps and source. No measurements are generated or filled in.
4. The patient enters medicine names and prescribed times. The daily timer and Taken/Not taken status use those times. The app does not randomize medicine times or verify ingestion.
5. SOS saves a timestamped request for the connected doctor's in-app emergency log. The doctor page refreshes that log about every eight seconds. The app does **not** contact hospitals, send SMS, or dispatch emergency services. If no doctor is connected, SOS is disabled.

The doctor can edit their own clinician profile. The main hub lists only patients who connected to that doctor and shows their latest recorded readings. An empty hub means no patient has connected; it is not filled with sample records.

## Device connection and clinical use

The device/API integration is pending its product name, documentation, and data format. The current working input is manual entry of actual device measurements. A device connector must authenticate on a backend and write `source = 'device'`; do not put its secret key in browser code. The reading flags use broad reference thresholds and need clinician review before clinical deployment. Carebidge is not an emergency response service; call the local emergency number for immediate help.
