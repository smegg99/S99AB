#!/usr/bin/env python3
# scripts/test-services.py

import http.client
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
NAMES = []


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def start(image, ports, *args, options=()):
    name = "s99ab-test-" + uuid.uuid4().hex[:12]
    NAMES.append(name)
    publish = [part for port in ports for part in ("-p", f"127.0.0.1::{port}")]
    run("docker", "run", "--detach", "--name", name, "--label", "s99ab.test=services",
        *publish, *options, image, *args)
    mapped = [run("docker", "port", name, f"{port}/tcp").rsplit(":", 1)[1] for port in ports]
    return name, mapped


def wait_http(url, statuses=(200,)):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status in statuses:
                    return
        except urllib.error.HTTPError as error:
            if error.code in statuses:
                return
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.RemoteDisconnected):
            pass
        time.sleep(0.1)
    raise RuntimeError(f"service did not become ready: {url}")


def main():
    try:
        pg, (pg_port,) = start("postgres:17-alpine", [5432],
            options=("-e", "POSTGRES_HOST_AUTH_METHOD=trust"))
        _, (s3_port,) = start("chrislusf/seaweedfs:4.52", [8333],
            "server", "-s3", "-s3.config=/etc/s3.json", "-dir=/data", "-volume.max=3",
            "-master.volumeSizeLimitMB=32", "-ip=127.0.0.1", "-ip.bind=0.0.0.0",
            options=("-v", f"{ROOT}/tests/services/s3.json:/etc/s3.json:ro"))
        _, (read_port, write_port) = start("oryd/keto:v0.14.0", [4466, 4467],
            "serve", "--config", "/etc/keto.yaml",
            options=("-v", f"{ROOT}/tests/services/keto.yaml:/etc/keto.yaml:ro"))
        _, (public_port, admin_port) = start("oryd/kratos:v1.3.1", [4433, 4434],
            "-c", "kratos migrate sql -c /etc/fixtures/kratos.yaml -e --yes && exec kratos serve -c /etc/fixtures/kratos.yaml --dev",
            options=("--entrypoint", "/bin/sh", "-v", f"{ROOT}/tests/services:/etc/fixtures:ro"))
        deadline = time.monotonic() + 45
        while subprocess.run(["docker", "exec", pg, "pg_isready", "-U", "postgres"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            if time.monotonic() > deadline:
                raise RuntimeError("PostgreSQL did not become ready")
            time.sleep(0.1)
        wait_http(f"http://127.0.0.1:{s3_port}/", (200, 403))
        wait_http(f"http://127.0.0.1:{read_port}/health/ready")
        wait_http(f"http://127.0.0.1:{admin_port}/health/ready")
        env = {**os.environ,
            "S99AB_REQUIRE_INTEGRATION": "1",
            "S99AB_TEST_PG_DSN": f"postgres://postgres@127.0.0.1:{pg_port}/postgres?sslmode=disable",
            "S99AB_TEST_S3_ENDPOINT": f"127.0.0.1:{s3_port}",
            "S99AB_TEST_S3_ACCESS_KEY": "s99ab-test",
            "S99AB_TEST_S3_SECRET_KEY": "s99ab-test-only",
            "S99AB_TEST_KETO_READ_URL": f"http://127.0.0.1:{read_port}",
            "S99AB_TEST_KETO_WRITE_URL": f"http://127.0.0.1:{write_port}",
            "S99AB_TEST_KRATOS_PUBLIC_URL": f"http://127.0.0.1:{public_port}",
            "S99AB_TEST_KRATOS_ADMIN_URL": f"http://127.0.0.1:{admin_port}",
        }
        subprocess.run(["go", "test", "-race", "-count=1", "-timeout=90s",
                        "./data/db", "./data/outbox", "./data/storage", "./auth/keto", "./auth/kratosauth"],
                       cwd=ROOT, env=env, check=True, timeout=150)
    except BaseException:
        for name in NAMES:
            subprocess.run(["docker", "logs", "--tail=30", name], check=False)
        raise
    finally:
        for name in reversed(NAMES):
            subprocess.run(["docker", "rm", "-f", "-v", name],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


if __name__ == "__main__":
    main()
