---
title: "Lesson 89 · AI Chatbot API"
description: "Build an AI chatbot API with OpenAI integration, conversation history management, and a /chat endpoint."
---

# Lesson 89 · AI Chatbot API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Understand chatbot architectures (rule-based vs generative)
- [ ] Integrate OpenAI's Chat Completions API
- [ ] Manage conversation history as a message list
- [ ] Design an effective system prompt
- [ ] Build a `/chat` endpoint with per-user conversation state

---

## 📖 Introduction

Chatbots range from simple keyword matchers to full generative AI. This lesson builds both: a rule-based chatbot as a baseline, and an OpenAI-powered generative chatbot for production.

---

## 1. Rule-Based Chatbot

Fast and predictable — great for structured workflows (FAQs, guided forms).

=== "Python"
    ```python
    RESPONSES = {
        "hello":   "Hi there! How can I help?",
        "hi":      "Hi there! How can I help?",
        "bye":     "Goodbye! Have a great day!",
        "help":    "I can answer questions about Python, APIs, and databases.",
        "python":  "Python is a versatile language great for web, data science, and AI!",
    }

    def rule_based_reply(message: str) -> str:
        tokens = message.lower().split()
        for token in tokens:
            if token in RESPONSES:
                return RESPONSES[token]
        return "I'm not sure about that. Try asking about Python or APIs!"

    print(rule_based_reply("Hello, can you help me?"))
    print(rule_based_reply("Tell me about python"))
    print(rule_based_reply("What is the weather?"))
    ```
=== "Output"
    ```
    Hi there! How can I help?
    Python is a versatile language great for web, data science, and AI!
    I'm not sure about that. Try asking about Python or APIs!
    ```

---

## 2. OpenAI Chat Completions

```python
from openai import OpenAI

client = OpenAI()   # reads OPENAI_API_KEY from environment

def chat(messages: list, model="gpt-4o-mini") -> str:
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=500,
    )
    return response.choices[0].message.content

# System prompt defines the bot's persona
conversation = [
    {"role": "system", "content":
        "You are a helpful Python tutor. Answer clearly and concisely. "
        "Give code examples when relevant."},
    {"role": "user", "content": "What is a list comprehension?"},
]

reply = chat(conversation)
print(reply)
```

!!! tip "System prompt tips"
    - Be specific about the persona, tone, and domain
    - Specify output format ("Always use bullet points")
    - Add constraints ("Keep answers under 3 sentences for quick replies")

---

## 3. Conversation History Management

```python
from collections import defaultdict

# In-memory session store (use Redis for production)
sessions: dict[str, list] = defaultdict(list)

SYSTEM_PROMPT = {
    "role": "system",
    "content": "You are a helpful Python programming tutor."
}

def get_reply(session_id: str, user_message: str) -> str:
    history = sessions[session_id]
    if not history:
        history.append(SYSTEM_PROMPT)

    history.append({"role": "user", "content": user_message})

    # Trim to last N turns to stay within token limits
    MAX_TURNS = 10
    trimmed = [history[0]] + history[-MAX_TURNS * 2:]

    reply = chat(trimmed)
    history.append({"role": "assistant", "content": reply})
    return reply
```

---

## 4. FastAPI `/chat` Endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    reply = get_reply(req.session_id, req.message)
    return {
        "session_id": req.session_id,
        "reply": reply,
        "turns": len(sessions[req.session_id]) // 2,
    }

@app.delete("/chat/{session_id}")
def clear_history(session_id: str):
    sessions.pop(session_id, None)
    return {"cleared": session_id}
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">RESPONSES = {
    "hello":   "Hi there! How can I help?",
    "hi":      "Hi there! How can I help?",
    "bye":     "Goodbye! Have a great day!",
    "help":    "I can help with Python questions.",
    "python":  "Python is great for web dev, data science, and AI!",
    "list":    "A list is an ordered, mutable collection: [1, 2, 3]",
    "dict":    "A dict stores key-value pairs: {'key': 'value'}",
}

def chatbot(message):
    tokens = message.lower().strip("?!.,").split()
    for token in tokens:
        if token in RESPONSES:
            return RESPONSES[token]
    return "Hmm, I don't know about that. Ask me about Python!"

# Simulate a conversation
conversation = [
    "hello",
    "What is a python list?",
    "Tell me about dicts",
    "bye",
]

for msg in conversation:
    reply = chatbot(msg)
    print(f"User: {msg}")
    print(f"Bot:  {reply}\n")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Keyword Response

Build a chatbot that returns `"Hi there! How can I help?"` when given `"hello"` as input.

Expected output:
```
Hi there! How can I help?
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Hi there! How can I help?">
<pre><code class="language-python">RESPONSES = {
    "hello": "Hi there! How can I help?",
    "bye":   "Goodbye!",
}

def chatbot(message):
    return RESPONSES.get(message.lower().strip(), "I don't understand.")

print(chatbot("hello"))
</code></pre>
</div>

---

### Challenge 2 — Conversation Length

Count the number of turns in the conversation history below.

Expected output:
```
4
```

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">history = [
    {"role": "system",    "content": "You are a helpful tutor."},
    {"role": "user",      "content": "What is Python?"},
    {"role": "assistant", "content": "Python is a programming language."},
    {"role": "user",      "content": "What is Flask?"},
    {"role": "assistant", "content": "Flask is a web framework."},
]

# Count the number of turns (user + assistant pairs, exclude system)
turns = len([m for m in history if m["role"] != "system"]) // 2
print(turns)
</code></pre>
</div>

---

## 📚 Further Reading

- [OpenAI Chat Completions API](https://platform.openai.com/docs/guides/chat)
- [Building a Chatbot with FastAPI — Real Python](https://realpython.com/build-a-chatbot-python-chatterbot/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

!!! success "Lesson Complete 🎉"
    You can now build both rule-based and AI-powered chatbot APIs with conversation history management.

[⬅️ Lesson 88 · Anomaly Detection](88-anomaly-detection-api.md){ .md-button } [➡️ Lesson 90 · MLOps Basics](90-mlops-basics.md){ .md-button .md-button--primary }
