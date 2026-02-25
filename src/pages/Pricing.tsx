import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Zap, Star, Rocket, ArrowLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createSubscriptionCheckout,
  openCustomerPortal,
  getSubscriptionStatus,
  type SubscriptionStatus,
} from "@/lib/api";

const PLANS = [
  {
    slug: "starter",
    name: "Starter",
    price: "$2.99",
    period: "/month",
    credits: 10,
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    highlight: false,
    features: [
      "10 AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
    ],
  },
  {
    slug: "popular",
    name: "Popular",
    price: "$5.99",
    period: "/month",
    credits: 25,
    icon: Star,
    color: "from-violet-500 to-purple-600",
    highlight: true,
    features: [
      "25 AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
      "Priority support",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$9.99",
    period: "/month",
    credits: 40,
    icon: Rocket,
    color: "from-orange-500 to-rose-500",
    highlight: false,
    features: [
      "40 AI images per month",
      "Flux 1.1 Pro quality",
      "Image-to-image editing",
      "AI prompt refinement",
      "Chat history saved",
      "Priority support",
      "Early access to new features",
    ],
  },
] as const;

type PlanSlug = (typeof PLANS)[number]["slug"];

export default function Pricing() {
  const { user, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  const token = session?.access_token ?? null;

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const plan = searchParams.get("plan") ?? "";
      toast.success(`Subscription activated! Your credits have been topped up.`, {
        duration: 6000,
      });
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout canceled. No charge was made.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    getSubscriptionStatus(token)
      .then(setStatus)
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

  const activePlan = status?.plan ?? null;
  const activeStatus = status?.status ?? null;

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
          {status && (
            <div className="mt-6 inline-flex items-center gap-2 bg-muted rounded-full px-4 py-1.5 text-sm">
              <span className="text-muted-foreground">Current balance:</span>
              <span className="font-semibold">{status.credits} credits</span>
              {activePlan && activeStatus === "active" && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="capitalize text-primary font-medium">{activePlan} plan</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = activePlan === plan.slug && activeStatus === "active";
            const isLoading = loadingPlan === plan.slug;

            return (
              <div
                key={plan.slug}
                className={cn(
                  "relative rounded-2xl border bg-card p-8 flex flex-col transition-all duration-200",
                  plan.highlight
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                    : "hover:border-border/80 hover:shadow-md",
                  isCurrent && "ring-2 ring-primary"
                )}
              >
                {plan.highlight && (
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
                  <div className={cn("p-2 rounded-xl bg-gradient-to-br text-white", plan.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-semibold">{plan.name}</span>
                </div>

                {/* Price */}
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8">
                  <span className="font-semibold text-foreground">{plan.credits} credits</span> refreshed monthly
                </p>

                {/* CTA */}
                <Button
                  className={cn(
                    "w-full mb-8",
                    plan.highlight && "bg-primary hover:bg-primary/90"
                  )}
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={isLoading || isCurrent || !!loadingPlan}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrent ? "Current plan" : isLoading ? "Redirecting…" : "Get started"}
                </Button>

                {/* Features */}
                <ul className="space-y-3 mt-auto">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

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
    </div>
  );
}
