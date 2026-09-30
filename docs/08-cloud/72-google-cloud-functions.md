---
title: "Lesson 72 · Google Cloud Functions Python API"
description: "Build serverless microservices with Google Cloud Functions (2nd gen): handle HTTP requests using Flask Request objects, process asynchronous Cloud Pub/Sub events, configure IAM roles, manage environment variables, and schedule cron triggers with Cloud Scheduler."
---

# Lesson 72 · Google Cloud Functions Python API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Compare Google Cloud Functions 1st gen vs 2nd gen (Cloud Run powered) architectures
- [ ] Write HTTP-triggered functions using the Flask-compatible `request` parameter
- [ ] Process asynchronous event-driven triggers from Cloud Pub/Sub and Cloud Storage
- [ ] Deploy serverless functions from the command line using `gcloud functions deploy`
- [ ] Manage runtime environment variables, secrets, and Cloud IAM least-privilege roles
- [ ] Automate scheduled batch invocations using Google Cloud Scheduler cron triggers

---

## 📖 Introduction

**Google Cloud Functions (GCF)** is Google Cloud's event-driven serverless compute platform. In **2nd gen**, Cloud Functions are built directly on top of Google Cloud Run and Knative, providing larger concurrency, request timeouts up to 60 minutes, and native support for Eventarc event routing.

Unlike AWS Lambda's raw dictionary payload, GCF HTTP functions natively receive a standard **Werkzeug/Flask `Request` object**, making HTTP parsing intuitive for Python web developers.

```
Incoming Request / Event
         │
         ├──► HTTP Trigger ──► Flask Request Object ──► def http_entrypoint(request):
         │                                                      │
         └──► Pub/Sub Event ──► CloudEvent / Base64 ──► def pubsub_entrypoint(cloud_event):
```

---

## 1. Cloud Functions Generations and HTTP Entrypoints

GCF 2nd generation provides major advantages over 1st generation:

| Feature | 1st Generation | 2nd Generation (Recommended) |
|---|---|---|
| Underlying Engine | Compute sandbox | Cloud Run / OCI Containers |
| Concurrency | 1 request per instance | Up to 1,000 concurrent requests |
| Max Request Timeout | 9 minutes (HTTP) | Up to 60 minutes |
| Event Source | Direct GCP Hooks | Eventarc (90+ event sources) |
| Traffic Splitting | No | Native canary / percentage rollouts |

=== "main.py (HTTP Function)"
    ```python
    import functions_framework
    from flask import Request, jsonify

    @functions_framework.http
    def process_order(request: Request):
        # Handle CORS preflight
        if request.method == "OPTIONS":
            headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST",
                "Access-Control-Allow-Headers": "Content-Type",
            }
            return ("", 204, headers)

        # Parse query params or JSON body
        if request.method == "GET":
            order_id = request.args.get("id")
            return jsonify({"status": "found", "order_id": order_id}), 200

        elif request.method == "POST":
            request_json = request.get_json(silent=True)
            if not request_json or "item" not in request_json:
                return jsonify({"error": "Missing 'item' field"}), 400
            
            item = request_json["item"]
            return jsonify({"status": "created", "item": item}), 201

        return jsonify({"error": "Method not allowed"}), 405
    ```
=== "requirements.txt"
    ```text
    functions-framework>=3.5.0
    flask>=3.0.0
    google-cloud-storage>=2.14.0
    ```

---

## 2. Event-Driven Triggers: Cloud Pub/Sub & CloudEvents

For asynchronous workloads (such as background processing or video encoding), Cloud Functions subscribe to **Pub/Sub topics** using the CloudEvents format.

```
Publisher ──► Pub/Sub Topic ──► Eventarc / Push ──► def handle_pubsub(cloud_event):
                                                          │
                                                    Base64 Decoded Payload
```

=== "Pub/Sub Handler (main.py)"
    ```python
    import base64
    import json
    import functions_framework
    from cloudevents.http import CloudEvent

    @functions_framework.cloud_event
    def handle_pubsub_message(cloud_event: CloudEvent):
        # Extract base64 encoded data from pub/sub payload
        pubsub_data = cloud_event.data["message"]["data"]
        raw_message = base64.b64decode(pubsub_data).decode("utf-8")
        
        event_dict = json.loads(raw_message)
        event_type = event_dict.get("event")
        user_id = event_dict.get("user_id")

        print(f"Received Pub/Sub event: {event_type} for user: {user_id}")
        
        # Perform asynchronous background task
        # (e.g., generate PDF report, send welcome email)
    ```
=== "Testing with Functions Framework CLI"
    ```bash
    # Install Framework locally for zero-deployment testing
    pip install functions-framework

    # Run HTTP function locally
    functions-framework --target=process_order --port=8080 --debug

    # Run CloudEvent Pub/Sub function locally
    functions-framework --target=handle_pubsub_message --signature-type=cloudevent --port=8080
    ```

---

## 3. Deployment with gcloud CLI and IAM Security

Deploying Python functions to GCP is performed using the `gcloud functions deploy` command.

=== "Deploy HTTP Function"
    ```bash
    gcloud functions deploy order-service \
      --gen2 \
      --runtime=python311 \
      --region=us-central1 \
      --source=. \
      --entry-point=process_order \
      --trigger-http \
      --allow-unauthenticated \
      --set-env-vars=ENVIRONMENT=production,DB_TIMEOUT=15 \
      --min-instances=0 \
      --max-instances=10
    ```
