"""
PM-03E.4A tests for S3DocumentStore adapter.

Uses moto.mock_aws() to simulate S3 without real AWS credentials or internet.
"""

import pytest
import boto3
from moto import mock_aws

from app.adapters.s3_document_store import S3DocumentStore
from app.ports.document_store import DocumentStore


@pytest.fixture
def s3_client():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="test-bucket")
        yield client


@pytest.fixture
def store(s3_client):
    return S3DocumentStore(bucket="test-bucket", s3_client=s3_client)


class TestS3SaveLoad:
    def test_save_load_roundtrip(self, store, s3_client):
        snapshot = b"\x00\x01\x02\x03snapshot"
        store.save("ws-1:doc-1", snapshot)
        loaded = store.load("ws-1:doc-1")
        assert loaded == snapshot

    def test_load_nonexistent_returns_none(self, store):
        result = store.load("ws-none:nonexistent")
        assert result is None

    def test_exists_after_save(self, store):
        store.save("ws-alpha:doc-beta", b"content")
        assert store.exists("ws-alpha:doc-beta") is True

    def test_exists_nonexistent_is_false(self, store):
        assert store.exists("ws-x:doc-y") is False

    def test_delete_removes_object(self, store):
        store.save("ws-1:doc-1", b"content")
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None

    def test_delete_nonexistent_is_noop(self, store):
        store.delete("ws-none:doc-none")  # no raise

    def test_two_rooms_isolated(self, store):
        store.save("ws-1:doc-1", b"snapshot1")
        store.save("ws-2:doc-2", b"snapshot2")
        assert store.load("ws-1:doc-1") == b"snapshot1"
        assert store.load("ws-2:doc-2") == b"snapshot2"
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None
        assert store.load("ws-2:doc-2") == b"snapshot2"

    def test_overwrite_replaces(self, store):
        store.save("ws-1:doc-1", b"v1")
        store.save("ws-1:doc-1", b"v2")
        assert store.load("ws-1:doc-1") == b"v2"


class TestS3Validation:
    def test_rejects_invalid_room_key(self, store):
        with pytest.raises(ValueError, match="Invalid room_key format"):
            store.save("invalid/key", b"snapshot")
        with pytest.raises(ValueError, match="Invalid room_key format"):
            store.save("ws:doc:extra", b"snapshot")
        with pytest.raises(ValueError, match="Invalid room_key format"):
            store.save("../etc/passwd", b"snapshot")
        with pytest.raises(ValueError, match="Invalid room_key format"):
            store.save("ws-1:", b"snapshot")
        with pytest.raises(ValueError, match="Invalid room_key format"):
            store.save(":doc-1", b"snapshot")


class TestS3KeyFormat:
    def test_key_format_matches_expected_prefix(self, store, s3_client):
        store.save("ws-test:doc-abc", b"data")
        keys = s3_client.list_objects_v2(Bucket="test-bucket", Prefix="collab-snapshots/")[
            "Contents"
        ]
        assert len(keys) == 1
        assert keys[0]["Key"] == "collab-snapshots/ws-test/doc-abc/latest.bin"


class TestS3Metadata:
    def test_metadata_does_not_include_secrets(self, store, s3_client):
        store.save("ws-1:doc-1", b"content")
        obj = s3_client.get_object(
            Bucket="test-bucket", Key="collab-snapshots/ws-1/doc-1/latest.bin"
        )
        meta = obj.get("Metadata", {})
        assert "workspace-id" in meta
        assert "document-id" in meta
        # JWT, email, secrets must not appear in metadata
        for key, value in meta.items():
            lower_value = value.lower() if isinstance(value, str) else ""
            assert "jwt" not in lower_value
            assert "token" not in lower_value
            assert "@" not in value


class TestS3DocumentStoreInterface:
    def test_implements_port(self, store):
        assert isinstance(store, DocumentStore)

    def test_save_returns_none(self, store):
        result = store.save("ws:doc", b"data")
        assert result is None
