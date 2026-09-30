---
title: "Lesson 71 · Serverless REST API on AWS Lambda"
description: "Master serverless computing with AWS Lambda and API Gateway: understand FaaS architecture, build Lambda handler functions, process HTTP events, configure cold start mitigations, manage layers, and test locally with AWS SAM."
---

# Lesson 71 · Serverless REST API on AWS Lambda

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain Function-as-a-Service (FaaS) concepts and serverless execution models
- [ ] Implement an AWS Lambda handler function accepting `event` and `context` objects
- [ ] Format proxy integration responses with `statusCode`, `headers`, and `body`
- [ ] Mitigate cold start latency using provisioned concurrency and lightweight packaging
- [ ] Organize reusable shared code and third-party dependencies using Lambda Layers
- [ ] Test, build, and emulate serverless REST APIs locally with the AWS SAM CLI

---

## 📖 Introduction

In traditional web hosting, backend servers run continuously 24/7, consuming resources and incurring costs even when idle. **Serverless computing**—specifically **Function-as-a-Service (FaaS)**—inverts this model: your Python code executes on-demand in ephemeral, managed containers triggered by external events such as HTTP requests, database mutations, or message queues.

AWS Lambda is the industry benchmark for FaaS. When combined with **Amazon API Gateway**, incoming HTTP requests are converted into structured JSON event dictionaries, routed to your Python handler function, and transformed back into standard HTTP responses.

```
Client HTTP Request
       │
       ▼
Amazon API Gateway (REST / HTTP API)
       │ (JSON event payload)
       ▼
AWS Lambda Execution Environment
┌──────────────────────────────────────────┐
│  def lambda_handler(event, context):     │
│      # Parse event, route, execute logic │
│      return {"statusCode": 200, ...}     │
└──────────────────────────────────────────┘
```

---

## 1. AWS Lambda Handler Anatomy and Proxy Integration

When API Gateway invokes a Lambda function via Lambda Proxy Integration, it passes all request details inside the `event` dictionary.

| Event Property | Type | Description |
|---|---|---|
| `httpMethod` / `rawPath` | `str` | HTTP verb (`GET`, `POST`, etc.) or request path |
| `pathParameters` | `dict` | Dynamic URL segments, e.g. `{"id": "101"}` |
| `queryStringParameters` | `dict` | Query string params, e.g. `{"limit": "10"}` |
| `headers` | `dict` | Request headers (case-insensitive in HTTP APIs) |
| `body` | `str` | Raw string payload (often JSON-encoded) |

=== "Basic Handler (app.py)"
    ```python
    import json

    def lambda_handler(event, context):
        method = event.get("httpMethod", "GET")
        path = event.get("path", "/")
        query = event.get("queryStringParameters") or {}
        
        print(f"Request: {method} {path} - Query: {query}")
        
        body_data = {}
        if event.get("body"):
            try:
                body_data = json.loads(event["body"])
            except json.JSONDecodeError:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": "Invalid JSON payload"})
                }
                
        response_payload = {
            "message": "Processed successfully",
            "received": body_data,
            "requestId": context.aws_request_id if context else "local"
        }
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(response_payload)
        }
    ```
=== "Routing Inside Lambda"
    ```python
    import json

    def get_items():
        return [{"id": 1, "name": "Cloud Book"}, {"id": 2, "name": "Serverless Guide"}]

    def create_item(payload):
        return {"id": 3, "name": payload.get("name", "Untitled")}

    def lambda_handler(event, context):
        path = event.get("resource") or event.get("rawPath", "/")
        method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "GET")

        if path == "/items" and method == "GET":
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(get_items())
            }
        elif path == "/items" and method == "POST":
            data = json.loads(event.get("body") or "{}")
            created = create_item(data)
            return {
                "statusCode": 201,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(created)
            }
        
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Resource not found"})
        }
    ```

---

## 2. Cold Starts and Execution Lifecycle

When an invocation request arrives and no idle container exists, AWS provisions an execution environment, downloads your code package, and initializes runtime dependencies. This is called a **Cold Start**.

```
Cold Start: [ Download Code ] -> [ Start Runtime ] -> [ Init Code (outside handler) ] -> [ Execute Handler ]
Warm Start:                                                                               [ Execute Handler ]
```

=== "Optimizing Initialization"
    ```python
    import json
    import os
    import boto3

    # GLOBAL SCOPE: Runs ONCE per cold start container boot
    # Reused across all subsequent warm invocations!
    DB_TABLE = os.environ.get("TABLE_NAME", "users-table")
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(DB_TABLE)

    def lambda_handler(event, context):
        # INVOCATION SCOPE: Runs on every single request
        item_id = event.get("pathParameters", {}).get("id")
        
        response = table.get_item(Key={"id": item_id})
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(response.get("Item", {}))
        }
    ```
=== "Best Practices Table"
    | Practice | Description | Impact |
    |---|---|---|
    | **Global Re-use** | Initialize DB connections & clients outside handler | Cuts latency by 80%+ |
    | **Minimal Dependencies** | Avoid large unneeded libraries; strip test files | Faster package download |
    | **Memory Allocation** | Assign 1792 MB+ for 1 full vCPU core | Speeds up CPU-bound init |
    | **Provisioned Concurrency** | Keeps pre-warmed execution environments ready | Zero cold start latency |

---

## 3. Environment Variables and Lambda Layers

