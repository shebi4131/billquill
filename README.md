# BillQuill

Next.js invoicing app with a public site, a preview-only invoice demo, and subscription-based business workspaces.

## Run locally

1. Run `npm ci` and `npm run dev` (Node.js 20.9 or later). Visit http://localhost:3000.
2. Copy `.env.example` to `.env.local`. Add your Supabase URL and publishable key. Set the site URL to your local origin.
3. For a new database, apply `supabase/migrations/001_initial.sql` then `002_subscriptions.sql`, then `003_plan_requests.sql` and `004_businesses_and_audit.sql`. On an existing database, apply only the migrations you have not run.
4. Enable Google in Supabase Auth. In the Google console, add the provider callback shown by Supabase, typically `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase Auth URL Configuration, allow `http://localhost:3000/auth/callback` and set the site URL to your local origin.
5. Restart Next.js. The first Google sign-in redirects a new account to business registration. Each account can create and switch between multiple business workspaces. Each business has its own plan and invoice number sequence. Businesses and invoices are archived on removal to retain history. The contact form becomes available after Supabase is connected and the migrations are applied. For email registration, enable the Supabase Email provider and configure custom SMTP for customer confirmation messages. Google sign-in remains available.

Run `npm run typecheck` and `npm run build` to verify changes.

## Seed your superadmin

Sign in once using the account you want to promote. Copy its UUID from **Supabase → Authentication → Users**. Paste the [seed SQL](supabase/seed-superadmin.sql) into the SQL editor, replace its placeholder UUID, and run it. Visit `/admin` with that account. Re-running the seed for the same account is safe. Keep this role limited to trusted operators.

## Plans and manual billing

- **Basic — PKR 2,499/month.** Unlimited invoices and one design chosen when the subscription is activated. Each additional standard design is a PKR 500 one-time purchase. Purchased designs stay assigned to the workspace and become usable again when it has an active plan.
- **Plus — PKR 3,499/month.** Unlimited invoices and all five standard designs.
- **Custom letterhead — quoted separately.** The public contact form creates a request in the superadmin inbox. Creating bespoke templates still involves a manual design process.

Businesses request Basic or Plus from **Workspace → Plans**. In **Superadmin → Pending plan requests**, select **Approve and activate** after confirming payment, or **Decline**. Approval applies one calendar month immediately. Renewing the same active plan adds one calendar month to the existing expiry. Switching plans starts the new term immediately. The workspace controls in `/admin` also allow manual adjustments. Use **Grant purchase** for paid add-ons. Renew by updating the expiry. Superadmins can also cancel a plan or revoke an add-on. Online payments, automatic renewals, email notifications, and automated custom-template delivery are outside this setup.

An active subscription is required to create and issue invoices. Signed-in owners with an active plan can download issued invoices as PDF or JPEG and open the browser print dialog. Use PDF for long multi-page documents. The public demo only renders a sample preview. Issued invoices remain read-only, including archived records. New invoices capture account and timestamp audit fields. Older records display available timestamps. WhatsApp and email links compose an invoice summary. Use Share PDF on supported devices or download the PDF to attach it manually.

## Structure

- `app/` contains public pages, protected routes, authentication, and server actions.
- `components/` contains the workspace sidebar, reusable fields, onboarding, live editor, and PDF layout.
- `lib/` contains shared validation, invoice calculations, plan definitions, and Supabase helpers.
- `supabase/migrations/` contains tenant policies, private storage, subscription and contact tables, and transactional invoice numbering.

Before inviting customers, test OAuth, logo upload, access isolation across accounts, manual plan activation, and each export mode on your configured Supabase project.
