## 2026-07-11 Final Branch Review Fixes

- Fixed subscription entitlement sync so `monthly_used` is preserved on ordinary `customer.subscription.updated` status changes, and only reset for checkout-created subscriptions, plan changes, or advanced billing periods.
- Added duplicate subscription protection before Stripe Checkout Session creation for existing `active`, `trialing`, or `past_due` subscriptions with a Stripe subscription id.
- Verification: `node --test tests/unit/*.test.js` passed with 34/34 tests.
