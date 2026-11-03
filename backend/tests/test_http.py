import asyncio
import time

import httpx
import pytest
from app.providers.http import HttpxJsonFetcher
from app.schemas.domain import HttpPayload, ProviderError


def run(coro):
    return asyncio.run(coro)


def test_query_cache_and_provider_isolation():
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"ok": 1})

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            fetcher = HttpxJsonFetcher(client, {})
            params = (("b", "a b"), ("a", "1"))
            first = await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=params, deadline=time.monotonic() + 5)
            second = await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=tuple(reversed(params)), deadline=time.monotonic() + 5)
            assert type(first) is HttpPayload and first.mode == "live"
            assert second.mode == "cache" and len(calls) == 1
            assert "b=a+b" in str(calls[0].url)
            with pytest.raises(ProviderError):
                await fetcher.fetch_json(provider="soilgrids", url="https://power.larc.nasa.gov/x", params=params, deadline=time.monotonic() + 5)
            with pytest.raises(ProviderError):
                await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov.evil/x", params=params, deadline=time.monotonic() + 5)
    run(scenario())


def test_two_attempts_and_no_ordinary_4xx_retry():
    count = 0

    def respond(request):
        nonlocal count
        count += 1
        return httpx.Response(503 if count == 1 else 200, json={"ok": True})

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            fetcher = HttpxJsonFetcher(client, {})
            assert (await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=(), deadline=time.monotonic() + 5)).body == {"ok": True}
            assert count == 2
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(400, text="secret-token"))) as client:
            with pytest.raises(ProviderError, match="Provider rejected request") as error:
                await HttpxJsonFetcher(client, {}).fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=(), deadline=time.monotonic() + 5)
            assert "secret-token" not in str(error.value)
    run(scenario())


def test_deadline_and_nonobject_json():
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[]))) as client:
            fetcher = HttpxJsonFetcher(client, {})
            with pytest.raises(ProviderError, match="deadline"):
                await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=(), deadline=time.monotonic() - 1)
            with pytest.raises(ProviderError, match="Invalid provider JSON"):
                await fetcher.fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=(), deadline=time.monotonic() + 5)
    run(scenario())


def test_redirect_is_not_followed_to_another_origin():
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(302, headers={"Location": "https://elsewhere.example/private"})

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond), follow_redirects=True) as client:
            with pytest.raises(ProviderError, match="Provider rejected request"):
                await HttpxJsonFetcher(client, {}).fetch_json(provider="power", url="https://power.larc.nasa.gov/x", params=(), deadline=time.monotonic() + 5)
        assert len(requests) == 1
    run(scenario())


def test_retry_cap_and_remaining_deadline_timeouts():
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(599, json={"detail": "private"})

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with pytest.raises(ProviderError, match="temporarily unavailable"):
                await HttpxJsonFetcher(client, {}).fetch_json(
                    provider="power", url="https://power.larc.nasa.gov/x",
                    params=(), deadline=time.monotonic() + .5,
                )
        assert len(requests) == 2
        for request in requests:
            timeout = request.extensions["timeout"]
            assert 0 < timeout["connect"] <= .5
            assert 0 < timeout["read"] <= .5
            assert 0 < timeout["write"] <= .5
            assert 0 < timeout["pool"] <= .5
    run(scenario())
