---
title: "Lesson 43 · Building Webhooks with Flask"
description: "Learn to receive, verify, and handle webhook events in Flask — including HMAC-SHA256 signature verification, idempotency, and fast response patterns."
---

# Lesson 43 · Building Webhooks with Flask

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** 30 min

## 🎯 Learning Objectives

- [ ] Explain the push vs pull model and when webhooks are appropriate
- [ ] Build a Flask POST endpoint that receives webhook payloads
- [ ] Verify payload integrity using HMAC-SHA256 signatures
- [ ] Return `200 OK` immediately and defer processing to a background task
- [ ] Implement idempotency to safely handle duplicate deliveries
- [ ] Understand retry behaviour and how to handle it gracefully

## 📖 Introduction

A **webhook** is an HTTP callback: a remote system sends a POST request to your URL whenever something interesting happens — a payment completes, a repository gets a commit, or a form is submitted. This *push* model eliminates the need to poll an external API repeatedly.

Webhooks are simple in theory but tricky in practice. You need to: verify the request really came from the expected source, respond within a deadline (usually 5–10 s), avoid processing the same event twice, and handle delivery retries from the provider.

!!! info "Push vs Pull"
    **Polling** (pull): your app asks the external service every N seconds — "anything new?" — and most replies will be "no". **Webhooks** (push): the service calls you only when something happens. Push is more efficient but requires a public URL.

---

## 1. Receiving a Webhook in Flask

The minimal webhook receiver is a single POST route that reads the JSON body, verifies it, and returns 200 quickly.

=== "Minimal receiver"
    ```python
    from flask import Flask, request, jsonify

    app = Flask(__name__)

    @app.post("/webhooks/github")
    def github_webhook():
        payload = request.get_json(silent=True) or {}
        event_type = request.headers.get("X-GitHub-Event", "unknown")

        # Immediately acknowledge — do real work asynchronously
        print(f"Received event: {event_type}")
        return jsonify({"status": "received"}), 200
    ```

=== "Payload structure (GitHub push example)"
    ```json
    {
      "ref": "refs/heads/main",
      "repository": { "full_name": "alice/my-repo" },
      "commits": [
        { "id": "abc123", "message": "Fix bug #42", "author": {"name": "Alice"} }
      ],
      "pusher": { "name": "alice" }
    }
    ```

=== "Route anatomy"
    | Part | Purpose |
    |------|---------|
    | `POST /webhooks/<provider>` | One route per provider |
    | `X-<Provider>-Event` header | Event type (push, pull_request …) |
    | `X-<Provider>-Signature-256` | HMAC-SHA256 of the body |
    | `X-<Provider>-Delivery` | Unique delivery ID (use for idempotency) |

---

## 2. HMAC-SHA256 Signature Verification

Providers sign the raw request body with a shared secret. You verify the signature before trusting the payload.

=== "Verification function"
    ```python
    import hmac
    import hashlib

    WEBHOOK_SECRET = b"my-super-secret"

    def verify_signature(raw_body: bytes, signature_header: str) -> bool:
        """
        signature_header format: "sha256=<hex_digest>"
        """
        if not signature_header.startswith("sha256="):
            return False
        expected = hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()
        provided = signature_header[len("sha256="):]
        return hmac.compare_digest(expected, provided)
    ```

=== "Flask route with verification"
    ```python
    from flask import Flask, request, abort

    @app.post("/webhooks/stripe")
    def stripe_webhook():
        raw_body = request.get_data()  # raw bytes — before any parsing
        sig = request.headers.get("Stripe-Signature", "")

        if not verify_signature(raw_body, sig):
            abort(400, "Invalid signature")

        payload = request.get_json(force=True)
        # ... process payload
        return "", 200
    ```

=== "Why compare_digest?"
    ```python
    # ❌ Vulnerable to timing attacks:
    # return expected == provided

    # ✅ Constant-time comparison:
    import hmac
    return hmac.compare_digest(expected, provided)
    # Timing attacks deduce the secret by measuring comparison time.
    # compare_digest always takes the same time regardless of match.
    ```

!!! warning "Always use the raw body"
    Parse JSON **after** verification. Parsing before means the bytes you hash no longer match the bytes the provider signed.

---

## 3. Fast Response & Background Processing

Webhook providers expect a response within 5–10 seconds. Heavy processing must happen asynchronously.

