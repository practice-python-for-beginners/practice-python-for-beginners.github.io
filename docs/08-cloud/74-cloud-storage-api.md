---
title: "Lesson 74 · Cloud Storage File API"
description: "Master object storage operations with AWS S3 (boto3) and Google Cloud Storage: handle file uploads and downloads, generate secure presigned URLs, manage object metadata and ACLs, stream large binary files, and integrate with CDNs."
---

# Lesson 74 · Cloud Storage File API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Perform programmatic CRUD operations on AWS S3 buckets using the `boto3` SDK
- [ ] Connect and manage Google Cloud Storage buckets using `google-cloud-storage`
- [ ] Generate time-limited presigned URLs for secure direct-to-cloud uploads and downloads
- [ ] Read, write, and query user-defined object metadata and access control lists (ACLs)
- [ ] Stream multi-gigabyte files efficiently without exhausting server RAM
- [ ] Configure cache headers and origins for CDN distribution via CloudFront or Cloud CDN

---

## 📖 Introduction

Modern cloud architectures separate stateless compute from file storage. Instead of storing uploaded assets (images, videos, CSV reports, backups) on local disks, applications store objects in **Cloud Object Storage** such as **Amazon S3** or **Google Cloud Storage (GCS)**.

Object stores provide 99.999999999% (11 9's) durability, unlimited elastic scaling, metadata indexing, and fine-grained access delegation via **Presigned URLs**.

```
Direct-to-Cloud Upload Flow:
1. Client requests upload URL ──► Backend API (Generates S3 Presigned URL)
2. Backend returns Presigned URL ──► Client
3. Client streams file payload directly ──► Amazon S3 / GCS Bucket (Zero server load!)
```

---

## 1. AWS S3 Operations with Boto3

The `boto3` library provides both high-level resource abstractions and low-level client APIs for AWS S3.

| Operation | Boto3 Method | Description |
|---|---|---|
| Upload file | `s3.upload_fileobj(file_obj, bucket, key)` | Streams file-like object to bucket |
| Download object | `s3.get_object(Bucket=b, Key=k)` | Returns response stream + metadata |
| List objects | `s3.list_objects_v2(Bucket=b, Prefix=p)` | Paginates keys matching prefix |
| Delete object | `s3.delete_object(Bucket=b, Key=k)` | Removes specified key from bucket |

=== "s3_service.py"
    ```python
    import boto3
    from botocore.exceptions import ClientError
    import io

    s3_client = boto3.client("s3", region_name="us-east-1")
    BUCKET_NAME = "production-app-media-files"

    def upload_user_file(file_bytes: bytes, filename: str, content_type: str) -> str:
        """Uploads in-memory bytes directly to S3 with custom metadata."""
        try:
            s3_client.upload_fileobj(
                Fileobj=io.BytesIO(file_bytes),
                Bucket=BUCKET_NAME,
                Key=f"uploads/{filename}",
                ExtraArgs={
                    "ContentType": content_type,
                    "Metadata": {"uploaded_by": "api_service", "version": "1.0"}
                }
            )
            return f"https://{BUCKET_NAME}.s3.amazonaws.com/uploads/{filename}"
        except ClientError as e:
            print(f"S3 Upload failed: {e}")
            raise

    def list_bucket_files(prefix: str = "uploads/") -> list[dict]:
        """Lists files matching prefix."""
        response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix=prefix)
        files = []
        for item in response.get("Contents", []):
            files.append({
                "key": item["Key"],
                "size_bytes": item["Size"],
                "last_modified": item["LastModified"].isoformat()
            })
        return files
    ```
=== "GCS Alternative (google-cloud-storage)"
    ```python
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket("my-gcp-storage-bucket")

    def upload_gcs_blob(source_file_path: str, destination_blob_name: str):
        blob = bucket.blob(destination_blob_name)
        blob.metadata = {"environment": "production"}
        blob.upload_from_filename(source_file_path, content_type="application/pdf")
        print(f"File uploaded to {blob.public_url}")
    ```

---

## 2. Secure Access with Presigned URLs

Presigned URLs grant temporary permissions (e.g. 15 minutes) to perform a specific action (`GET` or `PUT`) using the backend's IAM credentials, keeping the bucket private while letting clients upload directly.

=== "Generate Presigned URL"
    ```python
    import boto3
    from botocore.exceptions import ClientError

    s3_client = boto3.client("s3")

    def generate_presigned_download_url(bucket: str, key: str, expires_in: int = 3600) -> str:
        """Generates a temporary signed URL for downloading a private object."""
        try:
            url = s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            raise RuntimeError(f"Could not generate presigned URL: {e}")

    def generate_presigned_upload_post(bucket: str, key: str, expires_in: int = 900) -> dict:
        """Generates signed form fields for direct browser-to-S3 POST upload."""
        response = s3_client.generate_presigned_post(
            Bucket=bucket,
            Key=key,
            Fields={"acl": "private"},
            Conditions=[
                {"acl": "private"},
                ["content-length-range", 10, 10485760]  # Min 10B, Max 10MB
            ],
            ExpiresIn=expires_in
        )
        return response
    ```
=== "FastAPI Endpoint Integration"
    ```python
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel

    app = FastAPI()

    class UploadRequest(BaseModel):
        filename: str
        content_type: str

    @app.post("/api/storage/presigned-upload")
    def get_upload_ticket(request: UploadRequest):
        object_key = f"user_uploads/{request.filename}"
        presigned_data = generate_presigned_upload_post(
            bucket="production-app-media-files",
            key=object_key
        )
        return {
            "upload_url": presigned_data["url"],
            "fields": presigned_data["fields"],
            "final_file_key": object_key
        }
    ```

---

## 3. Streaming Large Files and Chunked Transfers

Downloading or uploading large multi-gigabyte datasets into memory will cause `MemoryError` and crash backend containers. Use **streaming chunk iterators** instead.

```
S3 Object Stream ──► 64KB Chunk Buffer ──► StreamingResponse (Client)
(Constant memory footprint < 10MB regardless of file size!)
```

=== "Streaming S3 Object to Client"
    ```python
    import boto3
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse

    app = FastAPI()
    s3_client = boto3.client("s3")

    def s3_stream_generator(bucket: str, key: str, chunk_size: int = 1024 * 64):
        """Yields chunks from S3 without loading whole object into memory."""
        s3_obj = s3_client.get_object(Bucket=bucket, Key=key)
        stream = s3_obj["Body"]
        while chunk := stream.read(chunk_size):
            yield chunk

    @app.get("/files/download/{filename}")
    def stream_file(filename: str):
        bucket = "production-app-media-files"
        key = f"reports/{filename}"
        
        return StreamingResponse(
            s3_stream_generator(bucket, key),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    ```
=== "Multipart Upload for Large Files"
    ```python
    # Boto3 transfer manager handles automatic multipart splitting:
    from boto3.s3.transfer import TransferConfig

    # Multipart triggered if file > 15MB, with 10 threads
    config = TransferConfig(
        multipart_threshold=1024 * 15,
        max_concurrency=10,
        multipart_chunksize=1024 * 15,
        use_threads=True
    )

    s3_client.upload_file(
        "large_dataset.tar.gz",
        "production-app-media-files",
        "archives/large_dataset.tar.gz",
        Config=config
    )
    ```

---

## 4. Object Metadata and CDN Cache Integration

When serving static assets through a Content Delivery Network (CloudFront or Cloud CDN), setting HTTP caching headers on S3 objects minimizes latency and origin transfer fees.

| Header / Metadata | Value Example | Impact |
|---|---|---|
| `Cache-Control` | `public, max-age=31536000, immutable` | Tells CDN & browser to cache for 1 year |
| `Content-Type` | `image/webp` | Ensures browser renders rather than downloads |
| `x-amz-meta-*` | `x-amz-meta-author: team-data` | Custom indexed user metadata |

---

## 💻 Try It Yourself

Simulate a cloud storage file registry supporting object storage, metadata storage, and query filtering.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory Cloud Object Storage Simulator
class CloudStorageSimulator:
    def __init__(self, bucket_name):
        self.bucket_name = bucket_name
        self.storage = {}

    def put_object(self, key, content, metadata=None):
        self.storage[key] = {
            "content": content,
            "size": len(content),
            "metadata": metadata or {},
            "url": f"https://{self.bucket_name}.s3.amazonaws.com/{key}"
        }
        return self.storage[key]["url"]

    def get_object(self, key):
        return self.storage.get(key)

    def list_objects(self, prefix=""):
        return [
            {"key": k, "size": v["size"], "meta": v["metadata"]}
            for k, v in self.storage.items()
            if k.startswith(prefix)
        ]

# Create bucket and upload objects
s3 = CloudStorageSimulator("analytics-bucket")
s3.put_object("reports/2024_q1.pdf", b"PDF_REPORT_DATA", {"author": "Finance"})
s3.put_object("reports/2024_q2.pdf", b"PDF_REPORT_DATA_Q2", {"author": "Finance"})
s3.put_object("images/logo.png", b"PNG_IMAGE_BYTES", {"type": "branding"})

files = s3.list_objects(prefix="reports/")
print(f"Bucket: {s3.bucket_name}")
print(f"Total objects in reports/: {len(files)}")
for f in files:
    print(f" - Key: {f['key']} ({f['size']} bytes) | Author: {f['meta'].get('author')}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — List Matching Files

From the mock cloud storage dictionary, list all files that end with the `".pdf"` extension and print the total count of matched files.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">storage_registry = [
    {"key": "documents/invoice_001.pdf", "size": 10420},
    {"key": "documents/notes.txt", "size": 512},
    {"key": "documents/contract_v2.pdf", "size": 25400},
    {"key": "images/avatar.png", "size": 8900},
]

# Count all objects where key ends with ".pdf"
# Print the count integer
</code></pre>
</div>

### Challenge 2 — Validate Presigned URL

Generate a simulated presigned URL format string and verify whether it contains the bucket name `"my-secure-bucket"`. Print the resulting boolean.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">bucket = "my-secure-bucket"
key = "data/export.csv"
token = "X-Amz-Signature=abcd1234ef5678"

# Construct presigned_url formatted as: f"https://{bucket}.s3.amazonaws.com/{key}?{token}"
# Print whether bucket in presigned_url
</code></pre>
</div>

---

## 📚 Further Reading

- [Boto3 S3 Developer Guide](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)
- [Amazon S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Google Cloud Storage Python Client Docs](https://cloud.google.com/python/docs/reference/storage/latest)

---

!!! success "Lesson Complete 🎉"
    You now master cloud object storage architectures, uploading and downloading files via Boto3, generating secure presigned URLs, and streaming large data chunks.

[⬅️ Lesson 73 · Azure Functions Python HTTP API](73-azure-functions.md){ .md-button } [➡️ Lesson 75 · Monitoring APIs with Prometheus](75-prometheus-monitoring.md){ .md-button .md-button--primary }
