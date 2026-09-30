---
title: "Lesson 45 · Message Queues with RabbitMQ"
description: "Master the producer/consumer pattern with RabbitMQ: exchanges, routing keys, durability, acknowledgements, dead letter queues, and the pika library."
---

# Lesson 45 · Message Queues with RabbitMQ

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** 40 min

## 🎯 Learning Objectives

- [ ] Explain the pub/sub and producer/consumer patterns and when to use them
- [ ] Describe RabbitMQ exchanges: direct, fanout, and topic
- [ ] Produce and consume messages using the `pika` library
- [ ] Enable message durability and queue persistence
- [ ] Use acknowledgements to prevent message loss
- [ ] Set up a dead letter queue for failed messages

## 📖 Introduction

A **message queue** decouples the services that produce work from the services that perform it. The producer drops a message into the queue and moves on; one or more consumers pick it up when they are ready. This buffers spikes, enables parallel processing, and keeps services independent.

**RabbitMQ** is the most widely used open-source message broker. It implements the AMQP protocol and offers flexible routing through *exchanges*, persistent storage, consumer acknowledgements, and dead letter queues for messages that cannot be processed.

!!! note "Running RabbitMQ locally"
    ```bash
    docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
    ```
    Management UI: http://localhost:15672 (guest / guest)

---

## 1. Pub/Sub vs Producer/Consumer

=== "Comparison"
    | Model | Sender | Receiver | Message fate |
    |-------|--------|----------|-------------|
    | **Producer/consumer** | Producer → queue | One consumer | Deleted after ACK |
    | **Pub/sub** | Publisher → exchange | All subscribers | Copied to each subscriber's queue |

=== "When to use each"
    ```
    Producer/consumer (work queue):
      - Email sending, image resizing, billing jobs
      - Want exactly-once processing
      - Load balance across multiple workers

    Pub/sub (fanout):
      - Broadcast events (cache invalidation, notifications)
      - Multiple independent consumers
      - Audit log + live dashboard simultaneously
    ```

---

## 2. RabbitMQ Exchanges

The exchange receives messages from producers and routes them to queues according to binding rules.

=== "Direct exchange"
    ```python
    # pip install pika
    import pika

    connection = pika.BlockingConnection(
        pika.ConnectionParameters("localhost")
    )
    channel = connection.channel()

    # Direct exchange routes by exact routing_key match
    channel.exchange_declare(exchange="orders", exchange_type="direct")
    channel.queue_declare(queue="new-orders", durable=True)
    channel.queue_bind(queue="new-orders", exchange="orders",
                       routing_key="order.new")

    channel.basic_publish(
        exchange="orders",
        routing_key="order.new",
        body=b'{"id": 1001, "total": 49.99}',
        properties=pika.BasicProperties(delivery_mode=2),  # persistent
    )
    connection.close()
    ```

=== "Fanout exchange"
    ```python
    channel.exchange_declare(exchange="events", exchange_type="fanout")

    # Bind two queues to the same fanout exchange
    channel.queue_bind(queue="audit-log",      exchange="events", routing_key="")
    channel.queue_bind(queue="notifications",  exchange="events", routing_key="")

    # Both queues receive EVERY message
    channel.basic_publish(exchange="events", routing_key="", body=b"order shipped")
    ```

=== "Topic exchange"
    ```python
    channel.exchange_declare(exchange="logs", exchange_type="topic")

    # Wildcards: * = one word, # = zero or more words
    channel.queue_bind(queue="errors",   exchange="logs", routing_key="*.error")
    channel.queue_bind(queue="all-logs", exchange="logs", routing_key="#")

    channel.basic_publish(exchange="logs",
                          routing_key="payment.error",
                          body=b"Payment timeout")
    # → goes to "errors" AND "all-logs"
    ```

| Exchange type | Routing logic | Use case |
|---------------|--------------|----------|
| `direct` | Exact `routing_key` match | Task queues |
| `fanout` | All bound queues | Broadcasting |
| `topic` | Pattern match (`*`, `#`) | Log routing, event streams |
| `headers` | Message header attributes | Content-based routing |

---

## 3. Consuming Messages & Acknowledgements

=== "Basic consumer"
    ```python
    def on_message(channel, method, properties, body):
        try:
            data = json.loads(body)
            process_order(data)
            channel.basic_ack(delivery_tag=method.delivery_tag)  # success
        except Exception as e:
            # Reject and requeue for retry
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    channel.basic_qos(prefetch_count=1)   # process one at a time
    channel.basic_consume(
        queue="new-orders",
        on_message_callback=on_message,
        auto_ack=False,   # manual ACK — safer
    )
    channel.start_consuming()
    ```

