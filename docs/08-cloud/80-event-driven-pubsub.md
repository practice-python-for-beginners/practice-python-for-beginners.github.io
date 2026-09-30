---
title: "Lesson 80 · Event-Driven Pub/Sub API"
description: "Master event-driven architecture and asynchronous messaging in Python: implement publishers and subscribers, compare Google Cloud Pub/Sub and AWS SNS/SQS, handle message deduplication, and configure Dead Letter Queues."
---

# Lesson 80 · Event-Driven Pub/Sub API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain the core principles of Event-Driven Architecture (EDA) and loose service coupling
- [ ] Compare Google Cloud Pub/Sub, AWS SNS/SQS, and Apache Kafka messaging topologies
- [ ] Implement event publisher and subscriber handlers with ordering keys
- [ ] Design Push vs Pull subscription consumption patterns in FastAPI
- [ ] Handle poison pills and failed messages using Dead Letter Topics (DLQs)
- [ ] Guarantee at-least-once delivery and message deduplication idempotency

---

## 📖 Introduction

In tightly coupled synchronous REST microservices, if Service B is slow or down, Service A fails as well (cascading failures). In an **Event-Driven Architecture (EDA)**, services communicate by emitting asynchronous **events** to a topic broker without knowing who is listening.

Multiple downstream subscribers consume and process these events independently and at their own pace.

```
Synchronous REST (Tightly Coupled):
Order API ─── HTTP POST (Blocking) ───► Payment API ─── HTTP POST (Blocking) ───► Inventory API

Event-Driven Pub/Sub (Loosely Coupled):
Order API ──► Publishes "order.created" ──► Event Broker (Pub/Sub / SNS)
                                                   ├──► Payment Worker (consumes)
                                                   ├──► Inventory Worker (consumes)
                                                   └──► Email Notification Service (consumes)
```

---

## 1. Google Cloud Pub/Sub and AWS SNS/SQS Paradigms

| Feature | Google Cloud Pub/Sub | AWS SNS + SQS Fanout |
|---|---|---|
| Topology | Unified Topics & Subscriptions | SNS (Topic/Broadcast) + SQS (Queue/Buffer) |
| Delivery Model | Pull (gRPC worker) or Push (HTTP webhook) | Push (HTTP/Lambda) or Pull (SQS Poll) |
| Ordering | Ordering keys per partition | SQS FIFO message group IDs |
| Poison Messages | Dead Letter Topics | SQS Dead Letter Queues (DLQ) |
| Replay Ability | Seek / Snapshot to past timestamp | SQS (No replay; Kafka / Kinesis used) |

=== "GCP Pub/Sub Publisher"
    ```python
    import os
    import json
    from google.cloud import pubsub_v1

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path("my-gcp-project", "orders-topic")

    def publish_order_event(order_id: str, amount: float, customer_id: str):
        payload = {
            "event_type": "order.created",
            "order_id": order_id,
            "amount": amount,
            "customer_id": customer_id
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        
        # Publish with ordering key ensuring sequential processing per customer
        future = publisher.publish(
            topic_path,
            data=data_bytes,
            ordering_key=customer_id
        )
        message_id = future.result()
        print(f"Published event {message_id} for order {order_id}")
        return message_id
    ```
=== "Push Webhook Consumer (FastAPI)"
    ```python
    import base64
    import json
    from fastapi import FastAPI, Request, HTTPException

    app = FastAPI()

    @app.post("/pubsub/orders-push")
    async def process_pubsub_push(request: Request):
        envelope = await request.json()
        if not envelope or "message" not in envelope:
            raise HTTPException(status_code=400, detail="Invalid Pub/Sub envelope")
            
        message = envelope["message"]
        data_str = base64.b64decode(message["data"]).decode("utf-8")
        event = json.loads(data_str)
        
        print(f"Received push event: {event.get('event_type')} (ID: {message.get('messageId')})")
        
        # Return 200 OK to ACK message; returning 500 will cause Pub/Sub to retry
        return {"status": "ACK"}
    ```

---

## 2. Push vs Pull Subscriptions

- **Push Subscriptions:** The Pub/Sub broker initiates HTTP `POST` requests to your webhook endpoint. Ideal for serverless setups (Cloud Run, Cloud Functions) with automatic auto-scaling.
- **Pull Subscriptions:** Your worker services initiate long-polling loops over high-throughput streaming gRPC connections. Ideal for high-volume, batch-processing background containers.