=== "Thread-based background task"
    ```python
    import threading
    from flask import Flask, request, jsonify

    app = Flask(__name__)

    def process_event(payload: dict):
        """Runs in a background thread — can take as long as needed."""
        import time
        time.sleep(2)  # simulate slow work
        print(f"Processed: {payload.get('event')}")

    @app.post("/webhooks/events")
    def events():
        payload = request.get_json(silent=True) or {}
        thread = threading.Thread(target=process_event, args=(payload,))
        thread.daemon = True
        thread.start()
        return jsonify({"status": "queued"}), 200  # returns immediately
    ```

=== "Celery (production-grade)"
    ```python
    from celery import Celery

    celery = Celery("tasks", broker="redis://localhost:6379/0")

    @celery.task
    def process_event_task(payload: dict):
        # Runs in a Celery worker process
        ...

    @app.post("/webhooks/events")
    def events():
        payload = request.get_json()
        process_event_task.delay(payload)
        return "", 200
    ```

---

## 4. Idempotency & Retries

Providers retry deliveries when your endpoint doesn't respond with 2xx. You may receive the same event multiple times.

=== "Deduplication with a set"
    ```python
    processed_ids: set[str] = set()

    @app.post("/webhooks/events")
    def events():
        delivery_id = request.headers.get("X-Delivery-ID", "")
        if delivery_id in processed_ids:
            return jsonify({"status": "already processed"}), 200

        processed_ids.add(delivery_id)
        payload = request.get_json()
        # ... process payload
        return jsonify({"status": "ok"}), 200
    ```

=== "Deduplication with Redis (production)"
    ```python
    import redis

    r = redis.Redis()
    TTL = 86_400  # 24 hours

    def already_processed(delivery_id: str) -> bool:
        key = f"webhook:seen:{delivery_id}"
        return not r.set(key, "1", ex=TTL, nx=True)
    ```

=== "Retry behaviour"
    | Provider | Max retries | Retry schedule |
    |----------|-------------|----------------|
    | GitHub | 3 | Immediate, +1 min, +10 min |
    | Stripe | ~90 | Exponential (hours/days) |
    | Twilio | 5 | Immediate + escalating |

---

## 5. Webhook Security Checklist

| Check | Why |
|-------|-----|
| Verify HMAC signature | Ensures payload is from the real provider |
| Use `compare_digest` | Prevents timing attacks |
| Hash the raw bytes | Parsing first changes the byte sequence |
| Return 200 fast | Prevents provider retry storms |
| Deduplicate by delivery ID | Prevents double-processing |
| Log every event | Audit trail for debugging |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import hmac
import hashlib

SECRET = b"my-webhook-secret"

def sign_payload(body: bytes) -> str:
    """Generate the HMAC-SHA256 signature a provider would send."""
    digest = hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"

def verify_signature(body: bytes, signature: str) -> bool:
    """Verify the signature matches the body."""
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    provided = signature[len("sha256="):]
    return hmac.compare_digest(expected, provided)

# Simulate signing and verifying
payload = b'{"event": "payment.completed", "amount": 9900}'
sig = sign_payload(payload)

print(f"Signature: {sig}")
print(f"Valid sig:    {verify_signature(payload, sig)}")
print(f"Tampered:     {verify_signature(b'tampered body', sig)}")
print(f"Wrong prefix: {verify_signature(payload, 'md5=' + sig[7:])}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Verify a correct HMAC signature**

<div class="pyodide-runner" data-mode="challenge" data-expected="True">

```python
import hmac, hashlib

SECRET = b"webhook-secret"
body = b'{"event": "order.paid", "id": 42}'

# This is the signature the provider sends
correct_sig = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()

# TODO: verify `correct_sig` against `body` and print True or False
```

</div>

---

**Challenge 2 — Detect a tampered payload**

<div class="pyodide-runner" data-mode="challenge" data-expected="False">

```python
import hmac, hashlib

SECRET = b"webhook-secret"
original_body = b'{"event": "order.paid", "id": 42}'
tampered_body = b'{"event": "order.paid", "id": 999}'  # attacker changed id

sig = "sha256=" + hmac.new(SECRET, original_body, hashlib.sha256).hexdigest()

# TODO: verify `sig` against `tampered_body` and print True or False
```

</div>

---

## 📚 Further Reading

- [GitHub Webhooks — Validating deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Stripe Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)
- [Python `hmac` module — stdlib docs](https://docs.python.org/3/library/hmac.html)

---

!!! success "Lesson 43 complete!"
    You can now receive webhook payloads in Flask, verify HMAC-SHA256 signatures safely, respond immediately, and deduplicate retried events.

[⬅️ Previous Lesson](42-securing-fastapi.md){ .md-button } [➡️ Next Lesson](44-webhooks-fastapi.md){ .md-button .md-button--primary }