Lambda Layers let you package shared utilities, custom runtimes, or heavy third-party wheels (such as `requests`, `numpy`, or `pydantic`) separately from your core function handler.

```
Layer Structure (zip file):
python/
  └── lib/
      └── python3.11/
          └── site-packages/
              └── requests/
```

=== "Layer Creation Commands"
    ```bash
    # Prepare layer directory
    mkdir -p layer/python/lib/python3.11/site-packages
    
    # Install dependencies into layer
    pip install requests pydantic -t layer/python/lib/python3.11/site-packages/
    
    # Package and publish
    cd layer && zip -r ../my-layer.zip . && cd ..
    aws lambda publish-layer-version \
      --layer-name shared-dependencies \
      --zip-file fileb://my-layer.zip \
      --compatible-runtimes python3.11
    ```
=== "Reading Env Variables"
    ```python
    import os
    import json

    API_SECRET = os.environ.get("API_SECRET_KEY")
    ENV_STAGE = os.environ.get("STAGE", "development")

    def lambda_handler(event, context):
        auth_header = event.get("headers", {}).get("Authorization", "")
        if auth_header != f"Bearer {API_SECRET}":
            return {
                "statusCode": 401,
                "body": json.dumps({"error": "Unauthorized"})
            }
        
        return {
            "statusCode": 200,
            "body": json.dumps({"status": "healthy", "stage": ENV_STAGE})
        }
    ```

---

## 4. Local Emulation with AWS SAM CLI

The **AWS Serverless Application Model (SAM)** provides an infrastructure-as-code template (`template.yaml`) and CLI to test functions locally using Docker containers that match the AWS Lambda runtime.

=== "template.yaml"
    ```yaml
    AWSTemplateFormatVersion: '2010-09-09'
    Transform: AWS::Serverless-2016-10-31
    Description: Serverless REST API

    Globals:
      Function:
        Timeout: 10
        MemorySize: 256
        Runtime: python3.11

    Resources:
      ApiFunction:
        Type: AWS::Serverless::Function
        Properties:
          CodeUri: src/
          Handler: app.lambda_handler
          Events:
            GetItems:
              Type: Api
              Properties:
                Path: /items
                Method: get
            CreateItem:
              Type: Api
              Properties:
                Path: /items
                Method: post
    ```
=== "SAM CLI Workflow"
    ```bash
    # Step 1: Validate template
    sam validate

    # Step 2: Build functions and dependencies
    sam build

    # Step 3: Run local HTTP API Gateway emulator on port 3000
    sam local start-api

    # Step 4: Invoke single function with mock event payload
    sam local invoke ApiFunction -e events/sample_event.json
    ```

---

## 💻 Try It Yourself

Simulate an AWS Lambda handler receiving an API Gateway proxy event, parsing query params, and returning a standard Lambda proxy integration response.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

# Simulated AWS API Gateway event dictionary
mock_event = {
    "httpMethod": "GET",
    "path": "/users",
    "queryStringParameters": {"status": "active"},
    "headers": {"Accept": "application/json"},
    "body": None
}

class MockContext:
    aws_request_id = "c6b7950b-3259-4594-a95b-078031958c36"
    function_name = "get_users_function"

def lambda_handler(event, context):
    method = event.get("httpMethod")
    query = event.get("queryStringParameters") or {}
    
    users = [
        {"id": 1, "name": "Ada Lovelace", "status": "active"},
        {"id": 2, "name": "Alan Turing", "status": "inactive"},
        {"id": 3, "name": "Grace Hopper", "status": "active"},
    ]
    
    if "status" in query:
        users = [u for u in users if u["status"] == query["status"]]
        
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "count": len(users),
            "users": users,
            "requestId": context.aws_request_id
        })
    }

response = lambda_handler(mock_event, MockContext())
print(f"Status Code: {response['statusCode']}")
print(f"Headers: {response['headers']}")
print(f"Body: {response['body']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Extract HTTP Method

Extract the HTTP method from the mock AWS Lambda API Gateway event and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="GET">
<pre><code class="language-python">mock_event = {
    "resource": "/orders",
    "path": "/orders",
    "httpMethod": "GET",
    "queryStringParameters": {"limit": "5"}
}

# Extract the HTTP method from mock_event and print it
</code></pre>
</div>

### Challenge 2 — JSON Response Serialization

Convert a Python result dictionary into a JSON string body inside a Lambda response object, and verify that the body string length is greater than 0 by printing the boolean expression `len(response["body"]) > 0`.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">import json

data = {"item_id": 101, "status": "confirmed"}

# Build response dict with "statusCode": 200 and "body": json.dumps(data)
# Print whether len(response["body"]) > 0
</code></pre>
</div>

---

## 📚 Further Reading

- [AWS Lambda Developer Guide for Python](https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html)
- [AWS Serverless Application Model (SAM) Specification](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-specification.html)
- [Serverless Architectures on AWS Best Practices](https://aws.amazon.com/architecture/serverless/)

---

!!! success "Lesson Complete 🎉"
    You understand how serverless compute functions execute on AWS Lambda, how API Gateway forwards HTTP events, and how to format proxy responses and optimize cold starts.

[⬅️ Section 8 Overview](index.md){ .md-button } [➡️ Lesson 72 · Google Cloud Functions Python API](72-google-cloud-functions.md){ .md-button .md-button--primary }
