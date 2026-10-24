<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/397c5678-6561-4bdf-a8f1-1401df1bfb2d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Shared clinic data setup

The application currently uses browser-local demo data. Do not enter real patient information or configure production sync until the clinic has an approved Supabase project, an appropriate healthcare privacy agreement, configured Auth users, and reviewed row-level security policies.

1. Apply `supabase/migrations/202610240001_shared_clinic_records.sql` to the approved Supabase project.
2. Create clinic memberships for authenticated users with the least-privilege role they need.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the local environment.

The Supabase client is optional and remains disabled when these values are absent. The current demo login and localStorage records are not connected to Supabase; do not upload mock or local browser records as part of setup. Production sync still requires authenticated app-session wiring and an explicit, audited data-import/cutover process.