=== "Deploy Pub/Sub Trigger"
    ```bash
    gcloud functions deploy order-subscriber \
      --gen2 \
      --runtime=python311 \
      --region=us-central1 \
      --source=. \
      --entry-point=handle_pubsub_message \
      --trigger-topic=orders-topic \
      --service-account=orders-sa@my-project.iam.gserviceaccount.com
    ```
=== "IAM Least Privilege"
    | Role | Purpose | Recommended For |
    |---|---|---|
    | `roles/cloudfunctions.invoker` | Allows calling HTTP functions | API Gateway / Authenticated clients |
    | `roles/pubsub.subscriber` | Receive messages from topic | Event consumer service accounts |
    | `roles/secretmanager.secretAccessor` | Read credentials at runtime | Functions accessing private APIs |

---

## 4. Scheduling Cron Jobs with Cloud Scheduler

To run recurring cron tasks (such as hourly metric summaries or nightly cleanup), connect **Google Cloud Scheduler** to your Cloud Function's HTTP trigger.

```
┌────────────────────────┐      POST /cleanup (OIDC token)      ┌─────────────────────────┐
│ Google Cloud Scheduler ├─────────────────────────────────────►│ Google Cloud Function   │
│ Cron: 0 2 * * *        │                                      │ Verify Auth & Run Batch │
└────────────────────────┘                                      └─────────────────────────┘
```

=== "Create Cron Schedule"
    ```bash
    gcloud scheduler jobs create http nightly-cleanup-job \
      --location=us-central1 \
      --schedule="0 2 * * *" \
      --time-zone="America/New_York" \
      --uri="https://us-central1-my-project.cloudfunctions.net/order-service" \
      --http-method=POST \
      --oidc-service-account-email="scheduler-sa@my-project.iam.gserviceaccount.com" \
      --message-body='{"action": "cleanup_archived_records"}'
    ```
=== "Validating Scheduler Token"
    ```python
    import os
    from flask import Request, jsonify

    def cron_entrypoint(request: Request):
        # When using OIDC, GCP passes verified claims in authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized cron request"}), 401

        payload = request.get_json(silent=True) or {}
        action = payload.get("action", "default_sync")
        print(f"Executing scheduled cron task: {action}")
        
        return jsonify({"status": "success", "task": action}), 200
    ```

---

## 💻 Try It Yourself

Simulate a Google Cloud Functions HTTP entrypoint processing a mock Flask-like request object and returning a status tuple.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

class MockFlaskRequest:
    def __init__(self, method="GET", args=None, json_data=None, headers=None):
        self.method = method
        self.args = args or {}
        self._json_data = json_data or {}
        self.headers = headers or {}

    def get_json(self, silent=True):
        return self._json_data

def cloud_function_entrypoint(request):
    if request.method == "GET":
        name = request.args.get("name", "World")
        return {"greeting": f"Hello, {name}!", "runtime": "GCF Python 3.11"}, 200
    elif request.method == "POST":
        data = request.get_json()
        item = data.get("item", "unknown")
        return {"created": item, "status": "active"}, 201
    return {"error": "Method Not Allowed"}, 405

# Test GET request with query params
req = MockFlaskRequest(method="GET", args={"name": "Cloud Engineer"})
body, status_code = cloud_function_entrypoint(req)

print(f"HTTP Status: {status_code}")
print(f"Response Body: {json.dumps(body)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Parse GCF Query Parameter

Process a mock request dictionary containing query parameters and print a greeting in the exact format `"Hello, <name>!"` when `name` is `"GCP"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="Hello, GCP!">
<pre><code class="language-python">mock_request = {
    "method": "GET",
    "args": {"name": "GCP"}
}

# Extract the "name" argument from mock_request["args"]
# Print "Hello, " followed by the name and an exclamation point
</code></pre>
</div>

### Challenge 2 — Decode Pub/Sub Base64 Message

Simulate a Cloud Function Pub/Sub event: decode the base64-encoded string and print the event message name.

<div class="pyodide-runner" data-mode="challenge" data-expected="order.created">
<pre><code class="language-python">import base64
import json

mock_pubsub_event = {
    "data": {
        "message": {
            "data": "eyJldmVudF9uYW1lIjogIm9yZGVyLmNyZWF0ZWQiLCAiYW1vdW50IjogNDkuOTV9"
        }
    }
}

# 1. Extract the base64 string from mock_pubsub_event["data"]["message"]["data"]
# 2. Decode from base64 to utf-8 text
# 3. Parse JSON and print event_name
</code></pre>
</div>

---

## 📚 Further Reading

- [Google Cloud Functions Python Quickstart](https://cloud.google.com/functions/docs/quickstart-python)
- [Functions Framework for Python](https://github.com/GoogleCloudPlatform/functions-framework-python)
- [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)

---

!!! success "Lesson Complete 🎉"
    You now understand Google Cloud Functions 2nd gen architecture, handling HTTP requests using Flask Request semantics, consuming Pub/Sub events, and scheduling cron executions.

[⬅️ Lesson 71 · Serverless AWS Lambda](71-serverless-aws-lambda.md){ .md-button } [➡️ Lesson 73 · Azure Functions Python HTTP API](73-azure-functions.md){ .md-button .md-button--primary }
