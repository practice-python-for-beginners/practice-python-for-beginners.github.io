---
title: "Lesson 79 · Social Login with OAuth"
description: "Implement OAuth 2.0 and OpenID Connect social authentication in Python: master the authorization code flow, prevent CSRF attacks with state tokens, link third-party accounts, and use Authlib with FastAPI."
---

# Lesson 79 · Social Login with OAuth

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange)
- [ ] Configure OAuth credentials and scopes for providers like Google and GitHub
- [ ] Implement secure login redirects and callback token exchanges using `Authlib`
- [ ] Prevent Cross-Site Request Forgery (CSRF) using cryptographically secure `state` tokens
- [ ] Map provider profile claims (sub, email, name) to internal local database users
- [ ] Issue local JWT session tokens following successful social authentication

---

## 📖 Introduction

**OAuth 2.0** and **OpenID Connect (OIDC)** are open industry standards enabling third-party social login ("Sign in with Google" or "Login with GitHub"). Instead of storing password hashes in your database, users authenticate with trusted identity providers (IdPs), and your backend receives verified identity claims and an access token.

```
User Browser                          Backend Server (FastAPI)                     Google / GitHub (IdP)
     │                                            │                                          │
     ├───── 1. Click "Login with Google" ────────►│                                          │
     │                                            ├──── 2. Generate State & Redirect URL ────┤
     │◄──── 3. 302 Redirect to IdP ───────────────┤                                          │
     │                                                                                       │
     ├───── 4. User logs in & grants consent on IdP ────────────────────────────────────────►│
     │◄──── 5. 302 Redirect to /auth/callback?code=XYZ&state=ABC ───────────────────────────┤
     │                                            │                                          │
     ├───── 6. Browser follows redirect ─────────►│                                          │
     │                                            ├──── 7. POST /token (code + secret) ─────►│
     │                                            │◄─── 8. Returns access_token + userinfo ──┤
     │                                            │                                          │
     │                                            ├───► Link / Create User in Local DB       │
     │◄──── 9. Set App Session Cookie / JWT ──────┤                                          │
```

---

## 1. OAuth2 Authorization Code Flow with Authlib

`Authlib` is the standard library for OAuth 1.0, OAuth 2.0, and OpenID Connect clients in Python.

=== "fastapi_oauth.py"
    ```python
    import os
    from fastapi import FastAPI, Request, HTTPException
    from starlette.middleware.sessions import SessionMiddleware
    from authlib.integrations.starlette_client import OAuth

    app = FastAPI()
    app.add_middleware(SessionMiddleware, secret_key=os.environ.get("SESSION_SECRET", "session-secret-key"))

    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"}
    )

    @app.get("/auth/login/google")
    async def login_google(request: Request):
        redirect_uri = request.url_for("auth_google_callback")
        return await oauth.google.authorize_redirect(request, redirect_uri)

    @app.get("/auth/callback/google")
    async def auth_google_callback(request: Request):
        try:
            token = await oauth.google.authorize_access_token(request)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"OAuth error: {e}")

        user_info = token.get("userinfo")
        return {
            "message": "Authenticated successfully",
            "provider": "google",
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "sub": user_info.get("sub")
        }
    ```

---

## 2. Preventing CSRF with the State Parameter

The `state` parameter is an opaque, unguessable string generated before redirecting to the provider, saved in a secure HTTP-only session cookie, and verified upon callback.

```
1. Before Redirect:   state = secrets.token_urlsafe(32) ──► Saved to session
2. Redirect to IdP:   https://accounts.google.com/o/oauth2/v2/auth?state=<state>&...
3. IdP Callback:      GET /callback?code=XYZ&state=<state>
4. Backend Verify:    secrets.compare_digest(session["oauth_state"], request_params["state"])
```

