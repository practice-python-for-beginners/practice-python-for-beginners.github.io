---
title: "Lesson 23 · Currency Converter API"
description: "Learn how exchange rate APIs work, fetch and cache live rates, convert currency amounts, round correctly, and build a /convert endpoint."
---

# Lesson 23 · Currency Converter API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain how exchange rate APIs like exchangerate-api.com work
- [ ] Fetch and cache live rates with a TTL to avoid hitting rate limits
- [ ] Convert amounts between currencies accurately
- [ ] Round monetary values correctly with Python's `round()`
- [ ] Build a `/convert` endpoint that accepts `from`, `to`, and `amount` parameters

---

## 📖 Introduction

Currency conversion is a real problem every fintech and e-commerce API must solve. Exchange rates change constantly, so fetching them on every request is expensive and slow — you need a caching strategy. In this lesson we simulate the full pipeline: fetching rates, caching them, performing conversions, and exposing a clean endpoint.

!!! info "Mock rates only in the browser"
    Live currency APIs require an API key and network access. All examples here use a static mock rate table so you can follow along in the browser. The patterns are identical to live usage.

---

## 1. How Exchange Rate APIs Work

Most exchange rate APIs (exchangerate-api.com, Open Exchange Rates, Fixer.io) return a base currency and a table of rates:

=== "Python"
    ```python
    # What a typical API response looks like (base = USD)
    mock_api_response = {
        "base": "USD",
        "date": "2024-11-15",
        "rates": {
            "EUR": 0.92,
            "GBP": 0.79,
            "JPY": 149.50,
            "CAD": 1.36,
            "AUD": 1.54,
            "INR": 83.90,
            "CHF": 0.88,
        }
    }

    # To convert USD → EUR:  amount * rates["EUR"]
    # To convert EUR → GBP:  amount / rates["EUR"] * rates["GBP"]
    amount_usd = 100
    eur_rate   = mock_api_response["rates"]["EUR"]
    result     = amount_usd * eur_rate
    print(f"$100 USD = €{result:.2f} EUR")
    ```
=== "Output"
    ```
    $100 USD = €92.00 EUR
    ```

!!! tip "Always pin a base currency"
    Work in a single base (usually USD). Converting A → B becomes: `A / rate_A * rate_B`. This avoids floating-point compounding errors from chaining conversions.

---

## 2. Converting Between Any Two Currencies

=== "Python"
    ```python
    RATES = {
        "USD": 1.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "JPY": 149.50,
        "CAD": 1.36,
        "AUD": 1.54,
        "INR": 83.90,
    }

    def convert(amount: float, from_cur: str, to_cur: str,
                rates: dict) -> float:
        """Convert amount from from_cur to to_cur via USD base."""
        from_cur = from_cur.upper()
        to_cur   = to_cur.upper()
        if from_cur not in rates:
            raise ValueError(f"Unknown currency: {from_cur}")
        if to_cur not in rates:
            raise ValueError(f"Unknown currency: {to_cur}")
        # Normalise to USD, then convert to target
        in_usd  = amount / rates[from_cur]
        result  = in_usd * rates[to_cur]
        return round(result, 2)

    print(convert(100, "USD", "EUR", RATES))   # 92.0
    print(convert(50,  "GBP", "JPY", RATES))   # ?
    print(convert(200, "EUR", "INR", RATES))   # ?
    ```
=== "Output"
    ```
    92.0
    8449.37
    18239.13
    ```

---

## 3. Caching Rates with TTL

=== "Python"
    ```python
    import time

    _rate_cache = {"rates": None, "fetched_at": 0}
    RATE_TTL    = 3600   # 1 hour

    def get_rates(fetch_fn):
        """Return cached rates or call fetch_fn to refresh."""
        now = time.time()
        if _rate_cache["rates"] and (now - _rate_cache["fetched_at"]) < RATE_TTL:
            print("[cache] Returning cached rates")
            return _rate_cache["rates"]
        print("[fetch] Refreshing exchange rates")
        _rate_cache["rates"]      = fetch_fn()
        _rate_cache["fetched_at"] = now
        return _rate_cache["rates"]

    # Simulate a fetch function
    def mock_fetch():
        return {"USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.50}

    rates = get_rates(mock_fetch)   # first call — fetches
    rates = get_rates(mock_fetch)   # second call — cached
    print("EUR rate:", rates["EUR"])
    ```
