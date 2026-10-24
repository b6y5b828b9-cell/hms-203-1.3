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

1. Apply both SQL migrations in `supabase/migrations/` to the approved Supabase project.
2. Create clinic memberships for authenticated users with the least-privilege role they need. Insurance status changes require the `medical-coder` membership role; lab, radiology, pharmacy, and billing users need their corresponding role.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the clinic UUID as `VITE_HMS_CLINIC_ID`.

The Supabase client is optional and remains disabled when these values are absent. Shared token synchronization also requires an authenticated Supabase session; the demo login does not create one. Do not upload mock or local browser records as part of setup. Production sync still requires authenticated app-session wiring and an explicit, audited data-import/cutover process. The token authorization contract is in [docs/visit-token.schema.json](./docs/visit-token.schema.json).

The insurance response handler updates linked token line items only for the `medical-coder` role. The repository does not include an eClaimLink/DHPO transport adapter or credentials; connect the payer API to the handler rather than treating manual status entry as an external response.

The Medical Coder Desk surfaces pending token items and doctor appeal requests for review. Until a payer adapter is configured, staff must submit claims through the approved external channel and record only the response received from that payer. Denied items are excluded from patient charges unless a cashier records the patient's self-pay consent. After token billing, the cashier can print the receipt and download the token-based claim summary JSON.
