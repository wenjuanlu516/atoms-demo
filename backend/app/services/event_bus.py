import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self, cache_limit: int = 500):
        self._subscribers: dict[int, list[asyncio.Queue]] = defaultdict(list)
        self._event_cache: dict[int, list[dict]] = defaultdict(list)
        self._seq: dict[int, int] = defaultdict(int)
        self._cache_limit = cache_limit

    async def publish(self, project_id: int, event: str, data: dict) -> dict:
        self._seq[project_id] += 1
        payload = {"id": self._seq[project_id], "event": event, "data": data}
        cache = self._event_cache[project_id]
        cache.append(payload)
        if len(cache) > self._cache_limit:
            del cache[: len(cache) - self._cache_limit]
        for queue in list(self._subscribers[project_id]):
            await queue.put(payload)
        return payload

    def subscribe(self, project_id: int, last_event_id: int = 0) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[project_id].append(queue)
        for event in self._event_cache[project_id]:
            if event["id"] > last_event_id:
                queue.put_nowait(event)
        return queue

    def last_id(self, project_id: int) -> int:
        return self._seq[project_id]

    def clear(self, project_id: int) -> None:
        self._event_cache.pop(project_id, None)

    def unsubscribe(self, project_id: int, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(project_id, [])
        if queue in subs:
            subs.remove(queue)
