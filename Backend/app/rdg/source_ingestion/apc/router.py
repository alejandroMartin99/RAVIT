from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.aircraft import store as aircraft_store
from app.rdg.source_ingestion.apc import store as apc_store

router = APIRouter(prefix="/api/aircraft/{aircraft_id}/apc", tags=["apc"])

_SSE = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.get("/")
def list_apc(aircraft_id: str) -> dict:
    return apc_store.list_uploads(aircraft_id)


@router.delete("/history/{attempt_id}")
def delete_apc_history(aircraft_id: str, attempt_id: str) -> dict:
    return apc_store.delete_attempt(aircraft_id, attempt_id)


@router.get("/history/{nation}/{attempt_id}/file")
def download_apc_history_nation(aircraft_id: str, nation: str, attempt_id: str) -> FileResponse:
    return apc_store.download_attempt(aircraft_id, attempt_id, nation)


@router.get("/history/{attempt_id}/file")
def download_apc_history(aircraft_id: str, attempt_id: str) -> FileResponse:
    return apc_store.download_attempt(aircraft_id, attempt_id)


@router.post("/select/{nation}/{attempt_id}")
def select_apc_nation(aircraft_id: str, nation: str, attempt_id: str) -> dict:
    return apc_store.select_attempt(aircraft_id, attempt_id, nation)


@router.post("/select/{attempt_id}")
def select_apc(aircraft_id: str, attempt_id: str) -> dict:
    return apc_store.select_attempt(aircraft_id, attempt_id)


@router.post("/ingest")
async def ingest_apc(aircraft_id: str, file: UploadFile = File(...)) -> StreamingResponse:
    aircraft_store.get_aircraft(aircraft_id)
    payload = await file.read()
    return StreamingResponse(
        apc_store.ingest_events(aircraft_id, file.filename or "upload", payload),
        media_type="text/event-stream",
        headers=_SSE,
    )
