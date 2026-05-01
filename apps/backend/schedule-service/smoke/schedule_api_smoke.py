#!/usr/bin/env python3
"""
PM-06F.1 Schedule Service Smoke Test
Validates schedule-service end-to-end with workspace-service.
"""
import os
import sys
import json
import uuid
import requests

# Config
WORKSPACE_SVC = "http://localhost:8001"
SCHEDULE_SVC = "http://localhost:8006"

# Get JWT from environment (NOT printed)
JWT = os.environ.get("SUPABASE_TEST_JWT", "")
if not JWT:
    print("FAIL: SUPABASE_TEST_JWT not set. Run bjwt from PowerShell before this smoke.")
    sys.exit(1)

HEADERS_AUTH = {"Authorization": f"Bearer {JWT}", "Content-Type": "application/json"}


def step(name, expected_status, request_method, url, **kwargs):
    """Execute a single API step."""
    print(f"\n[STEP] {name}")
    print(f"  {request_method.upper()} {url}")
    if "json" in kwargs:
        print(f"  body: {json.dumps(kwargs['json'], indent=2)}")
    body = None
    try:
        resp = requests.request(request_method, url, headers=HEADERS_AUTH, **kwargs)
        print(f"  status: {resp.status_code}")
        if resp.status_code == 204 or not resp.content:
            pass
        else:
            try:
                body = resp.json()
                print(f"  body: {json.dumps(body, indent=2)}")
            except Exception:
                if resp.text:
                    print(f"  body: {resp.text[:200]}")
        if resp.status_code != expected_status:
            print(f"  !! EXPECTED {expected_status}, GOT {resp.status_code}")
            return False, None
        return True, body
    except Exception as e:
        print(f"  !! EXCEPTION: {e}")
        return False, None


def step_no_auth(name, expected_status, request_method, url, **kwargs):
    """Execute step WITHOUT Authorization header."""
    print(f"\n[STEP] {name} (NO AUTH)")
    print(f"  {request_method.upper()} {url}")
    try:
        resp = requests.request(request_method, url, **kwargs)
        print(f"  status: {resp.status_code}")
        try:
            body = resp.json()
            print(f"  body: {json.dumps(body, indent=2)}")
        except Exception:
            if resp.text:
                print(f"  body: {resp.text[:200]}")
        if resp.status_code != expected_status:
            print(f"  !! EXPECTED {expected_status}, GOT {resp.status_code}")
            return False, None
        return True, body
    except Exception as e:
        print(f"  !! EXCEPTION: {e}")
        return False, None


def step_invalid_auth(name, expected_status, request_method, url, **kwargs):
    """Execute step with invalid Authorization header."""
    print(f"\n[STEP] {name} (INVALID AUTH)")
    print(f"  {request_method.upper()} {url}")
    headers = {"Authorization": "Bearer invalid.token.here", "Content-Type": "application/json"}
    try:
        resp = requests.request(request_method, url, headers=headers, **kwargs)
        print(f"  status: {resp.status_code}")
        try:
            body = resp.json()
            print(f"  body: {json.dumps(body, indent=2)}")
        except Exception:
            if resp.text:
                print(f"  body: {resp.text[:200]}")
        if resp.status_code != expected_status:
            print(f"  !! EXPECTED {expected_status}, GOT {resp.status_code}")
            return False, None
        return True, body
    except Exception as e:
        print(f"  !! EXCEPTION: {e}")
        return False, None


def main():
    results = []

    print("=" * 60)
    print("PM-06F.1 Schedule Service Smoke Test")
    print("=" * 60)

    # 1. Create workspace via workspace-service
    workspace_body = {"name": "smoke-schedule-workspace"}
    ok, resp_workspace = step("Create workspace", 201, "POST",
                 f"{WORKSPACE_SVC}/workspaces",
                 json=workspace_body)
    results.append(("Create workspace", ok))
    workspace_id = resp_workspace.get("id") if resp_workspace else None
    if not workspace_id:
        print("FAIL: No workspace_id in create response")
        results.append(("Get returned workspace_id", False))
        print("\n" + "=" * 60)
        print("RESULTS SUMMARY")
        print("=" * 60)
        for name, passed in results:
            status = "PASS" if passed else "FAIL"
            print(f"  {status}: {name}")
        print("=" * 60)
        print("SMOKE TEST: FAILED (could not get workspace_id)")
        return 1

    # 2. List blocks (should be empty)
    ok, body = step("List blocks (empty)", 200, "GET",
                    f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    if ok and body:
        found = len(body.get("blocks", [])) == 0
        print(f"  blocks list is empty: {found}")
        results.append(("List blocks empty", found))
    else:
        results.append(("List blocks empty", False))

    # 3. Create schedule block
    block_id = str(uuid.uuid4())
    block_body = {
        "id": block_id,
        "title": "Math Class",
        "day_of_week": 1,
        "start_time": "09:00",
        "duration_minutes": 90,
        "color": "#6872c6",
        "location": "Room 101",
        "notes": "Bring calculator",
    }
    ok, _ = step("Create schedule block", 201, "POST",
                 f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks",
                 json=block_body)
    results.append(("Create block", ok))

    # 4. List blocks and confirm our block appears
    ok, body = step("List blocks after create", 200, "GET",
                    f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    if ok and body:
        found = any(b.get("id") == block_id and b.get("title") == "Math Class" for b in body.get("blocks", []))
        print(f"  block {block_id} found: {found}")
        results.append(("Block in list after create", found))
    else:
        results.append(("Block in list after create", False))

    # 5. Update block
    ok, _ = step("Update block", 200, "PUT",
                 f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks/{block_id}",
                 json={"title": "Advanced Math", "duration_minutes": 120})
    results.append(("Update block", ok))

    # 6. List after update to confirm persistence
    ok, body = step("List after update confirms persisted", 200, "GET",
                 f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    if ok and body:
        found = next((b for b in body.get("blocks", []) if b.get("id") == block_id), None)
        title_ok = found is not None and found.get("title") == "Advanced Math"
        dur_ok = found is not None and found.get("duration_minutes") == 120
        print(f"  title='Advanced Math': {title_ok}, duration=120: {dur_ok}")
        results.append(("Update persisted", title_ok and dur_ok))
    else:
        results.append(("Update persisted", False))

    # 7. Delete block
    ok, _ = step("Delete block", 204, "DELETE",
                 f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks/{block_id}")
    results.append(("Delete block", ok))

    # 8. Confirm block no longer appears
    ok, body = step("List after delete", 200, "GET",
                    f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    if ok and body:
        found = any(b.get("id") == block_id for b in body.get("blocks", []))
        print(f"  block {block_id} found: {found} (should be False)")
        results.append(("Block removed after delete", not found))
    else:
        results.append(("Block removed after delete", False))

    # 9. Auth checks — request without Authorization
    ok, _ = step_no_auth("List blocks WITHOUT auth", 401, "GET",
                         f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    results.append(("401 without auth", ok))

    # 10. Auth checks — request with invalid token
    ok, _ = step_invalid_auth("List blocks INVALID auth", 401, "GET",
                              f"{SCHEDULE_SVC}/workspaces/{workspace_id}/schedule-blocks")
    results.append(("401 invalid token", ok))

    # Summary
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    all_pass = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_pass = False

    print("=" * 60)
    if all_pass:
        print("SMOKE TEST: ALL CHECKS PASSED")
        return 0
    else:
        print("SMOKE TEST: SOME CHECKS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())