=== "Streaming Pull Worker"
    ```python
    from google.cloud import pubsub_v1

    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path("my-gcp-project", "orders-worker-sub")

    def callback(message: pubsub_v1.subscriber.message.Message):
        try:
            payload = json.loads(message.data.decode("utf-8"))
            print(f"Processing Order: {payload['order_id']}")
            
            # Acknowledge completion
            message.ack()
        except Exception as e:
            print(f"Error processing message: {e}")
            # Negative ACK triggers immediate redelivery
            message.nack()

    streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
    ```

---

## 3. Dead Letter Topics and Poison Pill Handling

A **poison pill** is a corrupted message that repeatedly crashes consumer processes. After a configurable number of retry attempts (e.g. 5 failed deliveries), the broker routes the bad message to a **Dead Letter Topic (DLQ)** to unblock the main processing queue.

```
Main Topic ──► 5 Delivery Failures (NACKs) ──► Dead Letter Queue (DLQ)
                                                      │
                                                      ▼
                                         Alerting & Manual Inspection
```

---

## 4. Idempotent Processing and Exactly-Once Semantics

Distributed messaging systems guarantee **at-least-once delivery**. Consumers must track processed `messageId`s in a fast cache (e.g., Redis) to prevent duplicate processing.

| Step | Action |
|---|---|
| 1 | Consumer receives message with ID `msg_123` |
| 2 | Check `redis.set("processed:msg_123", "1", nx=True, ex=86400)` |
| 3 | If key already existed, immediately `ack()` and skip execution |
| 4 | If key is new, execute side-effects (charge card, update DB) and `ack()` |

---

## 💻 Try It Yourself

Implement a complete in-memory event bus supporting topic subscriptions, event publishing, and subscriber callbacks.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory Event Bus Simulator
class EventBus:
    def __init__(self):
        self.subscribers = {}

    def subscribe(self, topic, callback):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(callback)

    def publish(self, topic, event_data):
        delivered = 0
        if topic in self.subscribers:
            for cb in self.subscribers[topic]:
                cb(event_data)
                delivered += 1
        return delivered

bus = EventBus()
events_received = []

# Register consumer callbacks
bus.subscribe("order.created", lambda e: events_received.append(f"Worker 1: {e['order_id']}"))
bus.subscribe("order.created", lambda e: events_received.append(f"Worker 2: {e['order_id']}"))

# Publish event
count = bus.publish("order.created", {"order_id": "ORD-9021", "amount": 129.50})

print(f"Delivered message to {count} subscribers.")
for entry in events_received:
    print(f" - {entry}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Publish to Subscribers

Publish the `"order.created"` event to 2 registered subscribers on an event bus, and print the total number of delivered messages.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">subscribers = ["notification_service", "billing_service"]
delivered = 0

event = {"type": "order.created", "order_id": "1001"}

# For each subscriber in subscribers list, increment delivered counter by 1
# Print the delivered count integer
</code></pre>
</div>

### Challenge 2 — Topic Event Filtering

Simulate an event router that filters events by topic prefix. Count and print how many events match the `"payment."` prefix out of the list.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">events = [
    {"topic": "payment.succeeded", "id": 1},
    {"topic": "order.created", "id": 2},
    {"topic": "payment.failed", "id": 3},
    {"topic": "user.registered", "id": 4},
]

# Count how many events have a topic starting with "payment."
# Print the count integer
</code></pre>
</div>

---

## 📚 Further Reading

- [Google Cloud Pub/Sub Architectural Overview](https://cloud.google.com/pubsub/docs/overview)
- [Enterprise Integration Patterns: Publish-Subscribe Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PublishSubscribeChannel.html)
- [AWS SNS vs SQS Architecture Comparison](https://aws.amazon.com/pub-sub-messaging/)

---

!!! success "Section 8 Complete! 🎉"
    You have mastered serverless computing across AWS Lambda, Google Cloud Functions, and Azure Functions, built real-time WebSocket APIs, managed object storage, instrumented Prometheus observability, integrated Stripe payments and OAuth 2.0 social authentication, and architected event-driven pub/sub systems.

[⬅️ Lesson 79 · Social Login with OAuth](79-social-login-oauth.md){ .md-button } [➡️ Section 9 · Machine Learning & AI APIs](../09-ml-ai/index.md){ .md-button .md-button--primary }
