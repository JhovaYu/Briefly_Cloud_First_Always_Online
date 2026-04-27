#!/usr/bin/env python
"""
PM-03E.5B.1 S3 head-object check.
Loads .env.s3 directly (does NOT use docker env vars), checks if latest.bin exists.
Usage: python s3_head_check.py <workspace_id> <document_id>
"""
import json
import os
import sys
from pathlib import Path

# Load .env.s3 manually (KEY=VALUE format, no export, no comments)
# This script is at apps/backend/collaboration-service/smoke/
# Going up: smoke(0), collaboration-service(1), apps(2), repo_root(3)
# parents[4] = OneDrive level, so we need parents[4] to get repo root then .parent once more
script_path = Path(__file__).resolve()
# debug: print(f"DEBUG: script_path={script_path}")
# From debug: parents[3]="...Briefly_Cloud_First_Always_Online\apps", so repo_root = parents[3].parent
repo_root = script_path.parents[3].parent
env_path = repo_root / ".env.s3"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

workspace_id = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("COLLAB_WORKSPACE_ID", "")
document_id = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("COLLAB_DOCUMENT_ID", "")

if not workspace_id or not document_id:
    print(json.dumps({"found": False, "error": "workspace_id or document_id not provided"}))
    sys.exit(1)

bucket = os.environ.get("AWS_S3_BUCKET_NAME", "")
region = os.environ.get("AWS_REGION", "us-east-1")
key = f"collab-snapshots/{workspace_id}/{document_id}/latest.bin"

if not bucket:
    print(json.dumps({"found": False, "key": key, "error": "AWS_S3_BUCKET_NAME not set in .env.s3"}))
    sys.exit(1)

try:
    import boto3
    s3 = boto3.client("s3", region_name=region)
    resp = s3.head_object(Bucket=bucket, Key=key)
    result = {"found": True, "content_length": resp.get("ContentLength", 0), "key": key}
except Exception as e:
    result = {"found": False, "key": key, "error": str(e)}

print(json.dumps(result))
