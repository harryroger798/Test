import os
from datetime import datetime
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

IDRIVE_ACCESS_KEY = os.getenv("IDRIVE_ACCESS_KEY", "")
IDRIVE_SECRET_KEY = os.getenv("IDRIVE_SECRET_KEY", "")
IDRIVE_ENDPOINT = os.getenv("IDRIVE_ENDPOINT", "")
IDRIVE_BUCKET = os.getenv("IDRIVE_BUCKET", "plugins-store")
DB_PATH = os.getenv("DB_PATH", "/home/app/database.db")


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=IDRIVE_ENDPOINT,
        aws_access_key_id=IDRIVE_ACCESS_KEY,
        aws_secret_access_key=IDRIVE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_file(filepath: str, object_key: str) -> bool:
    try:
        client = _get_client()
        client.upload_file(
            filepath,
            IDRIVE_BUCKET,
            object_key,
            ExtraArgs={"ContentType": "application/zip"}
        )
        return True
    except Exception:
        return False


def generate_presigned_url(object_key: str, expires_in: int = 3600) -> str:
    try:
        client = _get_client()
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": IDRIVE_BUCKET, "Key": object_key},
            ExpiresIn=expires_in
        )
        return url
    except Exception:
        return ""


def delete_file(object_key: str) -> bool:
    try:
        client = _get_client()
        client.delete_object(Bucket=IDRIVE_BUCKET, Key=object_key)
        return True
    except Exception:
        return False


def list_all_files() -> list:
    try:
        client = _get_client()
        response = client.list_objects_v2(Bucket=IDRIVE_BUCKET, Prefix="plugins/")
        files = []
        for obj in response.get("Contents", []):
            files.append({
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat()
            })
        while response.get("IsTruncated"):
            response = client.list_objects_v2(
                Bucket=IDRIVE_BUCKET,
                Prefix="plugins/",
                ContinuationToken=response["NextContinuationToken"]
            )
            for obj in response.get("Contents", []):
                files.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat()
                })
        return files
    except Exception:
        return []


def backup_database() -> bool:
    try:
        if not os.path.exists(DB_PATH):
            return False

        client = _get_client()
        date_str = datetime.utcnow().strftime("%Y-%m-%d-%H%M%S")

        dated_key = f"backup/database-{date_str}.db"
        client.upload_file(DB_PATH, IDRIVE_BUCKET, dated_key)

        latest_key = "backup/database-latest.db"
        client.upload_file(DB_PATH, IDRIVE_BUCKET, latest_key)

        return True
    except Exception:
        return False
