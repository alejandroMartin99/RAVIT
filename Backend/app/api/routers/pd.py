from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.services import aircraft_store, pd_store

router = APIRouter(prefix="/api/aircraft/{aircraft_id}/pd", tags=["pd"])

_SSE = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.get("/")
def list_pd(aircraft_id: str) -> dict:
    return pd_store.list_issues(aircraft_id)


@router.delete("/history/{attempt_id}")
def delete_pd_history(aircraft_id: str, attempt_id: str) -> dict:
    return pd_store.delete_attempt(aircraft_id, attempt_id)


@router.get("/history/{attempt_id}/file")
def download_pd_history(aircraft_id: str, attempt_id: str) -> FileResponse:
    return pd_store.download_attempt(aircraft_id, attempt_id)


@router.post("/ingest")
async def ingest_pd(aircraft_id: str, file: UploadFile = File(...)) -> StreamingResponse:
    aircraft_store.get_aircraft(aircraft_id)
    payload = await file.read()
    return StreamingResponse(
        pd_store.ingest_events(aircraft_id, file.filename or "upload", payload),
        media_type="text/event-stream",
        headers=_SSE,
    )


@router.post("/ingest/commit")
def commit_pd(aircraft_id: str, version: str) -> dict:
    return pd_store.commit_pending(aircraft_id, version)


@router.delete("/ingest/pending")
def discard_pd(aircraft_id: str, version: str) -> dict:
    return pd_store.discard_pending(aircraft_id, version)


@router.get("/compare")
def compare_pd(aircraft_id: str, new: str, old: str) -> dict:
    return pd_store.compare_issues(aircraft_id, new, old)


@router.get("/{issue}")
def get_pd(aircraft_id: str, issue: str) -> dict:
    return pd_store.get_issue(aircraft_id, issue)


@router.post("/", status_code=201)
def add_pd(aircraft_id: str) -> dict:
    return pd_store.create_next_issue(aircraft_id)
