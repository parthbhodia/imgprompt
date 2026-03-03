import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { Loader2, Check, Zap, Star, Rocket, ArrowLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createSubscriptionCheckout,
  openCustomerPortal,
  getSubscriptionStatus,
  getPlans,
  syncCreditsFromStripe,
  type SubscriptionStatus,
  type PlanInfo,
} from "@/lib/api";
import { debugCredits, forceCreditRefresh } from "@/utils/creditDebug";

const PLAN_UI_CONFIG: Record<string, { icon: typeof Zap; color: string; highlight: boolean; features: string[] }> = {
  starter: {
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    highlight: false,
    features: [
      "AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
    ],
  },
  popular: {
    icon: Star,
    color: "from-violet-500 to-purple-600",
    highlight: true,
    features: [
      "AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
      "Priority support",
    ],
  },
  pro: {
    icon: Rocket,
    color: "from-orange-500 to-rose-500",
    highlight: false,
    features: [
      "AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
      "Priority support",
      "Early access to new features",
    ],
  },
};

type PlanSlug = keyof typeof PLAN_UI_CONFIG;

export default function Pricing() {
  const { user, session } = useAuth();
  const { credits, plan, status, loading: creditsLoading, syncCredits } = useCredits();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);

  const token = session?.access_token ?? null;

  // Fetch plans from backend
  useEffect(() => {
    getPlans()
      .then((res) => setPlans(res.plans))
      .catch((err) => {
        console.error("Failed to fetch plans:", err);
        toast.error("Could not load pricing plans");
      })
      .finally(() => setPlansLoading(false));
  }, []);

  // Handle successful payment and sync credits automatically
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const plan = searchParams.get("plan") ?? "";
      toast.success("Payment successful! Syncing your credits...", {
        duration: 3000,
      });
      
      // Automatically sync credits from Stripe using global context
      setSyncLoading(true);
      syncCredits()
        .then(() => {
          toast.success(`Credits synced! You now have ${credits} credits.`, {
            duration: 5000,
          });
        })
        .catch((error) => {
          console.error("Failed to sync credits:", error);
          toast.error("Payment successful, but couldn't sync credits automatically. Please click 'Sync Credits'.", {
            duration: 6000,
          });
        })
        .finally(() => {
          setSyncLoading(false);
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout canceled. No charge was made.");
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, syncCredits, credits]);

  useEffect(() => {
    if (!token) return;
    getSubscriptionStatus(token)
      .then(setSubscriptionStatus)
      .catch(() => {});
  }, [token]);

  const handleSubscribe = async (plan: PlanSlug) => {
    if (!user) {
      toast.error("Sign in to subscribe");
      return;
    }
    setLoadingPlan(plan);
    try {
      const { checkout_url } = await createSubscriptionCheckout(token, plan);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("503") || msg.toLowerCase().includes("not configured")) {
        toast.error("Payments are not yet configured. Check back soon.");
      } else {
        toast.error("Could not start checkout. Please try again.");
      }
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const { portal_url } = await openCustomerPortal(token);
      window.location.href = portal_url;
    } catch {
      toast.error("Could not open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const activePlan = plan;
  const activeStatus = status;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to app</span>
          </Link>
          {activePlan && activeStatus === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="gap-2"
            >
              {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Settings className="w-3 h-3" />}
              Manage billing
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Credits refresh every month. Generate stunning images with Flux 1.1 Pro — each image uses 1 credit.
          </p>
          {!creditsLoading && (
            <div className="mt-6 inline-flex items-center gap-2 bg-muted rounded-full px-4 py-1.5 text-sm">
              <span className="text-muted-foreground">Current balance:</span>
              <span className="font-semibold">{credits} credits</span>
              {plan && status === "active" && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="capitalize text-primary font-medium">{plan} plan</span>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSyncLoading(true);
                  syncCredits()
                    .then(() => {
                      toast.success(`Credits synced! You now have ${credits} credits.`, {
                        duration: 3000,
                      });
                    })
                    .catch((error) => {
                      console.error("Failed to sync credits:", error);
                      toast.error("Could not sync credits. Please try again.");
                    })
                    .finally(() => {
                      setSyncLoading(false);
                    });
                }}
                disabled={syncLoading}
                className="h-6 px-2 text-xs gap-1"
              >
                {syncLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Settings className="w-3 h-3" />
                )}
                Sync
              </Button>
            </div>
          )}
        </div>

        {/* Emergency credit sync for active users */}
        {plan && status === "active" && credits === 0 && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
              ⚠️ No credits detected for active {plan} plan
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Your subscription is active but credits aren't showing. Try the emergency sync below.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setSyncLoading(true);
                try {
                  const result = await forceCreditRefresh(token);
                  toast.success(`Emergency sync complete: ${result.credits} credits`, {
                    duration: 5000,
                  });
                } catch (error) {
                  toast.error("Emergency sync failed. Please contact support.");
                } finally {
                  setSyncLoading(false);
                }
              }}
              disabled={syncLoading}
              className="gap-2"
            >
              {syncLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Emergency Credit Sync
            </Button>
          </div>
        )}

        {/* Plan cards */}
        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const slug = plan.slug as PlanSlug;
              const ui = PLAN_UI_CONFIG[slug];
              const Icon = ui.icon;
              const isCurrent = activePlan === slug && activeStatus === "active";
              const isLoading = loadingPlan === slug;

              return (
                <div
                  key={plan.slug}
                  className={cn(
                    "relative rounded-2xl border bg-card p-8 flex flex-col transition-all duration-200",
                    ui.highlight
                      ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                      : "hover:border-border/80 hover:shadow-md",
                    isCurrent && "ring-2 ring-primary"
                  )}
                >
                  {ui.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        Most popular
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3.5 right-4">
                      <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn("p-2 rounded-xl bg-gradient-to-br text-white", ui.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-semibold">{plan.label}</span>
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm ml-1">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-8">
                    <span className="font-semibold text-foreground">{plan.credits} credits</span> refreshed monthly
                  </p>

                  {/* CTA */}
                  <Button
                    className={cn(
                      "w-full mb-8",
                      ui.highlight && "bg-primary hover:bg-primary/90"
                    )}
                    variant={ui.highlight ? "default" : "outline"}
                    onClick={() => handleSubscribe(slug)}
                    disabled={isLoading || isCurrent || !!loadingPlan}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrent ? "Current plan" : isLoading ? "Redirecting…" : "Get started"}
                  </Button>

                  {/* Features */}
                  <ul className="space-y-3 mt-auto">
                    {ui.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{plan.credits} {f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ / notes */}
        <div className="mt-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Credits reset on your billing date each month. Unused credits do not roll over.
          </p>
          <p className="text-sm text-muted-foreground">
            Cancel anytime from the billing portal — no long-term commitment.
          </p>
          {!user && (
            <p className="text-sm text-muted-foreground pt-2">
              You need to{" "}
              <Link to="/" className="text-primary underline underline-offset-2">
                sign in
              </Link>{" "}
              before subscribing.
            </p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
