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
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
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
