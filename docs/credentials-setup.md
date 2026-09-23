# Getting Google Ads and Meta credentials

_Written 2026-09-23. Both platforms changed their access rules during 2026, so
re-check anything load-bearing before relying on it._

There are three kinds of step here and it is worth keeping them apart, because
they have very different lead times:

- **Done** — infrastructure already set up in this project.
- **Yours** — needs your login or your company's documents. Minutes to hours.
- **Theirs** — needs Google or Meta to approve something. Days to weeks.

Start every **theirs** step now, in parallel. They are the critical path, and
nothing about them gets faster by doing the engineering first.

---

## Google Ads

### Done
- Google Ads API enabled on Cloud project `aiad-manager`.
- `scripts/google-oauth.ts` mints a refresh token.
- `scripts/check-credentials.ts` verifies the whole chain against the live API.
- The provider reads `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`,
  `GOOGLE_ADS_ACCESS_TOKEN` and falls back to the simulator when any is missing.

### Yours

**1. Find or create the manager account (MCC).**
You mentioned the agency business already used one. If it still exists, use it —
account age counts toward monthly-invoicing eligibility later. Its ID is the
10-digit number top-right in Google Ads, formatted `123-456-7890`.

**2. Create an OAuth client.**
Cloud console → project `aiad-manager` → APIs & Services → Credentials →
Create credentials → OAuth client ID → **Desktop app**. This gives a client ID
and secret.

A Desktop client is deliberate: the refresh token is minted once by a human and
then used server-side. A Web client would need redirect URIs managed per
environment for no benefit.

**3. Mint the refresh token.**

```bash
cd console
export GOOGLE_OAUTH_CLIENT_ID='...apps.googleusercontent.com'
export GOOGLE_OAUTH_CLIENT_SECRET='...'
npm run google-oauth
```

Sign in as a user with access to the MCC. The refresh token prints once.

If it prints no refresh token, you have authorised this client before — revoke
it at `myaccount.google.com/permissions` and run it again. Google only returns a
refresh token on first consent.

**4. Apply for a developer token.**
In the MCC: Tools → Setup → API Center. The token appears immediately at **Test**
access level.

### Theirs

**5. Raise the access level.**

| Level | Limit | How |
|---|---|---|
| Test | Test accounts only | Immediate |
| Basic | 15,000 operations/day | Brand-verify the Cloud project; reviewed in minutes |
| Standard | Unlimited | Manual audit, about 10 business days |

**Basic is enough to start.** 15,000 operations a day covers a pilot cohort
comfortably.

One thing worth knowing: Standard access normally requires Required Minimum
Functionality, which is a large feature bar. It explicitly **exempts tools for
internal agency use with no third-party access** — which is what this console is.
That exemption ends the day showrooms get logins, so the self-serve phase
re-opens the question.

### You can test before any of this

Google test accounts need no approval at all. Create one under the MCC and point
the console at it — that verifies the provider code end to end while the real
access is still in review. This is the single most useful thing to do this week.

---

## Meta

Meta is the longer pole. Start it first.

### Yours

**1. Business Verification.**
Business Manager → Settings → Business Info → Start Verification. Needs your
legal documents — GST certificate, certificate of incorporation, or Udyam
registration. Takes 3–14 days and gates everything below.

**2. Create an app.**
developers.facebook.com → Create App → **Business** type → add the
**Marketing API** product. Attach it to the verified Business Portfolio.

**3. Create a System User and mint its token.**
Business Settings → Users → System Users → Add → **Admin** system user →
Generate New Token → select the app → scopes `ads_management`, `ads_read`,
`business_management`.

Use a System User, not your own login. A personal user token dies when the
password changes or the person leaves, and Meta does not notify you — the calls
simply start failing. A System User token belongs to the business and can be
issued non-expiring.

**4. Assign the ad accounts and Pages** the system user should reach.

### Theirs

**5. App Review for Advanced (now "Full") Access to `ads_management`.**

This is the gate for managing ad accounts you do not own, and it has a
chicken-and-egg problem worth planning around: **App Review expects to see a
real multi-client onboarding flow.** An app tested only against your own ad
account gets rejected.

So the pilot cohort is not just a test — it is what earns the access to scale.
Sequence it that way deliberately.

Meta also requires ongoing activity to keep the access: at least 500 Marketing
API calls in a trailing 15 days, with an error rate under 15%.

---

## Putting credentials on the service

Never in the repo, never in a chat. Straight onto Cloud Run:

