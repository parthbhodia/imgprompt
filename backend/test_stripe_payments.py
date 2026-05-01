import unittest
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.modules.setdefault("stripe", SimpleNamespace(api_key=""))
sys.modules.setdefault(
    "config",
    SimpleNamespace(
        settings=SimpleNamespace(
            stripe_secret_key="sk_test",
            stripe_price_starter="price_starter",
            stripe_price_popular="price_popular",
            stripe_price_pro="price_pro",
        )
    ),
)
sys.modules.setdefault("auth", SimpleNamespace(get_supabase_admin=Mock()))

import stripe_payments


class ResolvePlanFromSubscriptionTest(unittest.TestCase):
    def _resolve(self, subscription):
        fake_stripe = SimpleNamespace(
            Subscription=SimpleNamespace(retrieve=Mock(return_value=subscription))
        )
        with patch.object(stripe_payments, "_stripe", return_value=fake_stripe):
            return stripe_payments._resolve_plan_from_subscription("sub_test")

    def test_resolves_from_subscription_metadata(self):
        subscription = SimpleNamespace(metadata={"plan": "pro"}, items=SimpleNamespace(data=[]))

        self.assertEqual(self._resolve(subscription), "pro")

    def test_resolves_from_configured_price_id(self):
        subscription = SimpleNamespace(
            metadata={},
            items=SimpleNamespace(
                data=[
                    SimpleNamespace(
                        price=SimpleNamespace(id="price_popular", metadata={})
                    )
                ]
            ),
        )

        with patch.object(stripe_payments.settings, "stripe_price_popular", "price_popular"):
            self.assertEqual(self._resolve(subscription), "popular")

    def test_resolves_from_price_lookup_key(self):
        subscription = SimpleNamespace(
            metadata={},
            items=SimpleNamespace(
                data=[
                    SimpleNamespace(
                        price=SimpleNamespace(
                            id="price_external",
                            lookup_key="starter-monthly",
                            metadata={},
                        )
                    )
                ]
            ),
        )

        self.assertEqual(self._resolve(subscription), "starter")

    def test_resolves_from_dict_shaped_price_metadata(self):
        subscription = {
            "metadata": {},
            "items": {
                "data": [
                    {
                        "price": {
                            "id": "price_external",
                            "metadata": {"plan": "popular"},
                        }
                    }
                ]
            },
        }

        self.assertEqual(self._resolve(subscription), "popular")


if __name__ == "__main__":
    unittest.main()
