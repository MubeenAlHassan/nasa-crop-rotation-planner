"""Bounded, cache-aware JSON transport for the two upstream point APIs."""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections.abc import Callable, MutableMapping
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit

import httpx
from app.schemas.domain import HttpPayload, JsonFetcher, ProviderError

_HOSTS = {"power": "power.larc.nasa.gov", "soilgrids": "rest.isric.org"}


class HttpxJsonFetcher(JsonFetcher):
    """Fetch only approved HTTPS origins within a caller-supplied deadline."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        cache: MutableMapping[str, HttpPayload],
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._cache = cache
        self._clock = clock

    async def fetch_json(
        self,
        *,
        provider: Literal["power", "soilgrids"],
        url: str,
        params: tuple[tuple[str, str], ...],
        deadline: float,
    ) -> HttpPayload:
        parts = urlsplit(url)
        if (
            provider not in _HOSTS
            or parts.scheme != "https"
            or parts.hostname != _HOSTS[provider]
            or parts.port not in (None, 443)
            or parts.username is not None
            or parts.password is not None
            or parts.query
            or parts.fragment
        ):
            raise ProviderError(provider, "Unapproved provider URL", False)
        if not isinstance(params, tuple) or any(
            not isinstance(pair, tuple)
            or len(pair) != 2
            or not all(isinstance(value, str) for value in pair)
            for pair in params
        ):
            raise ProviderError(provider, "Invalid provider parameters", False)
        if not isinstance(deadline, (int, float)) or deadline <= self._clock():
            raise ProviderError(provider, "Provider deadline exceeded", True)
        canonical = json.dumps(
            [provider, url, sorted(params)], separators=(",", ":"), ensure_ascii=True
        ).encode("utf-8")
        cache_key = hashlib.sha256(canonical).hexdigest()
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached.model_copy(update={"mode": "cache"})

        for attempt in range(2):
            remaining = deadline - self._clock()
            if remaining <= 0:
                raise ProviderError(provider, "Provider deadline exceeded", True)
            timeout = httpx.Timeout(
                connect=min(2.0, remaining), read=min(4.0, remaining),
                write=min(2.0, remaining), pool=min(1.0, remaining),
            )
            try:
                response = await self._client.get(
                    url, params=list(params), timeout=timeout, follow_redirects=False,
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt == 0 and isinstance(exc, httpx.TimeoutException):
                    continue
                raise ProviderError(provider, "Provider request failed", isinstance(exc, httpx.TimeoutException)) from exc
            if response.status_code == 429 or 500 <= response.status_code < 600:
                if attempt == 0:
                    wait = 0.0
                    retry_after = response.headers.get("Retry-After")
                    if retry_after is not None:
                        try:
                            wait = max(0.0, float(retry_after))
                        except ValueError:
                            wait = 0.0
                    if wait < deadline - self._clock():
                        if wait:
                            await asyncio.sleep(wait)
                        continue
                raise ProviderError(provider, "Provider temporarily unavailable", True)
            if response.status_code >= 300:
                raise ProviderError(provider, "Provider rejected request", False)
            try:
                body = response.json()
                if not isinstance(body, dict):
                    raise ValueError("Expected JSON object")
                payload = HttpPayload(body=body, mode="live", retrieved_at=datetime.now(UTC))
            except (ValueError, TypeError) as exc:
                raise ProviderError(provider, "Invalid provider JSON", False) from exc
            self._cache[cache_key] = payload
            return payload
        raise ProviderError(provider, "Provider temporarily unavailable", True)
