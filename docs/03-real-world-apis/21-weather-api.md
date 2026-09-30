---
title: "Lesson 21 · Weather API Integration"
description: "Learn how weather APIs work, make GET requests with query parameters, parse JSON responses, extract temperature and humidity, handle errors, and cache results."
---

# Lesson 21 · Weather API Integration

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain how a weather API like OpenWeatherMap works
- [ ] Construct a GET request with query parameters (`q`, `appid`, `units`)
- [ ] Parse the JSON response and extract temperature, humidity, and description
- [ ] Handle errors for invalid city names with status codes
- [ ] Implement a simple in-memory cache to avoid redundant requests

---

## 📖 Introduction

Weather data is one of the most commonly consumed APIs on the web. Services like **OpenWeatherMap** expose a simple REST endpoint — you send a city name and an API key, and you get back current conditions as JSON. In this lesson we'll walk through everything from forming the URL to gracefully handling errors when a city is not found.

!!! info "API key required for live use"
    OpenWeatherMap's free tier gives you 60 calls/minute. You need to sign up at [openweathermap.org](https://openweathermap.org/api) to get an API key. In this lesson all examples use **mock data** so you can run everything in the browser.

---

## 1. How Weather APIs Work

A typical OpenWeatherMap request looks like:

```
GET https://api.openweathermap.org/data/2.5/weather
    ?q=London
    &appid=YOUR_API_KEY
    &units=metric
```

The server returns a JSON object with nested fields for temperature, weather description, wind speed, humidity, and more.

=== "Python"
    ```python
    import requests

    BASE_URL = "https://api.openweathermap.org/data/2.5/weather"
    API_KEY  = "your_api_key_here"

    def get_weather(city: str) -> dict:
        params = {"q": city, "appid": API_KEY, "units": "metric"}
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()   # raises on 4xx/5xx
        return response.json()

    data = get_weather("London")
    print(data["name"], data["main"]["temp"])
    ```
=== "Output"
    ```
    London 12.4
    ```

!!! tip "Always use `units=metric` or `units=imperial`"
    Without a `units` parameter the API returns temperature in Kelvin — not useful for most apps!

---

## 2. Parsing the JSON Response

The full response has many fields. Here are the most useful ones:

=== "Python"
    ```python
    # Mock response matching the real OpenWeatherMap shape
    mock_response = {
        "name": "London",
        "main": {"temp": 12.4, "humidity": 78, "feels_like": 10.1},
        "weather": [{"description": "light rain", "icon": "10d"}],
        "wind": {"speed": 5.2, "deg": 220},
        "sys": {"country": "GB"},
        "cod": 200
    }

    city        = mock_response["name"]
    country     = mock_response["sys"]["country"]
    temp        = mock_response["main"]["temp"]
    feels_like  = mock_response["main"]["feels_like"]
    humidity    = mock_response["main"]["humidity"]
    description = mock_response["weather"][0]["description"]
    wind_speed  = mock_response["wind"]["speed"]

    print(f"📍 {city}, {country}")
    print(f"🌡️  Temp: {temp}°C  (feels like {feels_like}°C)")
    print(f"💧 Humidity: {humidity}%")
    print(f"🌬️  Wind: {wind_speed} m/s")
    print(f"☁️  {description.capitalize()}")
    ```
=== "Output"
    ```
    📍 London, GB
    🌡️  Temp: 12.4°C  (feels like 10.1°C)
    💧 Humidity: 78%
    🌬️  Wind: 5.2 m/s
    ☁️  Light rain
    ```

---

## 3. Error Handling for Bad City Names

When you pass a city that doesn't exist OpenWeatherMap returns HTTP **404** with `{"cod": "404", "message": "city not found"}`.

=== "Python"
    ```python
    def get_weather_safe(city: str, mock_db: dict) -> dict:
        """Simulate the API lookup with error handling."""
        if city not in mock_db:
            return {"error": True, "message": f"City '{city}' not found", "cod": 404}
        return {"error": False, "data": mock_db[city], "cod": 200}

    cities_db = {
        "London": {"temp": 12.4, "humidity": 78, "description": "light rain"},
        "Tokyo":  {"temp": 24.1, "humidity": 60, "description": "clear sky"},
    }

    for city in ["London", "Atlantis"]:
        result = get_weather_safe(city, cities_db)
        if result["error"]:
            print(f"❌ Error {result['cod']}: {result['message']}")
        else:
            d = result["data"]
            print(f"✅ {city}: {d['temp']}°C, {d['description']}")
    ```
=== "Output"
    ```
    ✅ London: 12.4°C, light rain
    ❌ Error 404: City 'Atlantis' not found
    ```

!!! warning "Never expose your API key in client-side code"
    Store your key in a `.env` file and load it with `python-dotenv`. Never commit API keys to version control.

---

## 4. Caching Results

