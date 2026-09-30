---
title: "Lesson 78 · Payment Integration API"
description: "Integrate online payments with Python and Stripe: create PaymentIntents, securely verify webhook signatures, handle refunds and failure states, enforce idempotency keys, and test safely with sandboxes."
---

# Lesson 78 · Payment Integration API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Architect the modern Stripe PaymentIntent lifecycle and client/server interaction
- [ ] Initialize and configure `stripe-python` with environment-based API keys
- [ ] Implement secure webhook endpoints with cryptographic signature verification
- [ ] Process refunds and handle declined card exceptions safely
- [ ] Prevent duplicate billing by enforcing `Idempotency-Key` headers
- [ ] Validate card numbers using the standard Luhn algorithm

---

## 📖 Introduction

Processing credit cards requires strict security compliance (PCI-DSS). Modern payment gateways such as **Stripe** keep card details off your servers entirely: client frontends collect raw card details through secure iframes (Stripe Elements) and receive a token, while your Python backend confirms the transaction using a **PaymentIntent**.

```
Client (Stripe Elements)                  Backend (Python)                    Stripe API
         │                                       │                                │
         ├────── 1. Request Checkout ───────────►│                                │
         │                                       ├──── 2. Create PaymentIntent ──►│
         │                                       │◄─── 3. Return client_secret ───┤
         │◄───── 4. Send client_secret ──────────┤                                │
         │                                                                        │
         ├────── 5. Confirm Card & 3D Secure directly with Stripe ───────────────►│
         │                                                                        │
         │                                       ┌──── 6. Webhook: charge.success ┤
         │                                       │◄───────────────────────────────┘
         │                                       ▼
         │                                (Fulfill Order in DB)
```

---

## 1. Stripe PaymentIntent Lifecycle

Payment amounts in Stripe are represented as **integers in the smallest currency unit** (e.g., $10.00 USD = `1000` cents).

=== "payment_service.py"
    ```python
    import os
    import stripe
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel

    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

    app = FastAPI()

    class CreatePaymentRequest(BaseModel):
        amount_usd: float
        currency: str = "usd"
        customer_email: str

    @app.post("/api/payments/create-intent")
    def create_payment_intent(request: CreatePaymentRequest):
        try:
            # Convert dollars to cents (integer)
            amount_cents = int(round(request.amount_usd * 100))
            
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=request.currency,
                receipt_email=request.customer_email,
                automatic_payment_methods={"enabled": True},
                metadata={"order_source": "web_store"}
            )
            return {"client_secret": intent.client_secret, "id": intent.id}
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    ```

---

## 2. Webhook Signature Verification

Never trust the frontend to confirm successful payment. Rely on **Stripe Webhooks** signed with your secret endpoint key (`whsec_...`).

=== "webhook_handler.py"
    ```python
    from fastapi import FastAPI, Request, HTTPException, Header
    import stripe
    import os

    app = FastAPI()
    WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

    @app.post("/api/stripe/webhook")
    async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
        payload = await request.body()
        
        try:
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")

        # Handle specific event types
        if event["type"] == "payment_intent.succeeded":
            intent = event["data"]["object"]
            print(f"Payment {intent['id']} for ${intent['amount']/100} succeeded!")
            # Trigger fulfillment workflow (e.g., update DB, grant access)
            
        elif event["type"] == "payment_intent.payment_failed":
            intent = event["data"]["object"]
            error_msg = intent.get("last_payment_error", {}).get("message")
            print(f"Payment failed: {error_msg}")

        return {"status": "success"}
    ```

---

## 3. Idempotency Keys and Safe Retries

Network glitches can cause API retries to execute twice. Stripe supports the `Idempotency-Key` header to guarantee that sending the same key within 24 hours returns the cached first result without double charging.

=== "Idempotent Charge Example"
    ```python
    import uuid
    import stripe

    def charge_customer_safely(customer_id: str, amount_cents: int, order_id: str):
        # Generate deterministic or order-specific idempotency key
        idempotency_key = f"order-charge-{order_id}"
        
        charge = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=customer_id,
            idempotency_key=idempotency_key
        )
        return charge
    ```

---

## 4. Validating Card Numbers with Luhn Algorithm

The **Luhn algorithm (Mod 10)** is the standard checksum formula used to validate primary account numbers (PANs) before attempting online processing.

| Step | Operation |
|---|---|
| 1 | From the rightmost digit, double the value of every second digit |
| 2 | If doubling a digit results in a number > 9, subtract 9 (or add the two digits) |
| 3 | Sum all resulting digits |
| 4 | If total sum modulo 10 equals 0, the card number is valid |

---

## 💻 Try It Yourself

Simulate a payment checkout pipeline: calculate discount, apply tax, generate an idempotency key, and confirm order creation.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory Payment Processor Simulator
def process_order_payment(unit_price, quantity, discount_pct=0.0):
    subtotal = unit_price * quantity
    discount_amount = subtotal * (discount_pct / 100)
    final_amount = subtotal - discount_amount
    amount_in_cents = int(round(final_amount * 100))
    
    return {
        "subtotal_usd": round(subtotal, 2),
        "discount_applied": round(discount_amount, 2),
        "total_usd": round(final_amount, 2),
        "stripe_amount_cents": amount_in_cents,
        "currency": "usd",
        "status": "requires_payment_method"
    }

order = process_order_payment(unit_price=49.99, quantity=2, discount_pct=15.0)
print(f"Subtotal       : ${order['subtotal_usd']}")
print(f"Discount (15%) : -${order['discount_applied']}")
print(f"Final Charge   : ${order['total_usd']}")
print(f"Stripe Cents   : {order['stripe_amount_cents']} cents")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Calculate Discounted Charge

Simulate charging an item with an initial price of `$29.99` and a `10%` discount. Print the final rounded amount formatted with 2 decimal places (`"26.99"`).

<div class="pyodide-runner" data-mode="challenge" data-expected="26.99">
<pre><code class="language-python">price = 29.99
discount = 0.10

# Calculate final_amount = price * (1 - discount)
# Print final_amount rounded to 2 decimal places, formatted as a string
</code></pre>
</div>

### Challenge 2 — Luhn Algorithm Card Validation

Implement the Luhn algorithm to validate the test card number `"4532015112830366"` and print `True`.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">card_number = "4532015112830366"

def is_valid_luhn(card: str) -> bool:
    digits = [int(c) for c in card if c.isdigit()]
    checksum = 0
    reverse_digits = digits[::-1]
    
    for i, digit in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = digit * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += digit
            
    return (checksum % 10) == 0

print(is_valid_luhn(card_number))
</code></pre>
</div>

---

## 📚 Further Reading

- [Stripe Python SDK Official Repository](https://github.com/stripe/stripe-python)
- [Stripe PaymentIntents API Reference](https://stripe.com/docs/api/payment_intents)
- [Stripe Webhook Signatures Guide](https://stripe.com/docs/webhooks/signatures)

---

!!! success "Lesson Complete 🎉"
    You now understand secure online payment processing, PaymentIntent flows, signature verification for webhooks, and the Luhn algorithm.

[⬅️ Lesson 77 · FastAPI with GraphQL](77-fastapi-graphql.md){ .md-button } [➡️ Lesson 79 · Social Login with OAuth](79-social-login-oauth.md){ .md-button .md-button--primary }