=== "Pure Python State Verification"
    ```python
    import secrets
    import hmac

    def create_oauth_session():
        state_token = secrets.token_urlsafe(32)
        # Store state_token in server session or encrypted cookie
        return state_token

    def verify_oauth_callback(session_state: str, callback_state: str) -> bool:
        if not session_state or not callback_state:
            return False
        # Constant-time comparison prevents timing attacks
        return hmac.compare_digest(session_state, callback_state)
    ```

---

## 3. Account Linking: Social Identity to Local User

When a social login succeeds, check if the email or provider unique ID (`sub`) matches an existing database user.

| Scenario | Action |
|---|---|
| User already exists with `google_id` | Log in immediately; issue JWT session |
| User exists with matching email (no provider linked) | Link `google_id` to user record if email is verified |
| User does not exist | Create new local user record with random unusable password |

---

## 4. PKCE (Proof Key for Code Exchange)

PKCE mitigates authorization code interception attacks on mobile apps and single-page applications.

- **Code Verifier:** High-entropy random cryptographic string
- **Code Challenge:** `BASE64URL(SHA256(code_verifier))`

The client sends the challenge on initial authorization, and provides the verifier on token exchange. The IdP computes the hash to prove ownership.

---

## 💻 Try It Yourself

Simulate generating an OAuth2 state parameter, creating an authorization URL, and verifying the state token in the callback request.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import secrets
import hmac
import urllib.parse

class OAuthFlowSimulator:
    def __init__(self, client_id, redirect_uri):
        self.client_id = client_id
        self.redirect_uri = redirect_uri
        self.active_sessions = {}

    def generate_login_url(self, user_session_id):
        state = secrets.token_hex(16)  # 32-character hex string
        self.active_sessions[user_session_id] = state
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email",
            "state": state
        }
        return f"https://auth.provider.com/oauth/authorize?{urllib.parse.urlencode(params)}"

    def verify_callback(self, user_session_id, received_state):
        expected_state = self.active_sessions.pop(user_session_id, None)
        if not expected_state:
            return False
        return hmac.compare_digest(expected_state, received_state)

oauth = OAuthFlowSimulator("my-client-id", "https://app.com/auth/callback")
login_url = oauth.generate_login_url("session_user_99")
print(f"Generated OAuth Login URL:\n{login_url}\n")

# Verify callback with valid state
state_param = urllib.parse.parse_qs(urllib.parse.urlparse(login_url).query)["state"][0]
is_valid = oauth.verify_callback("session_user_99", state_param)
print(f"State verification success: {is_valid}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Generate State Token Length

Generate a random hex token using `secrets.token_hex(16)` (which produces exactly 32 hexadecimal characters) and print its string length.

<div class="pyodide-runner" data-mode="challenge" data-expected="32">
<pre><code class="language-python">import secrets

# Generate a 16-byte hex token (32 chars)
state = secrets.token_hex(16)

# Print the length of state
</code></pre>
</div>

### Challenge 2 — Verify State Token Match

Compare a stored session state token with an incoming callback state parameter using `hmac.compare_digest` and print `True`.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">import hmac

stored_state = "e8b1d94892c9f80164e29b13fa2a7e93"
callback_state = "e8b1d94892c9f80164e29b13fa2a7e93"

# Verify that callback_state matches stored_state using hmac.compare_digest
# Print the boolean result
</code></pre>
</div>

---

## 📚 Further Reading

- [Authlib Python Documentation](https://docs.authlib.org/en/latest/)
- [OAuth 2.0 RFC 6749 Specification](https://datatracker.ietf.org/doc/html/rfc6749)
- [OpenID Connect Core 1.0 Specs](https://openid.net/specs/openid-connect-core-1_0.html)

---

!!! success "Lesson Complete 🎉"
    You now understand OAuth 2.0 authorization code flows, CSRF state protection, OpenID Connect identity tokens, and social account linking.

[⬅️ Lesson 78 · Payment Integration API](78-payment-integration.md){ .md-button } [➡️ Lesson 80 · Event-Driven Pub/Sub API](80-event-driven-pubsub.md){ .md-button .md-button--primary }
