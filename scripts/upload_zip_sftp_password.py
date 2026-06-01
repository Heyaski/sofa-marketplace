#!/usr/bin/env python3
"""Распаковать ZIP и залить файлы моделей на SFTP (логин/пароль). Пароль: env SFTP_PASSWORD."""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import zipfile
from pathlib import Path

ALLOWED = {".glb", ".rfa", ".ifc", ".png", ".jpg", ".jpeg"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload unpacked ZIP to SFTP /models")
    parser.add_argument("zip_path", type=Path, help="Path to .zip archive")
    parser.add_argument("--host", default=os.environ.get("SFTP_HOST", "45.12.74.57"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("SFTP_PORT", "22")))
    parser.add_argument("--user", default=os.environ.get("SFTP_USER", "upload3d"))
    parser.add_argument(
        "--remote-dir",
        default=os.environ.get("REMOTE_DIR", "/home/upload3d/models/incoming"),
    )
    args = parser.parse_args()

    password = os.environ.get("SFTP_PASSWORD", "").strip()
    if not password:
        print("Set SFTP_PASSWORD environment variable.", file=sys.stderr)
        return 1

    zip_path = args.zip_path.resolve()
    if not zip_path.is_file():
        print(f"ZIP not found: {zip_path}", file=sys.stderr)
        return 1

    try:
        import paramiko
    except ImportError:
        print("pip install paramiko", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="models_zip_") as tmp:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        to_upload: list[Path] = []
        for p in Path(tmp).rglob("*"):
            if p.is_file() and p.suffix.lower() in ALLOWED:
                to_upload.append(p)

        if not to_upload:
            print("No .glb/.rfa/.ifc/.png/.jpg files in archive.", file=sys.stderr)
            return 1

        transport = paramiko.Transport((args.host, args.port))
        transport.connect(username=args.user, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                sftp.chdir(args.remote_dir)
            except OSError:
                try:
                    sftp.mkdir(args.remote_dir)
                except OSError:
                    pass
                sftp.chdir(args.remote_dir)

            for local in to_upload:
                remote_name = local.name
                print(f"put {remote_name} ...")
                sftp.put(str(local), remote_name)
        finally:
            sftp.close()
            transport.close()

    print(f"OK: uploaded {len(to_upload)} file(s) to {args.user}@{args.host}:{args.remote_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
