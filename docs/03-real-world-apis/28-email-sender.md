---
title: "Lesson 28 · Email Sender Service"
description: "Send plain text and HTML emails with Python smtplib, add attachments with email.mime, use environment variables for credentials, validate email addresses, and build a /email/send endpoint."
---

# Lesson 28 · Email Sender Service

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Send plain text and HTML emails using Python's `smtplib`
- [ ] Build multipart messages with `email.mime` for attachments
- [ ] Load SMTP credentials safely from environment variables
- [ ] Validate email address format with a regular expression
- [ ] Design a `/email/send` POST endpoint with a clean request schema

---

## 📖 Introduction

Sending emails from a Python API is a common need: welcome emails, password resets, order confirmations. Python's standard library has everything you need — `smtplib` for the SMTP connection and `email.mime` for building rich messages. In this lesson you'll learn to send both plain text and HTML, attach files, and expose a clean endpoint.

!!! info "No real SMTP in the browser"
    `smtplib` requires a network connection. The browser examples simulate building email message dicts so you can learn the structure. The sending code at the end runs identically in a real Python environment.

---

## 1. Building an Email Message Dict

Before connecting to SMTP, structure your message:

=== "Python"
    ```python
    from datetime import datetime

    def build_message(to: str, subject: str, body: str,
                      html: str = None) -> dict:
        """Simulate an email message object."""
        return {
            "from":       "noreply@example.com",
            "to":         to,
            "subject":    subject,
            "body":       body,
            "html":       html,
            "sent_at":    None,
            "message_id": f"<{datetime.utcnow().timestamp():.0f}@example.com>",
        }

    msg = build_message(
        to      = "alice@example.com",
        subject = "Welcome to PythonLearn!",
        body    = "Hi Alice, thanks for signing up.",
        html    = "<h1>Welcome!</h1><p>Hi Alice, thanks for signing up.</p>",
    )

    for key, value in msg.items():
        print(f"  {key:12}: {value}")
    ```
=== "Output"
    ```
      from        : noreply@example.com
      to          : alice@example.com
      subject     : Welcome to PythonLearn!
      body        : Hi Alice, thanks for signing up.
      html        : <h1>Welcome!</h1><p>Hi Alice, thanks for signing up.</p>
      sent_at     : None
      message_id  : <1700000000@example.com>
    ```

!!! tip "Always include a plain-text fallback"
    Some email clients don't render HTML. Always include a `text/plain` alternative alongside your `text/html` part. The `MIMEMultipart("alternative")` MIME type handles this automatically.

---

## 2. Sending with `smtplib` (Plain Text)

=== "Python"
    ```python
    # This code runs in a real Python environment, not Pyodide
    import smtplib
    from email.mime.text import MIMEText
    import os

    def send_plain_text(to: str, subject: str, body: str) -> bool:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"]    = os.environ.get("EMAIL_FROM", "noreply@example.com")
        msg["To"]      = to

        host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        port = int(os.environ.get("SMTP_PORT", 587))
        user = os.environ.get("SMTP_USER")
        pwd  = os.environ.get("SMTP_PASS")

        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls()
            server.login(user, pwd)
            server.sendmail(msg["From"], [to], msg.as_string())
        return True

    # send_plain_text("alice@example.com", "Hello!", "This is a test.")
    print("send_plain_text() — ready to use with real SMTP credentials")
    ```
=== "Output"
    ```
    send_plain_text() — ready to use with real SMTP credentials
    ```

!!! warning "Never hardcode SMTP passwords"
    Always load credentials from environment variables or a secrets manager. Hardcoded passwords in source code lead to credential leaks. Use `python-dotenv` to load `.env` files locally.

---

## 3. Sending HTML Email with Attachments

=== "Python"
    ```python
    from email.mime.multipart import MIMEMultipart
    from email.mime.text      import MIMEText
    from email.mime.base      import MIMEBase
    from email               import encoders

    def build_html_email(to, subject, plain_body, html_body,
                         attachments=None):
        """Build a multipart email with HTML and optional attachments."""
        outer = MIMEMultipart("mixed")
        outer["Subject"] = subject
        outer["From"]    = "noreply@example.com"
        outer["To"]      = to

        # Alternative part (plain + HTML)
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(plain_body, "plain"))
        alt.attach(MIMEText(html_body,  "html"))
        outer.attach(alt)

        # Attachments
        for name, data in (attachments or []):
            part = MIMEBase("application", "octet-stream")
            part.set_payload(data)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{name}"')
            outer.attach(part)

        return outer

    msg = build_html_email(
        to         = "bob@example.com",
        subject    = "Your Invoice #1042",
        plain_body = "Please find your invoice attached.",
        html_body  = "<p>Please find your <strong>invoice</strong> attached.</p>",
        attachments= [("invoice.txt", b"Amount: $99.00")],
    )

    print("Subject:", msg["Subject"])
    print("Parts:  ", len(msg.get_payload()))
    ```
