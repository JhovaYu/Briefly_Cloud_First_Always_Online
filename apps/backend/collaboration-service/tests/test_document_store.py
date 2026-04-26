"""
PM-03E.1 tests for DocumentStore port and implementations.
"""

import pytest
from pathlib import Path
import tempfile
import shutil

from app.ports.document_store import DocumentStore
from app.adapters.in_memory_document_store import InMemoryDocumentStore
from app.adapters.local_file_document_store import LocalFileDocumentStore


class TestInMemoryDocumentStore:
    """Test InMemoryDocumentStore roundtrips."""

    def test_save_load_roundtrip(self):
        store = InMemoryDocumentStore()
        snapshot = b"\x00\x01\x02\x03snapshot"
        store.save("ws-1:doc-1", snapshot)
        loaded = store.load("ws-1:doc-1")
        assert loaded == snapshot

    def test_load_nonexistent_returns_none(self):
        store = InMemoryDocumentStore()
        result = store.load("nonexistent:key")
        assert result is None

    def test_save_exists_true(self):
        store = InMemoryDocumentStore()
        store.save("ws-1:doc-1", b"content")
        assert store.exists("ws-1:doc-1") is True

    def test_save_delete_load_returns_none(self):
        store = InMemoryDocumentStore()
        store.save("ws-1:doc-1", b"content")
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None

    def test_delete_nonexistent_noop(self):
        store = InMemoryDocumentStore()
        store.delete("nonexistent:key")  # no raise

    def test_two_rooms_isolated(self):
        store = InMemoryDocumentStore()
        store.save("ws-1:doc-1", b"snapshot1")
        store.save("ws-2:doc-2", b"snapshot2")
        assert store.load("ws-1:doc-1") == b"snapshot1"
        assert store.load("ws-2:doc-2") == b"snapshot2"
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None
        assert store.load("ws-2:doc-2") == b"snapshot2"

    def test_overwrite_replaces(self):
        store = InMemoryDocumentStore()
        store.save("ws-1:doc-1", b"v1")
        store.save("ws-1:doc-1", b"v2")
        assert store.load("ws-1:doc-1") == b"v2"


class TestLocalFileDocumentStore:
    """Test LocalFileDocumentStore filesystem operations."""

    @pytest.fixture
    def tmp_root(self):
        root = tempfile.mkdtemp()
        yield root
        shutil.rmtree(root, ignore_errors=True)

    def test_save_load_roundtrip(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        snapshot = b"\x00\x01\x02\x03localfilesystem"
        store.save("ws-1:doc-1", snapshot)
        loaded = store.load("ws-1:doc-1")
        assert loaded == snapshot

    def test_load_nonexistent_returns_none(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        result = store.load("nonexistent:key")
        assert result is None

    def test_exists_after_save(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        store.save("ws-alpha:doc-beta", b"content")
        assert store.exists("ws-alpha:doc-beta") is True

    def test_delete_removes_file(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        store.save("ws-1:doc-1", b"content")
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None
        assert store.exists("ws-1:doc-1") is False

    def test_rejects_invalid_room_key_format(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        with pytest.raises(ValueError):
            store.save("invalid/key", b"snapshot")  # no colon
        with pytest.raises(ValueError):
            store.save("ws:doc:extra", b"snapshot")  # too many colons
        with pytest.raises(ValueError):
            store.save("../etc/passwd", b"snapshot")  # path traversal chars
        with pytest.raises(ValueError):
            store.save("ws-1:", b"snapshot")  # missing document_id
        with pytest.raises(ValueError):
            store.save(":doc-1", b"snapshot")  # missing workspace_id

    def test_atomic_write(self, tmp_root):
        """Write goes through tmp file then replace."""
        store = LocalFileDocumentStore(root=tmp_root)
        store.save("ws-1:doc-1", b"content")
        # latest.bin must exist, latest.tmp must not
        path = Path(tmp_root) / "ws-1" / "doc-1"
        assert (path / "latest.bin").exists()
        assert not (path / "latest.tmp").exists()

    def test_directory_structure(self, tmp_root):
        """Snapshots stored under workspace_id/document_id/."""
        store = LocalFileDocumentStore(root=tmp_root)
        store.save("workspace-abc:document-xyz", b"data")
        expected = Path(tmp_root) / "workspace-abc" / "document-xyz" / "latest.bin"
        assert expected.exists()
        assert expected.read_bytes() == b"data"

    def test_delete_nonexistent_noop(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        store.delete("nonexistent:key")  # no raise

    def test_two_rooms_isolated(self, tmp_root):
        store = LocalFileDocumentStore(root=tmp_root)
        store.save("ws-1:doc-1", b"snapshot1")
        store.save("ws-2:doc-2", b"snapshot2")
        assert store.load("ws-1:doc-1") == b"snapshot1"
        assert store.load("ws-2:doc-2") == b"snapshot2"
        store.delete("ws-1:doc-1")
        assert store.load("ws-1:doc-1") is None
        assert store.load("ws-2:doc-2") == b"snapshot2"


class TestDocumentStoreInterface:
    """Test that implementations satisfy DocumentStore port."""

    def test_in_memory_implements_port(self):
        store = InMemoryDocumentStore()
        assert isinstance(store, DocumentStore)

    def test_local_file_implements_port(self, tmp_path=None):
        if tmp_path is None:
            import tempfile
            tmp_path = tempfile.mkdtemp()
        store = LocalFileDocumentStore(root=tmp_path)
        assert isinstance(store, DocumentStore)

    @pytest.mark.asyncio
    async def test_port_save_interface(self):
        """DocumentStore.save is synchronous and returns None."""
        store = InMemoryDocumentStore()
        result = store.save("ws:doc", b"data")
        assert result is None