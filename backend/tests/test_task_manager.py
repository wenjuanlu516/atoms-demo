import asyncio

from app.services.task_manager import TaskManager


def test_wait_approval_releases_concurrency_slot() -> None:
    async def main() -> None:
        manager = TaskManager()
        await manager.semaphore.acquire()
        await manager.semaphore.acquire()
        await manager.semaphore.acquire()
        assert manager.semaphore._value == 0

        waiter = asyncio.create_task(manager.wait_approval(7, timeout=2))
        await asyncio.sleep(0.05)
        assert manager.semaphore._value == 1

        assert manager.resolve_approval(7, True)
        assert await waiter is True
        await asyncio.sleep(0)
        assert manager.semaphore._value == 0

    asyncio.run(main())
