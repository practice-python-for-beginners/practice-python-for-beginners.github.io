---
title: "Lesson 73 · Azure Functions Python HTTP API"
description: "Develop serverless solutions with Azure Functions in Python: master the V2 programming model, configure HTTP trigger and output bindings, manage application settings, test with Azure Functions Core Tools, and orchestrate workflows with Durable Functions."
---

# Lesson 73 · Azure Functions Python HTTP API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Structure Python Azure Functions using both the classic V1 (`function.json`) and modern V2 decorator models
- [ ] Parse incoming `func.HttpRequest` objects and generate structured `func.HttpResponse` outputs
- [ ] Configure input, output, and trigger bindings declaratively without boilerplate SDK clients
- [ ] Run and debug serverless apps locally using the Azure Functions Core Tools (`func start`)
- [ ] Deploy function apps via Azure CLI and manage Application Settings (environment variables)
- [ ] Implement stateful, long-running workflows using Python Durable Functions

---

## 📖 Introduction

**Azure Functions** is Microsoft Azure's serverless compute offering. It features a unique **Bindings and Triggers** system that connects your Python code directly to cloud resources (such as Azure Blob Storage, Cosmos DB, and Event Grid) without requiring manual connection client initialization.

Azure Functions supports two Python development models: the classic **V1 model** (folder-per-function with `function.json` manifests) and the recommended **V2 programming model** (decorator-based in a single `function_app.py`, similar to FastAPI and Flask).

```
V1 Model: [ Folder / function.json ] ──► __init__.py (main(req: HttpRequest))
V2 Model: function_app.py ──► @app.route(route="items") def get_items(req)
```

---

## 1. Azure Functions Project Architecture: V1 vs V2 Model

In the modern **V2 programming model**, triggers and bindings are configured directly via decorators in `function_app.py`.

=== "Modern V2 Model (function_app.py)"
    ```python
    import azure.functions as func
    import json
    import logging

    app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

    @app.route(route="users", methods=["GET", "POST"])
    def users_handler(req: func.HttpRequest) -> func.HttpResponse:
        logging.info("Processing users HTTP request.")
        
        if req.method == "GET":
            role = req.params.get("role", "all")
            data = [{"id": 1, "name": "Alice", "role": "admin"}]
            return func.HttpResponse(
                body=json.dumps({"filter": role, "users": data}),
                status_code=200,
                mimetype="application/json"
            )

        elif req.method == "POST":
            try:
                req_body = req.get_json()
            except ValueError:
                return func.HttpResponse("Invalid JSON", status_code=400)
                
            name = req_body.get("name")
            return func.HttpResponse(
                body=json.dumps({"id": 102, "name": name, "created": True}),
                status_code=201,
                mimetype="application/json"
            )
    ```
=== "Classic V1 Model (function.json)"
    ```json
    {
      "scriptFile": "__init__.py",
      "bindings": [
        {
          "authLevel": "anonymous",
          "type": "httpTrigger",
          "direction": "in",
          "name": "req",
          "methods": ["get", "post"],
          "route": "users"
        },
        {
          "type": "http",
          "direction": "out",
          "name": "$return"
        }
      ]
    }
    ```
=== "Classic V1 Handler (__init__.py)"
    ```python
    import logging
    import azure.functions as func
    import json

    def main(req: func.HttpRequest) -> func.HttpResponse:
        logging.info("Python HTTP trigger function processed a request.")
        user_id = req.params.get("id")
        
        return func.HttpResponse(
            body=json.dumps({"user_id": user_id, "status": "active"}),
            mimetype="application/json",
            status_code=200
        )
    ```

---

## 2. Request & Response Model and Output Bindings

Azure Functions provides declarative **Output Bindings** to send data directly to other Azure services (e.g. Blob Storage, Queue Storage) without SDK code.

```
Incoming HTTP POST ──► Python Function ──► HTTP 201 Response (return)
                             │
                             └──► Output Binding ──► Azure Storage Queue
```

=== "Queue Output Binding"
    ```python
    import azure.functions as func
    import json

    app = func.FunctionApp()

    @app.route(route="orders")
    @app.queue_output(arg_name="msg", queue_name="orders-queue", connection="AzureWebJobsStorage")
    def create_order(req: func.HttpRequest, msg: func.Out[str]) -> func.HttpResponse:
        body = req.get_json()
        
        # Write to Azure Queue Storage automatically via binding!
        msg.set(json.dumps(body))
        
        return func.HttpResponse(
            json.dumps({"status": "queued", "order": body}),
            status_code=202,
            mimetype="application/json"
        )
    ```