=== "Output"
    ```
    Subject: Your Invoice #1042
    Parts:   2
    ```

---

## 4. Email Validation with Regex

=== "Python"
    ```python
    import re

    EMAIL_REGEX = re.compile(
        r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    )

    def is_valid_email(address: str) -> bool:
        return bool(EMAIL_REGEX.match(address.strip()))

    test_addresses = [
        "user@example.com",        # ✅
        "user.name+tag@domain.org",# ✅
        "notanemail",               # ❌
        "@missing-user.com",        # ❌
        "missing@.com",             # ❌
        "valid@sub.domain.co.uk",  # ✅
    ]

    for addr in test_addresses:
        status = "✅" if is_valid_email(addr) else "❌"
        print(f"{status} {addr}")
    ```
=== "Output"
    ```
    ✅ user@example.com
    ✅ user.name+tag@domain.org
    ❌ notanemail
    ❌ @missing-user.com
    ❌ missing@.com
    ✅ valid@sub.domain.co.uk
    ```

!!! note "Regex is not enough for production"
    Regex validation catches obvious format errors. For production use `email-validator` (`pip install email-validator`) which also checks DNS MX records to confirm the domain can actually receive mail.

---

## 5. Building the `/email/send` Endpoint

=== "Python"
    ```python
    import re

    EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
    sent_log = []   # Simulates the sent mail log

    def handle_send(payload: dict) -> dict:
        """Simulate POST /email/send"""
        to      = payload.get("to", "")
        subject = payload.get("subject", "")
        body    = payload.get("body", "")

        if not EMAIL_REGEX.match(to):
            return {"error": "Invalid email address", "status": 400}
        if not subject.strip():
            return {"error": "Subject is required",   "status": 400}
        if not body.strip():
            return {"error": "Body is required",      "status": 400}

        # Simulate sending
        record = {"to": to, "subject": subject, "status": "sent"}
        sent_log.append(record)
        return {"message": "Email queued", "id": len(sent_log), "status": 202}

    print(handle_send({"to": "alice@example.com", "subject": "Hello", "body": "Hi!"}))
    print(handle_send({"to": "notanemail",         "subject": "Hello", "body": "Hi!"}))
    print(f"Sent log: {len(sent_log)} message(s)")
    ```
=== "Output"
    ```
    {'message': 'Email queued', 'id': 1, 'status': 202}
    {'error': 'Invalid email address', 'status': 400}
    Sent log: 1 message(s)
    ```

---

## 💻 Try It Yourself

Simulate building an email message dict and print the subject:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">from datetime import datetime

def build_message(to, subject, body, html=None):
    return {
        "from":    "noreply@example.com",
        "to":      to,
        "subject": subject,
        "body":    body,
        "html":    html,
    }

msg = build_message(
    to      = "alice@example.com",
    subject = "Your Weekly Python Digest",
    body    = "Here are this week's top Python articles.",
    html    = "<h2>Python Digest</h2><p>Here are this week's top articles.</p>",
)

print("To:     ", msg["to"])
print("Subject:", msg["subject"])
print("Has HTML:", msg["html"] is not None)
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Validate a Real Email

Validate `"user@example.com"` using a regex and print `True`.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

address = "user@example.com"

# Validate the address and print True or False
</code></pre>
</div>

---

### Challenge 2 — Validate an Invalid Email

Validate `"notanemail"` using the same regex and print `False`.

<div class="pyodide-runner" data-mode="challenge" data-expected="False">
<pre><code class="language-python">import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

address = "notanemail"

# Validate the address and print True or False
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `smtplib` — Official Docs](https://docs.python.org/3/library/smtplib.html)
- [Python `email` Package — Official Docs](https://docs.python.org/3/library/email.html)
- [Real Python — Sending Emails with Python](https://realpython.com/python-send-email/)

---

!!! success "Lesson Complete 🎉"
    You can now construct plain text and HTML emails, attach files, validate addresses, and wire everything together in a clean send endpoint.

[⬅️ Lesson 27 · Image Upload API](27-image-upload-api.md){ .md-button } [➡️ Lesson 29 · URL Shortener API](29-url-shortener.md){ .md-button .md-button--primary }
