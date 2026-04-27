#!/usr/bin/env python3
"""
PM-04.1B Planning Service Runtime Smoke Test
Validates planning-service end-to-end with workspace-service.
"""
import os
import sys
import json
import uuid
import requests

# Config
WORKSPACE_SVC = "http://localhost:8001"
PLANNING_SVC = "http://localhost:8003"

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
            # No body for 204 No Content
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
    print("PM-04.1B Planning Service Runtime Smoke Test")
    print("=" * 60)

    # 1. Create workspace via workspace-service
    # Note: workspace-service ignores client-provided id, uses server-generated UUID
    workspace_body = {
        "name": "smoke-workspace",
        "description": "PM-04.1B smoke test workspace"
    }
    ok, resp_workspace = step("Create workspace", 201, "POST",
                 f"{WORKSPACE_SVC}/workspaces",
                 json=workspace_body)
    results.append(("Create workspace", ok))
    # Use the server-returned workspace ID (workspace-service ignores client-provided id)
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

    # 2. Create task-list
    task_list_id = str(uuid.uuid4())
    task_list_body = {
        "id": task_list_id,
        "name": "smoke-task-list",
        "description": "PM-04.1B smoke test task list"
    }
    ok, _ = step("Create task-list", 201, "POST",
                 f"{PLANNING_SVC}/workspaces/{workspace_id}/task-lists",
                 json=task_list_body)
    results.append(("Create task-list", ok))

    # 3. List task-lists and confirm our task-list appears
    ok, body = step("List task-lists", 200, "GET",
                    f"{PLANNING_SVC}/workspaces/{workspace_id}/task-lists")
    if ok and body:
        found = any(tl.get("id") == task_list_id for tl in body.get("task_lists", []))
        print(f"  task-list {task_list_id} found: {found}")
        results.append(("List task-lists contains id", found))
    else:
        results.append(("List task-lists contains id", False))

    # 4. Create task
    task_id = str(uuid.uuid4())
    task_body = {
        "id": task_id,
        "text": "smoke test task",
        "state": "pending",
        "priority": "medium",
        "list_id": task_list_id
    }
    ok, _ = step("Create task", 201, "POST",
                 f"{PLANNING_SVC}/workspaces/{workspace_id}/tasks",
                 json=task_body)
    results.append(("Create task", ok))

    # 5. List tasks and confirm our task appears
    ok, body = step("List tasks", 200, "GET",
                    f"{PLANNING_SVC}/workspaces/{workspace_id}/tasks")
    if ok and body:
        found = any(t.get("id") == task_id and t.get("text") == "smoke test task" for t in body.get("tasks", []))
        print(f"  task {task_id} with text 'smoke test task' found: {found}")
        results.append(("List tasks contains id+text", found))
    else:
        results.append(("List tasks contains id+text", False))

    # 6. Update task (change state to 'working')
    ok, _ = step("Update task state to working", 200, "PUT",
                 f"{PLANNING_SVC}/workspaces/{workspace_id}/tasks/{task_id}",
                 json={"state": "working"})
    results.append(("Update task", ok))

    # 7. Delete task
    ok, _ = step("Delete task", 204, "DELETE",
                 f"{PLANNING_SVC}/workspaces/{workspace_id}/tasks/{task_id}")
    results.append(("Delete task", ok))

    # 8. Confirm task no longer appears in list
    ok, body = step("List tasks after delete", 200, "GET",
                    f"{PLANNING_SVC}/workspaces/{workspace_id}/tasks")
    if ok and body:
        found = any(t.get("id") == task_id for t in body.get("tasks", []))
        print(f"  task {task_id} found: {found} (should be False)")
        results.append(("Task removed after delete", not found))
    else:
        results.append(("Task removed after delete", False))

    # 9. Auth checks - request without Authorization
    ok, _ = step_no_auth("Create task-list WITHOUT auth", 401, "POST",
                         f"{PLANNING_SVC}/workspaces/{workspace_id}/task-lists",
                         json={"id": str(uuid.uuid4()), "name": "no-auth-tl"})
    results.append(("401 without auth", ok))

    # 10. Auth checks - request with invalid token
    ok, _ = step_invalid_auth("Create task-list INVALID auth", 401, "POST",
                              f"{PLANNING_SVC}/workspaces/{workspace_id}/task-lists",
                              json={"id": str(uuid.uuid4()), "name": "invalid-auth-tl"})
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