=== "Application Settings (local.settings.json)"
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_WORKER_RUNTIME": "python",
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/db",
        "API_KEY": "secret-token-value"
      }
    }
    ```

---

## 3. Local Development with Azure Functions Core Tools

The **Azure Functions Core Tools** (`func`) lets you run the Azure runtime on your local machine with full debugging capabilities.

| Command | Purpose |
|---|---|
| `func init my-project --python --model V2` | Scaffold a new Python V2 Functions project |
| `func new --name HttpTrigger --template "HTTP trigger"` | Create a new function trigger |
| `func start` | Start the local Functions host runtime |
| `az functionapp create ...` | Provision Azure Function App infrastructure |
| `func azure functionapp publish <AppName>` | Package and deploy to Azure Cloud |

=== "Local Run & Deploy Commands"
    ```bash
    # 1. Start local runtime
    func start

    # 2. Login to Azure CLI
    az login

    # 3. Create Resource Group & Storage Account
    az group create --name my-rg --location eastus
    az storage account create --name mystorageacct --location eastus --resource-group my-rg --sku Standard_LRS

    # 4. Create Function App in Azure
    az functionapp create \
      --resource-group my-rg \
      --consumption-plan-location eastus \
      --runtime python \
      --runtime-version 3.11 \
      --functions-version 4 \
      --name my-python-func-app \
      --storage-account mystorageacct \
      --os-type linux

    # 5. Publish code to Azure
    func azure functionapp publish my-python-func-app
    ```

---

## 4. Orchestrating Workflows with Durable Functions

**Durable Functions** is an extension that allows writing stateful workflows in serverless environments using the **Orchestrator Pattern** (managing retries, parallel fan-out/fan-in, and human approvals).

```
HTTP Starter ──► Orchestrator Function (yields steps)
                         ├──► Activity 1: Charge Card
                         ├──► Activity 2: Reserve Inventory
                         └──► Activity 3: Send Confirmation
```

=== "Durable Orchestrator"
    ```python
    import azure.functions as func
    import azure.durable_functions as df

    my_app = df.DFApp(http_auth_level=func.AuthLevel.ANONYMOUS)

    # 1. Orchestrator
    @my_app.orchestration_trigger(context_name="context")
    def order_orchestrator(context: df.DurableOrchestrationContext):
        order_data = context.get_input()
        
        # Step 1: Charge payment
        charge_result = yield context.call_activity("charge_payment", order_data)
        
        # Step 2: Reserve inventory
        inventory_result = yield context.call_activity("reserve_inventory", order_data)
        
        return {"payment": charge_result, "inventory": inventory_result}

    # 2. Activity Function
    @my_app.activity_trigger(input_name="order")
    def charge_payment(order: dict):
        return f"Charged ${order.get('amount')} successfully"

    # 3. HTTP Client Starter
    @my_app.route(route="start-order")
    @my_app.durable_client_input(client_name="client")
    async def http_start(req: func.HttpRequest, client: df.DurableOrchestrationClient):
        instance_id = await client.start_new("order_orchestrator", None, req.get_json())
        return client.create_check_status_response(req, instance_id)
    ```

---

## 💻 Try It Yourself

Simulate an Azure Function HTTP trigger processing an incoming request object and building a structured response.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

class MockHttpRequest:
    def __init__(self, method="GET", params=None, body=None):
        self.method = method
        self.params = params or {}
        self._body = body or b""

    def get_json(self):
        return json.loads(self._body.decode("utf-8"))

class MockHttpResponse:
    def __init__(self, body, status_code=200, mimetype="application/json"):
        self.body = body
        self.status_code = status_code
        self.mimetype = mimetype

def azure_function_main(req: MockHttpRequest) -> MockHttpResponse:
    user_id = req.params.get("id")
    if not user_id:
        return MockHttpResponse(
            body=json.dumps({"error": "Missing 'id' query parameter"}),
            status_code=400
        )
    
    user_record = {
        "user_id": int(user_id),
        "name": "Dev",
        "cloud": "Azure Functions",
        "status": "Online"
    }
    
    return MockHttpResponse(
        body=json.dumps(user_record),
        status_code=200
    )

# Test invocation
req = MockHttpRequest(method="GET", params={"id": "42"})
res = azure_function_main(req)

print(f"HTTP Status: {res.status_code}")
print(f"Content-Type: {res.mimetype}")
print(f"Payload: {res.body}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Extract User ID

Extract the `user_id` value from the mock Azure Function HTTP request body dictionary and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="42">
<pre><code class="language-python">mock_request = {
    "method": "POST",
    "body": {
        "user_id": "42",
        "action": "login"
    }
}

# Extract "user_id" from mock_request["body"] and print it
</code></pre>
</div>

### Challenge 2 — Build Azure Function Response

Build a function response dictionary with `"status_code": 200` and `"body": "OK"`, and print the `"status_code"` value.

<div class="pyodide-runner" data-mode="challenge" data-expected="200">
<pre><code class="language-python"># Build a response dictionary containing:
# "status_code": 200
# "body": "OK"
# Then print response["status_code"]
</code></pre>
</div>

---

## 📚 Further Reading

- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [Azure Functions V2 Python Programming Model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python?tabs=get-started%2Casgi%2Capplication-level#python-v2-model)
- [Durable Functions for Python](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview?tabs=python)

---

!!! success "Lesson Complete 🎉"
    You now understand Azure Functions architectures, HTTP triggers in the V2 decorator model, local testing with Azure Functions Core Tools, and workflow orchestration using Durable Functions.

[⬅️ Lesson 72 · Google Cloud Functions Python API](72-google-cloud-functions.md){ .md-button } [➡️ Lesson 74 · Cloud Storage File API](74-cloud-storage-api.md){ .md-button .md-button--primary }
