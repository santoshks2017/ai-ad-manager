import { notFound } from "next/navigation"
import { getStore } from "@/lib/store"
import { onboardingSteps } from "@/lib/onboarding"
import { verifyOnboardToken } from "@/lib/onboard-link"

export const dynamic = "force-dynamic"

/**
 * The page a dealer opens from WhatsApp.
 *
 * Written for a dealer principal who is not technical and is probably on a
 * phone: one step at a time, plain language, no platform jargon, and an
 * explicit "call us and we will do it together" escape hatch — because for a
 * good proportion of dealers that is what will actually happen.
 */
export default async function OnboardDealer({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ meta?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const dealerId = verifyOnboardToken(token)
  // An unsigned or tampered link is indistinguishable from a missing dealer,
  // so enumeration learns nothing either way.
  if (!dealerId) notFound()

  const store = await getStore()
  const dealer = await store.getDealer(dealerId)
  if (!dealer) notFound()

  const steps = onboardingSteps(dealer).filter((s) => s.whyDealerMustDoIt !== null)
  const done = steps.filter((s) => s.done).length
  const allDone = steps.length > 0 && done === steps.length

  return (
    <div className="min-h-screen bg-ground">
      <div className="max-w-xl mx-auto px-5 py-10">
        <div className="font-display font-extrabold text-sm tracking-tight">
          AD MANAGER
        </div>

        <h1 className="font-display font-bold text-2xl mt-6">
          Connect your advertising accounts
        </h1>
        <p className="text-ink-soft mt-2">
          {dealer.name} · {dealer.city}
        </p>

        {allDone ? (
          <div className="card p-6 mt-8 text-center">
            <div className="font-display font-bold text-lg text-signal">All connected</div>
            <p className="text-sm text-ink-soft mt-2">
              Everything is set up. We will start your campaigns and keep you posted on
              how they are doing.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft mt-6">
              There are {steps.length - done} things to do. You will own these accounts
              and everything in them — we just need permission to run your campaigns.
            </p>

            {sp.meta && <MetaResult status={sp.meta} />}

            {dealer.platform?.meta?.grant !== "active" && (
              <div className="card p-5 mt-6">
                <div className="font-medium">Connect your Meta account</div>
                <p className="text-sm text-ink-soft mt-1.5">
                  Sign in with Facebook and approve access for your business. We will
                  be able to run and manage ads on your ad account — nothing else. You
                  can remove this at any time from your own Business Settings.
                </p>
                <a
                  href={`/api/integrations/meta/start?token=${encodeURIComponent(token)}`}
                  className="btn-primary mt-4"
                >
                  Continue with Facebook
                </a>
                <p className="text-2xs text-ink-faint mt-3">
                  You stay the owner of your ad account, your Page and every lead they
                  produce. We never see your Facebook password.
                </p>
              </div>
            )}

            <ol className="mt-6 space-y-3">
              {steps.map((step, i) => (
                <li
                  key={step.kind}
                  className={`card p-5 ${step.done ? "opacity-55" : ""}`}
                >
                  <div className="flex gap-4">
                    <span
                      className={`num text-sm shrink-0 w-6 h-6 inline-flex items-center
                                  justify-center border ${
                        step.done
                          ? "bg-signal-soft border-signal/30 text-signal"
                          : "border-rule-strong text-ink-soft"
                      }`}
                    >
                      {step.done ? "✓" : i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium">{step.title}</div>
                      <p className="text-sm text-ink-soft mt-1">{step.dealerAction}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="card p-5 mt-8">
          <div className="font-medium text-sm">Would rather do this together?</div>
          <p className="text-sm text-ink-soft mt-1">
            Call your account manager and we will walk through it with you on the phone.
            It usually takes under fifteen minutes.
          </p>
        </div>

        <p className="text-2xs text-ink-faint mt-8">
          We will never ask for your password. Everything here happens on Google's and
          Meta's own websites, where you sign in yourself.
        </p>
      </div>
    </div>
  )
}


/** Feedback after Meta redirects the showroom back to us. */
function MetaResult({ status }: { status: string }) {
  const map: Record<string, { tone: string; title: string; body: string }> = {
    connected: {
      tone: "bg-signal-soft border-signal/20 text-signal",
      title: "Meta account connected",
      body: "We can see your ad account and Page. Nothing else to do on this step.",
    },
    partial: {
      tone: "bg-amber-soft border-amber/25 text-amber",
      title: "Connected, but something is missing",
      body: "We got access but could not find both an ad account and a Page on your business. Your account manager will call you to finish this.",
    },
    declined: {
      tone: "bg-ground border-rule text-ink-soft",
      title: "Access not granted",
      body: "No problem — nothing has changed. You can try again whenever you are ready.",
    },
    failed: {
      tone: "bg-alert-soft border-alert/25 text-alert",
      title: "That did not work",
      body: "Something went wrong on our side. Your account manager will be in touch.",
    },
    unconfigured: {
      tone: "bg-amber-soft border-amber/25 text-amber",
      title: "Not ready yet",
      body: "Meta connection is not switched on yet. Your account manager will let you know when it is.",
    },
  }
  const m = map[status]
  if (!m) return null
  return (
    <div className={`mt-6 px-4 py-3 border text-sm ${m.tone}`}>
      <div className="font-medium">{m.title}</div>
      <p className="text-ink-soft mt-0.5">{m.body}</p>
    </div>
  )
}
