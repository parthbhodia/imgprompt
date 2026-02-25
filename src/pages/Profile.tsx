import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowLeft,
  User,
  Mail,
  CreditCard,
  Zap,
  Star,
  Rocket,
  LogOut,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSubscriptionStatus,
  openCustomerPortal,
  createSubscriptionCheckout,
  syncCreditsFromStripe,
  type SubscriptionStatus,
} from "@/lib/api";

const PLAN_META: Record<
  string,
  { label: string; color: string; icon: typeof Zap; credits: number; price: string }
> = {
  starter: {
    label: "Starter",
    color: "from-blue-500 to-cyan-500",
    icon: Zap,
    credits: 10,
    price: "$2.99/mo",
  },
  popular: {
    label: "Popular",
    color: "from-violet-500 to-purple-600",
    icon: Star,
    credits: 25,
    price: "$5.99/mo",
  },
  pro: {
    label: "Pro",
    color: "from-orange-500 to-rose-500",
    icon: Rocket,
    credits: 40,
    price: "$9.99/mo",
  },
};

export default function Profile() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Show success toast when returning from Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast.success("Subscription activated! Your credits have been added. Refresh to see the latest amount.", { duration: 5000 });
    } else if (canceled === "true") {
      toast.info("Checkout was canceled. No charges were made.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    const token = session?.access_token ?? null;
    setLoadingSub(true);
    getSubscriptionStatus(token)
      .then(setSub)
      .catch(() => setSub(null))
      .finally(() => setLoadingSub(false));
  }, [user, session, navigate]);

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const token = session?.access_token ?? null;
      const { portal_url } = await openCustomerPortal(token);
      window.location.href = portal_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    setUpgradeLoading(plan);
    try {
      const token = session?.access_token ?? null;
      const { checkout_url } = await createSubscriptionCheckout(token, plan);
      window.location.href = checkout_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSyncCredits = async () => {
    setSyncLoading(true);
    try {
      const token = session?.access_token ?? null;
      const result = await syncCreditsFromStripe(token);
      toast.success(`Synced ${result.credits} credits from Stripe! (Plan: ${result.plan})`);
      setSub((prev) =>
        prev
          ? { ...prev, credits: result.credits }
          : { plan: result.plan, status: "active", credits: result.credits }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync credits");
    } finally {
      setSyncLoading(false);
    }
  };

  const planMeta = sub?.plan ? PLAN_META[sub.plan] : null;
  const isActive = sub?.status === "active";
  const avatar =
    user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || "User";
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-background/70 border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            VibeIMG
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-10 max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">My Account</h1>
        </div>

        {/* Profile card */}
        <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Profile
          </h2>
          <div className="flex items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-16 h-16 rounded-full border-2 border-primary/30 object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="space-y-1">
              <p className="font-semibold text-lg">{displayName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </p>
            </div>
          </div>
        </section>

        {/* Credits & plan */}
        <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Subscription &amp; Credits
          </h2>

          {loadingSub ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {/* Credits bar */}
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-5 py-4">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Credits remaining
                  </p>
                  <p className="text-3xl font-bold">{sub?.credits ?? 0}</p>
                  <p className="text-xs text-muted-foreground">1 credit = 1 generated image</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Zap className="w-10 h-10 text-primary opacity-60" />
                  {!isActive && (sub?.credits ?? 0) < 5 && (
                    <Button
                      size="xs"
                      onClick={() => handleUpgrade("starter")}
                      disabled={upgradeLoading !== null}
                      className="gap-1.5 text-xs"
                    >
                      {upgradeLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      Buy Now
                    </Button>
                  )}
                </div>
              </div>

              {/* Plan status */}
              {planMeta && isActive ? (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-5 py-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Active plan
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${planMeta.color}`}
                      >
                        <planMeta.icon className="w-3.5 h-3.5" />
                        {planMeta.label}
                      </span>
                      <span className="text-sm text-muted-foreground">{planMeta.price}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {planMeta.credits} credits refreshed every billing cycle
                    </p>
                  </div>
                  <ShieldCheck className="w-8 h-8 text-green-500 opacity-70" />
                </div>
              ) : (
                <div className="rounded-xl bg-muted/40 px-5 py-4 space-y-1">
                  <p className="text-sm font-medium">No active subscription</p>
                  <p className="text-xs text-muted-foreground">
                    Subscribe to a plan to get monthly credits.
                  </p>
                </div>
              )}

              {/* Billing actions */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap gap-3">
                  {isActive ? (
                    <Button
                      onClick={handlePortal}
                      disabled={portalLoading}
                      className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity"
                    >
                      {portalLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      Manage Subscription
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </Button>
                  ) : (
                    <>
                      {(["starter", "popular", "pro"] as const).map((plan) => {
                        const m = PLAN_META[plan];
                        return (
                          <Button
                            key={plan}
                            onClick={() => handleUpgrade(plan)}
                            disabled={upgradeLoading !== null}
                            variant={plan === "popular" ? "default" : "outline"}
                            className="gap-2"
                          >
                            {upgradeLoading === plan ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <m.icon className="w-4 h-4" />
                            )}
                            {m.label} – {m.price}
                          </Button>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Help text & sync button */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm space-y-3">
                  <div className="space-y-1">
                    <p className="font-medium text-blue-600 dark:text-blue-400">
                      {isActive ? "💡 How to cancel your subscription" : "⚠️ Subscription not syncing?"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isActive
                        ? "Click 'Manage Subscription' above to access your Stripe billing dashboard. You can cancel anytime — your remaining credits will continue to work until the end of your billing cycle."
                        : "If you just purchased a plan but don't see credits yet, click the button below to manually sync your subscription from Stripe."}
                    </p>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncCredits}
                      disabled={syncLoading}
                      className="gap-1.5 text-xs"
                    >
                      {syncLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      {isActive ? "Sync Credits from Stripe" : "Sync Subscription Now"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Quick links */}
        <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Quick Links
          </h2>
          <div className="flex flex-wrap gap-3">
            {!isActive && (
              <Button
                onClick={() => handleUpgrade("starter")}
                disabled={upgradeLoading !== null}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              >
                {upgradeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Buy Credits Now
              </Button>
            )}
            <Link to="/pricing">
              <Button variant="outline" className="gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                View Pricing
              </Button>
            </Link>
            <Link to="/favorites">
              <Button variant="outline" className="gap-2">
                <Star className="w-4 h-4 text-rose-500" />
                My Favorites
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Explore Prompts
              </Button>
            </Link>
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-destructive/70">
            Account
          </h2>
          <p className="text-sm text-muted-foreground">
            Sign out of your account on this device.
          </p>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </section>
      </main>
    </div>
  );
}
