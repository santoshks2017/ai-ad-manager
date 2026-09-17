import { Shell } from "@/components/Shell"
import { providerStatus } from "@/lib/providers"
import { storeMode } from "@/lib/store"
import { getStore } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function Setup() {
  await getStore() // resolves the store so storeMode() is accurate
  const providers = providerStatus()
  const mode = storeMode()

  return (
    <Shell
      title="Setup"
      subtitle="What is connected, and what is still needed to run real campaigns"
    >
      <div className="space-y-8 max-w-4xl">
        <section>
          <div className="eyebrow mb-3">Connections</div>
          <div className="sheet">
            <Line
              label="Data store"
              value={mode === "firestore" ? "Firestore" : "In-memory"}
              ok={mode === "firestore"}
              detail={
                mode === "firestore"
                  ? "Records persist across restarts."
                  : "Records are lost on restart. Set FIREBASE_PROJECT_ID to use Firestore."
              }
            />
            {providers.map((p) => (
              <Line
                key={p.platform}
                label={p.platform === "google" ? "Google Ads" : "Meta (Facebook + Instagram)"}
                value={p.live ? "Live" : "Simulated"}
                ok={p.live}
                detail={p.reason}
              />
            ))}
          </div>
          {providers.every((p) => !p.live) && (
            <p className="text-sm text-ink-soft mt-3">
              With no platform credentials, every figure in this console is generated.
              The application logic is real — the delivery behind it is not.
            </p>
          )}
        </section>

        <section>
          <div className="eyebrow mb-3">Getting Google Ads live</div>
          <ol className="space-y-3">
            <Step n={1} title="Create a Google Cloud project and apply for API access">
              Access now attaches to the Cloud project rather than a standalone
              developer token. Basic access (15,000 operations/day) is reviewed
              automatically in minutes once brand verification is done. Standard
              access is unlimited and takes a manual audit of about ten business days.
            </Step>
            <Step n={2} title="Required Minimum Functionality does not apply to us">
              RMF forces third-party tools to implement a broad feature set before
              Standard access is granted — but it exempts tools for{" "}
              <em>internal agency use with no third-party access</em>. That is exactly
              this console. It stops being true the day dealers get logins, so the
              self-serve phase re-opens this question.
            </Step>
            <Step n={3} title="One client account per dealer, under our MCC">
              Google's third-party policy states plainly: &ldquo;we require that you
              use a separate account for each end-advertiser that you manage.&rdquo;
              Multiple dealers cannot share one account. We create each account from
              our manager account, so the dealer never signs in.
            </Step>
            <Step n={4} title="Verify advertiser identity per dealer">
              Use the &ldquo;verifying on behalf of a client&rdquo; flow with the
              dealer's GST or incorporation documents. Skip it and the
              &ldquo;Why this ad?&rdquo; disclosure can name us instead of the dealer.
            </Step>
          </ol>
        </section>

        <section>
          <div className="eyebrow mb-3">Getting Meta live</div>
          <ol className="space-y-3">
            <Step n={1} title="Business Verification, then App Review">
              Full access to ads_management is what lets us manage another business's
              ad account. App Review expects a real multi-client onboarding flow — an
              app tested only against our own ad account gets rejected.
            </Step>
            <Step n={2} title="A Page per dealer is unavoidable">
              Every Meta ad runs from a Page, and Meta requires ads to accurately
              represent the business being advertised. Dealer ads cannot run from a
              CarDekho-branded Page. We create a Page, Business Portfolio and ad
              account per dealer as their authorised representative.
            </Step>
            <Step n={3} title="The signed services agreement is the authorisation">
              Meta's Pages Policy allows a Page for a business to be administered only
              by an authorised representative. The contract is what makes that true —
              no dealer platform action is needed, but the paperwork is load-bearing.
            </Step>
            <Step n={4} title="Use a System User token, not a personal one">
              System User tokens belong to the Business Portfolio and do not expire
              with an employee's login. A personal user token breaks when that person
              changes their password or leaves.
            </Step>
            <Step n={5} title="Retrieve leads within 90 days">
              Meta permanently deletes lead data 90 days after submission. It is not
              recoverable, so automated retrieval is a data-loss deadline rather than
              a convenience.
            </Step>
          </ol>
        </section>

        <section>
          <div className="eyebrow mb-3">Worth knowing</div>
          <ul className="space-y-2.5 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <span className="text-ink-faint shrink-0">—</span>
              <span>
                Meta allows 4 ad-set budget changes per hour and 10 spend changes per
                day. The optimisation loop batches around these; it is not a limitation
                to engineer past.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-ink-faint shrink-0">—</span>
              <span>
                A hundred near-identical dealer accounts under one manager account,
                pointing at templated landing pages, resembles the pattern Google's
                circumventing-systems detection looks for. Vary landing page templates
                and domains.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-ink-faint shrink-0">—</span>
              <span>
                Google Partner status is a commercial badge and is not required for API
                access. Meta Business Verification is required; the Business Partner
                badge is not.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Shell>
  )
}

function Line({
  label, value, ok, detail,
}: {
  label: string
  value: string
  ok: boolean
  detail: string
}) {
  return (
    <div className="sheet-row first:border-t-0 px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <div className="font-medium text-sm w-52 shrink-0">{label}</div>
      <div
        className={`num text-sm font-medium w-24 shrink-0 ${ok ? "text-signal" : "text-amber"}`}
      >
        {value}
      </div>
      <div className="text-sm text-ink-soft flex-1 min-w-0">{detail}</div>
    </div>
  )
}

function Step({
  n, title, children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="card p-4 flex gap-4">
      <span className="num text-sm text-ink-faint shrink-0 pt-0.5">{n}</span>
      <div className="min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <p className="text-sm text-ink-soft mt-1">{children}</p>
      </div>
    </li>
  )
}
