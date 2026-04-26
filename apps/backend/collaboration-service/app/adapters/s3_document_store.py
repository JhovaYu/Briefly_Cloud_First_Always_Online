import re
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.ports.document_store import DocumentStore

ROOM_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$")


class S3DocumentStore(DocumentStore):
    """S3 document store for CRDT snapshot persistence.

    Stores snapshots as binary objects in S3. Supports any S3-compatible
    storage (AWS, LocalStack, moto in tests).

    Requires boto3. In production, uses IAM role or environment credentials
    automatically via boto3's default credential chain.
    """

    def __init__(
        self,
        bucket: str,
        region: str = "us-east-1",
        endpoint_url: Optional[str] = None,
        s3_client: Optional[object] = None,
    ) -> None:
        self._bucket = bucket
        if s3_client is not None:
            self._s3 = s3_client
        elif endpoint_url:
            self._s3 = boto3.client("s3", region_name=region, endpoint_url=endpoint_url)
        else:
            self._s3 = boto3.client("s3", region_name=region)

    def _validate_room_key(self, room_key: str) -> None:
        if not ROOM_KEY_PATTERN.match(room_key):
            raise ValueError(f"Invalid room_key format: {room_key!r}")

    def _s3_key(self, room_key: str) -> str:
        workspace_id, document_id = room_key.split(":", 1)
        return f"collab-snapshots/{workspace_id}/{document_id}/latest.bin"

    def save(self, room_key: str, snapshot: bytes) -> None:
        self._validate_room_key(room_key)
        workspace_id, document_id = room_key.split(":", 1)
        self._s3.put_object(
            Bucket=self._bucket,
            Key=self._s3_key(room_key),
            Body=snapshot,
            ContentType="application/octet-stream",
            Metadata={
                "workspace-id": workspace_id,
                "document-id": document_id,
            },
        )

    def load(self, room_key: str) -> bytes | None:
        self._validate_room_key(room_key)
        try:
            response = self._s3.get_object(Bucket=self._bucket, Key=self._s3_key(room_key))
            return response["Body"].read()
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise

    def delete(self, room_key: str) -> None:
        self._validate_room_key(room_key)
        try:
            self._s3.delete_object(Bucket=self._bucket, Key=self._s3_key(room_key))
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise

    def exists(self, room_key: str) -> bool:
        self._validate_room_key(room_key)
        try:
            self._s3.head_object(Bucket=self._bucket, Key=self._s3_key(room_key))
            return True
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("NoSuchKey", "404", "Not Found"):
                return False
            raise

    def __repr__(self) -> str:
        return f"S3DocumentStore(bucket={self._bucket!r})"