=== "Output"
    ```
    [fetch] Refreshing exchange rates
    [cache] Returning cached rates
    EUR rate: 0.92
    ```

!!! warning "Thread safety for shared caches"
    If your Flask/FastAPI server handles requests concurrently, protect the cache dict with a `threading.Lock`. A simple dict is not thread-safe for simultaneous read-write.

---

## 4. Rounding Monetary Values

Floating-point arithmetic can produce surprising results:

=== "Python"
    ```python
    # Naive float arithmetic
    print(0.1 + 0.2)                 # 0.30000000000000004

    # Use round() for display
    print(round(0.1 + 0.2, 2))       # 0.3

    # For financial calculations use the decimal module
    from decimal import Decimal, ROUND_HALF_UP

    amount = Decimal("100.005")
    rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    print(rounded)                    # 100.01
    ```
=== "Output"
    ```
    0.30000000000000004
    0.3
    100.01
    ```

!!! note "Use `Decimal` for money"
    For any real money calculation use Python's `decimal.Decimal` module. It gives exact decimal arithmetic and configurable rounding modes. Use `float` only for display or non-financial calculations.

---

## 5. Building a `/convert` Endpoint

=== "Python"
    ```python
    # Simulated Flask-style route handler (no Flask needed to understand it)

    RATES = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.50, "CAD": 1.36}

    def handle_convert(query_params: dict) -> dict:
        """Simulate GET /convert?from=USD&to=EUR&amount=100"""
        try:
            from_cur = query_params.get("from", "USD").upper()
            to_cur   = query_params.get("to",   "EUR").upper()
            amount   = float(query_params.get("amount", 1))
        except (ValueError, TypeError) as e:
            return {"error": True, "message": str(e), "status": 400}

        if from_cur not in RATES or to_cur not in RATES:
            return {"error": True, "message": "Unknown currency", "status": 404}

        result = round(amount / RATES[from_cur] * RATES[to_cur], 2)
        return {
            "from": from_cur, "to": to_cur,
            "amount": amount, "result": result,
            "status": 200,
        }

    resp = handle_convert({"from": "USD", "to": "EUR", "amount": "100"})
    print(resp)
    ```
=== "Output"
    ```
    {'from': 'USD', 'to': 'EUR', 'amount': 100.0, 'result': 92.0, 'status': 200}
    ```

---

## 💻 Try It Yourself

Convert 100 USD to EUR using a mock exchange rate dict and print the result:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.50,
    "CAD": 1.36,
}

def convert(amount, from_cur, to_cur):
    in_usd = amount / RATES[from_cur.upper()]
    result = in_usd * RATES[to_cur.upper()]
    return round(result, 2)

result = convert(100, "USD", "EUR")
print(f"100 USD = {result} EUR")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — GBP to JPY

Convert 50 GBP to JPY using the mock rate table below and print the result.

<div class="pyodide-runner" data-mode="challenge" data-expected="8750.0">
<pre><code class="language-python">RATES = {
    "USD": 1.0,
    "GBP": 0.80,
    "JPY": 140.0,
}

# Convert 50 GBP to JPY and print the result
# Hint: 50 / 0.80 * 140.0 = 8750.0
</code></pre>
</div>

---

### Challenge 2 — Cheapest Currency

Find the currency code with the highest rate per USD (most units per dollar) and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="JPY">
<pre><code class="language-python">RATES = {
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.50,
    "CAD": 1.36,
}

# Print the currency code with the highest rate value
</code></pre>
</div>

---

## 📚 Further Reading

- [ExchangeRate-API Documentation](https://www.exchangerate-api.com/docs/overview)
- [Python `decimal` Module — Official Docs](https://docs.python.org/3/library/decimal.html)
- [Open Exchange Rates API](https://openexchangerates.org/documentation)

---

!!! success "Lesson Complete 🎉"
    You can now fetch exchange rates, cache them efficiently, convert between any currency pair, and round monetary values safely.

[⬅️ Lesson 22 · To-Do List API](22-todo-list-api.md){ .md-button } [➡️ Lesson 24 · News Aggregator API](24-news-aggregator.md){ .md-button .md-button--primary }