```bash
gcloud run services update ad-manager-console \
  --project=aiad-manager --region=asia-south1 \
  --update-env-vars="GOOGLE_ADS_DEVELOPER_TOKEN=...,GOOGLE_ADS_LOGIN_CUSTOMER_ID=...,GOOGLE_OAUTH_CLIENT_ID=...,GOOGLE_OAUTH_CLIENT_SECRET=...,GOOGLE_ADS_REFRESH_TOKEN=...,META_ACCESS_TOKEN=..."
```

Verify before trusting it:

```bash
cd console && npm run check-credentials
```

The **Setup** screen in the console reports which platforms are live and which
are still simulated, so it is obvious at a glance whether figures on screen are
real.

### Worth hardening later
Env vars are readable by anyone with `gcloud run services describe` on the
project. These credentials can spend money. Once they are working, move them to
Secret Manager and mount them as secret references — same code, no change to the
provider.

---

## Order to do this in

1. **Today** — Meta Business Verification (longest lead time) and the Google
   developer token at Test level.
2. **Today** — a Google test account, and point the console at it. This verifies
   the provider code while everything else is in review.
3. **This week** — brand-verify the Cloud project for Google Basic access.
4. **With the pilot cohort** — Meta App Review, which needs the real flow to
   exist first.
5. **When spend justifies it** — Google Standard access and monthly invoicing.

---

## Meta App Review — what to submit

App Review is the gate for Advanced ("Full") access to `ads_management`, which
is what lets the console manage ad accounts you do not own. The console now has
the flow a reviewer needs to follow.

### What was built for this
- **Real sign-in.** Firebase Auth, email and password, with roles. No shared
  passphrase, and every action is now recorded against the person who took it.
- **Facebook Login onboarding.** A showroom opens their own link, presses
  **Continue with Facebook**, and grants `ads_management`, `ads_read` and
  `business_management`. We discover their business, ad account and Page from
  the token rather than anyone typing ids in.
- **Delegated access model.** The showroom keeps ownership; we hold revocable
  access. The page says so in plain language.

### Before submitting

**1. Create the Meta app** and set these on the service:

```bash
gcloud run services update ad-manager-console \
  --project=aiad-manager --region=asia-south1 \
  --update-env-vars="META_APP_ID=...,META_APP_SECRET=..."
```

**2. Register the redirect URI**, exactly:

```
https://ad-manager-console-604219434671.asia-south1.run.app/api/integrations/meta/callback
```

It must match character for character or Meta rejects the flow. The console
builds it from `PUBLIC_ORIGIN`, which is already set.

**3. Provision the reviewer login:**

```bash
cd console && npm run provision-users
```

This prints passwords once. The `meta.reviewer@girnarsoft.com` account gets
account-manager rights — enough to see and operate the flow under review, not
enough to change team access.

### Instructions to give the reviewer

Meta asks for step-by-step instructions. Something close to this:

> This is an internal tool used by our account managers to run advertising for
> car dealerships who are our clients. Each dealership owns its own Meta ad
> account and grants us delegated access; we never take ownership.
>
> 1. Sign in at `/signin` with the credentials supplied.
> 2. Open **Onboarding**. This lists dealerships at various stages of
>    connecting their own Meta accounts.
> 3. Open the onboarding link for any dealership. This is the page we send the
>    dealership over WhatsApp.
> 4. Press **Continue with Facebook** and authorise. This is the permission
>    grant under review.
> 5. After authorising you return to the same page, now showing the connected
>    business and ad account.
> 6. Back in the console, open **Campaigns → New campaign**, pick that
>    dealership and build a campaign. This is what `ads_management` is used for.
> 7. **Analytics** and **Reports** show what `ads_read` is used for: reporting
>    delivery back to the dealership.

### Why each permission is requested

| Permission | Used for |
|---|---|
| `ads_management` | Creating and managing campaigns, ad sets and ads on the dealership's own ad account. |
| `ads_read` | Reading delivery to report performance back to the dealership and to reconcile lead counts. |
| `business_management` | Discovering which business, ad account and Page the dealership granted, so nobody has to type ids in by hand. |

### The sequencing trap

App Review wants to see a real multi-client flow. An app tested only against
your own ad account gets rejected. So connect **two or three real pilot
dealerships first**, then submit — the pilot cohort is what earns the access,
not something you do after getting it.

Meta also requires ongoing use to keep the access: at least 500 Marketing API
calls in a trailing 15 days, with an error rate under 15%.