=== "ACK vs NACK"
    ```
    basic_ack  → message removed from queue (success)
    basic_nack → message rejected
      requeue=True  → back to head of queue (retry)
      requeue=False → dropped or sent to dead letter queue
    ```

!!! danger "Never set auto_ack=True in production"
    If your consumer crashes after receiving a message but before processing it, the message is silently lost. Manual ACK means unprocessed messages are returned to the queue.

---

## 4. Message Durability

For messages to survive a RabbitMQ restart, both the queue **and** the message must be marked durable/persistent.

=== "Durable setup"
    ```python
    # Queue must be declared durable
    channel.queue_declare(queue="tasks", durable=True)

    # Message must have delivery_mode=2 (persistent)
    channel.basic_publish(
        exchange="",
        routing_key="tasks",
        body=b"do something",
        properties=pika.BasicProperties(
            delivery_mode=2,          # persistent
            content_type="application/json",
        ),
    )
    ```

=== "What durability protects"
    | Scenario | `durable=False` | `durable=True` |
    |----------|-----------------|----------------|
    | Consumer crash | Messages safe | Messages safe |
    | Broker restart | **Queue & msgs lost** | Queue & msgs survive |
    | Network blip | Messages safe | Messages safe |

---

## 5. Dead Letter Queues

When a message is rejected (NACK without requeue) or expires, RabbitMQ can route it to a **dead letter exchange**.

=== "DLQ setup"
    ```python
    # 1. Declare the dead letter exchange and queue
    channel.exchange_declare(exchange="dlx", exchange_type="direct")
    channel.queue_declare(queue="dead-letters", durable=True)
    channel.queue_bind(queue="dead-letters", exchange="dlx",
                       routing_key="dead")

    # 2. Declare the main queue with DLX arguments
    channel.queue_declare(
        queue="tasks",
        durable=True,
        arguments={
            "x-dead-letter-exchange": "dlx",
            "x-dead-letter-routing-key": "dead",
            "x-message-ttl": 30_000,   # 30 s before expiry
        },
    )
    ```

=== "DLQ monitoring"
    ```python
    # Inspect dead letters
    def inspect_dlq(channel, method, props, body):
        print(f"Dead letter: {body.decode()}")
        print(f"  death reason: {props.headers.get('x-death')}")
        channel.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue="dead-letters",
                          on_message_callback=inspect_dlq)
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import collections

# Simulate a message queue with collections.deque
class SimpleQueue:
    def __init__(self, name: str, maxsize: int = 100):
        self.name = name
        self._queue = collections.deque(maxlen=maxsize)
        self.total_produced = 0
        self.total_consumed = 0

    def produce(self, message: str):
        self._queue.appendleft(message)
        self.total_produced += 1

    def consume(self) -> str | None:
        if self._queue:
            self.total_consumed += 1
            return self._queue.pop()
        return None

    def size(self) -> int:
        return len(self._queue)

# Simulate producing 5 messages
q = SimpleQueue("orders")
for i in range(1, 6):
    q.produce(f"order-{i:04d}")
    print(f"Produced: order-{i:04d}  (queue size: {q.size()})")

print()

# Consume all messages
print("Consuming...")
while True:
    msg = q.consume()
    if msg is None:
        break
    print(f"  Consumed: {msg}")

print(f"\nProduced: {q.total_produced}  Consumed: {q.total_consumed}  Remaining: {q.size()}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Produce 5, consume 3, count remaining**

<div class="pyodide-runner" data-mode="challenge" data-expected="2">

```python
import collections

queue = collections.deque()

# TODO: add 5 items to the queue, then remove 3, then print len(queue)
```

</div>

---

**Challenge 2 — Route messages to queues by routing key**

<div class="pyodide-runner" data-mode="challenge" data-expected="2\n3">

```python
import collections

queues = {"order": collections.deque(), "payment": collections.deque()}

messages = [
    ("order",   "order-001"),
    ("payment", "pay-001"),
    ("order",   "order-002"),
    ("payment", "pay-002"),
    ("payment", "pay-003"),
]

# TODO: route each message to the correct queue by routing_key
# then print len(queues["order"]) and len(queues["payment"]) on separate lines
```

</div>

---

## 📚 Further Reading

- [RabbitMQ Tutorials — pika](https://www.rabbitmq.com/tutorials)
- [RabbitMQ Exchanges, Queues and Bindings](https://www.rabbitmq.com/tutorials/amqp-concepts)
- [pika — PyPI](https://pypi.org/project/pika/)

---

!!! success "Lesson 45 complete!"
    You can now design producer/consumer systems with RabbitMQ, choose the right exchange type, consume messages with manual ACK, ensure durability, and route failed messages to a dead letter queue.

[⬅️ Previous Lesson](44-webhooks-fastapi.md){ .md-button } [➡️ Next Lesson](46-redis-pubsub.md){ .md-button .md-button--primary }