Calling the API on every request wastes quota. A simple dict-based cache with a timestamp avoids repeat calls within a TTL window.

=== "Python"
    ```python
    import time

    cache = {}   # { city_lower: {"data": {...}, "fetched_at": timestamp} }
    CACHE_TTL = 300   # 5 minutes

    def fetch_with_cache(city: str, mock_db: dict) -> dict:
        key = city.lower()
        now = time.time()

        if key in cache:
            age = now - cache[key]["fetched_at"]
            if age < CACHE_TTL:
                print(f"[cache hit] {city} ({age:.0f}s old)")
                return cache[key]["data"]

        # Simulate network call
        if key not in {k.lower() for k in mock_db}:
            raise ValueError(f"City not found: {city}")

        data = next(v for k, v in mock_db.items() if k.lower() == key)
        cache[key] = {"data": data, "fetched_at": now}
        print(f"[cache miss] {city} fetched")
        return data

    mock_db = {"London": {"temp": 12.4, "humidity": 78}}
    fetch_with_cache("London", mock_db)   # cache miss
    fetch_with_cache("London", mock_db)   # cache hit
    ```
=== "Output"
    ```
    [cache miss] London fetched
    [cache hit] London (0s old)
    ```

!!! note "Production caching"
    For real APIs use **Redis** with `redis-py` or a decorator like `functools.lru_cache` for in-process caching. The dict approach above is fine for single-process demos.

---

## 5. Building a Weather Summary Function

Putting it all together into a clean summary formatter:

=== "Python"
    ```python
    def weather_summary(data: dict) -> str:
        lines = [
            f"City      : {data['name']}, {data['sys']['country']}",
            f"Temp      : {data['main']['temp']}°C",
            f"Feels like: {data['main']['feels_like']}°C",
            f"Humidity  : {data['main']['humidity']}%",
            f"Wind      : {data['wind']['speed']} m/s",
            f"Condition : {data['weather'][0]['description'].title()}",
        ]
        return "\n".join(lines)

    mock = {
        "name": "Dubai",
        "main": {"temp": 38.5, "feels_like": 42.0, "humidity": 55},
        "weather": [{"description": "sunny"}],
        "wind": {"speed": 3.1},
        "sys": {"country": "AE"},
    }
    print(weather_summary(mock))
    ```
=== "Output"
    ```
    City      : Dubai, AE
    Temp      : 38.5°C
    Feels like: 42.0°C
    Humidity  : 55%
    Wind      : 3.1 m/s
    Condition : Sunny
    ```

---

## 💻 Try It Yourself

Simulate a weather API response and print the city name, temperature, and description:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">mock_weather = {
    "name": "Paris",
    "main": {"temp": 18.3, "humidity": 65, "feels_like": 17.0},
    "weather": [{"description": "partly cloudy"}],
    "wind": {"speed": 4.5},
    "sys": {"country": "FR"},
}

city = mock_weather["name"]
temp = mock_weather["main"]["temp"]
desc = mock_weather["weather"][0]["description"].title()

print(f"City: {city}")
print(f"Temp: {temp}°C")
print(f"Condition: {desc}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Extract Wind Speed

Given the mock response below, extract the wind speed and print it in the format `Wind: 5.2 m/s`.

<div class="pyodide-runner" data-mode="challenge" data-expected="Wind: 5.2 m/s">
<pre><code class="language-python">mock = {
    "name": "London",
    "wind": {"speed": 5.2, "deg": 220},
    "main": {"temp": 12.4, "humidity": 78},
    "weather": [{"description": "light rain"}],
}

# Extract wind speed and print: Wind: 5.2 m/s
</code></pre>
</div>

---

### Challenge 2 — Find the Hottest City

Given a list of mock city weather records, print the name of the hottest city.

<div class="pyodide-runner" data-mode="challenge" data-expected="Dubai">
<pre><code class="language-python">cities = [
    {"name": "London", "main": {"temp": 12.4}},
    {"name": "Tokyo",  "main": {"temp": 24.1}},
    {"name": "Dubai",  "main": {"temp": 38.5}},
    {"name": "Oslo",   "main": {"temp": 5.2}},
]

# Find and print the name of the city with the highest temp
</code></pre>
</div>

---

## 📚 Further Reading

- [OpenWeatherMap Current Weather API Docs](https://openweathermap.org/current)
- [Real Python — Python Requests Library](https://realpython.com/python-requests/)
- [Caching in Python with Redis](https://realpython.com/python-redis/)

---

!!! success "Lesson Complete 🎉"
    You can now integrate a weather API, parse its JSON response, handle errors gracefully, and cache results to avoid unnecessary calls.

[⬅️ Lesson 20](../02-databases/20-database-migrations.md){ .md-button } [➡️ Lesson 22 · To-Do List REST API](22-todo-list-api.md){ .md-button .md-button--primary }
