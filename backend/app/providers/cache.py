"""Small disk-backed JSON cache for provider HTTP payloads."""

from __future__ import annotations

import json
from collections.abc import Iterator, MutableMapping
from datetime import datetime
from pathlib import Path
from typing import Any

from app.schemas.domain import HttpPayload


class DiskHttpCache(MutableMapping[str, HttpPayload]):
    """Persist POWER/SoilGrids payloads so baseline warm-ups survive restarts."""

    def __init__(self, root: Path, memory: MutableMapping[str, HttpPayload] | None = None) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)
        self._memory: MutableMapping[str, HttpPayload] = {} if memory is None else memory

    def _path(self, key: str) -> Path:
        return self._root / f"{key}.json"

    def __getitem__(self, key: str) -> HttpPayload:
        if key in self._memory:
            return self._memory[key]
        path = self._path(key)
        if not path.is_file():
            raise KeyError(key)
        raw = json.loads(path.read_text(encoding="utf-8"))
        payload = HttpPayload(
            body=raw["body"],
            mode=raw["mode"],
            retrieved_at=datetime.fromisoformat(raw["retrieved_at"]),
        )
        self._memory[key] = payload
        return payload

    def __setitem__(self, key: str, value: HttpPayload) -> None:
        self._memory[key] = value
        path = self._path(key)
        path.write_text(
            json.dumps({
                "body": value.body,
                "mode": value.mode,
                "retrieved_at": value.retrieved_at.isoformat(),
            }, ensure_ascii=True, allow_nan=False),
            encoding="utf-8",
        )

    def __delitem__(self, key: str) -> None:
        self._memory.pop(key, None)
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def __iter__(self) -> Iterator[str]:
        keys = set(self._memory)
        keys.update(path.stem for path in self._root.glob("*.json"))
        return iter(keys)

    def __len__(self) -> int:
        return len(list(self.__iter__()))

    def get(self, key: str, default: Any = None) -> Any:  # type: ignore[override]
        try:
            return self[key]
        except KeyError:
            return default
