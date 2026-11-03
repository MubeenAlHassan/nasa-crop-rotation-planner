"""Run all Phase 0 regression checks with external sockets disabled."""

from __future__ import annotations

import socket
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[2]
TESTS = [
    *(
        f"backend/scripts/test_{name}.py"
        for name in (
            "power_capture",
            "soil_capture",
            "smap_capture",
            "crop_catalog",
            "fixture_manifest",
        )
    ),
    "backend/tests/test_spec_audit.py",
]


def _no_network(*args: object, **kwargs: object) -> None:
    raise AssertionError("Phase 0 verification must not open external sockets")


def main() -> int:
    with (
        patch.object(socket.socket, "connect", _no_network),
        patch.object(socket.socket, "connect_ex", _no_network),
        patch.object(socket, "create_connection", _no_network),
    ):
        return pytest.main(["-q", *(str(ROOT / path) for path in TESTS)])


if __name__ == "__main__":
    raise SystemExit(main())
