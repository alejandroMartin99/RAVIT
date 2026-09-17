from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from app.api.schemas.aircraft import AircraftIn, AircraftOut, AircraftPatch
from app.catalog.fleet import fleet_catalog
from app.core.config import settings
from app.services import aircraft_store, apc_store, pd_store

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/catalog/")
def get_catalog() -> dict:
    return fleet_catalog()


@app.get("/api/aircraft/", response_model=list[AircraftOut])
def get_fleet() -> list[AircraftOut]:
    return aircraft_store.list_aircraft()


@app.get("/api/aircraft/{aircraft_id}", response_model=AircraftOut)
def get_aircraft(aircraft_id: str) -> AircraftOut:
    return aircraft_store.get_aircraft(aircraft_id)


@app.patch("/api/aircraft/{aircraft_id}", response_model=AircraftOut)
def patch_aircraft(aircraft_id: str, payload: AircraftPatch) -> AircraftOut:
    return aircraft_store.update_aircraft(aircraft_id, payload)


@app.get("/api/aircraft/{aircraft_id}/pd/")
def list_pd(aircraft_id: str) -> dict:
    return pd_store.list_issues(aircraft_id)


@app.delete("/api/aircraft/{aircraft_id}/pd/history/{attempt_id}")
def delete_pd_history(aircraft_id: str, attempt_id: str) -> dict:
    return pd_store.delete_attempt(aircraft_id, attempt_id)


@app.get("/api/aircraft/{aircraft_id}/pd/history/{attempt_id}/file")
def download_pd_history(aircraft_id: str, attempt_id: str) -> FileResponse:
    return pd_store.download_attempt(aircraft_id, attempt_id)


@app.get("/api/aircraft/{aircraft_id}/pd/{issue}")
def get_pd(aircraft_id: str, issue: str) -> dict:
    return pd_store.get_issue(aircraft_id, issue)


@app.post("/api/aircraft/{aircraft_id}/pd/", status_code=201)
def add_pd(aircraft_id: str) -> dict:
    return pd_store.create_next_issue(aircraft_id)


@app.post("/api/aircraft/{aircraft_id}/pd/ingest")
async def ingest_pd(aircraft_id: str, file: UploadFile = File(...)) -> StreamingResponse:
    aircraft_store.get_aircraft(aircraft_id)
    payload = await file.read()
    return StreamingResponse(
        pd_store.ingest_events(aircraft_id, file.filename or "upload", payload),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/aircraft/{aircraft_id}/apc/")
def list_apc(aircraft_id: str) -> dict:
    return apc_store.list_uploads(aircraft_id)


@app.delete("/api/aircraft/{aircraft_id}/apc/history/{attempt_id}")
def delete_apc_history(aircraft_id: str, attempt_id: str) -> dict:
    return apc_store.delete_attempt(aircraft_id, attempt_id)


@app.get("/api/aircraft/{aircraft_id}/apc/history/{attempt_id}/file")
def download_apc_history(aircraft_id: str, attempt_id: str) -> FileResponse:
    return apc_store.download_attempt(aircraft_id, attempt_id)


@app.post("/api/aircraft/{aircraft_id}/apc/select/{attempt_id}")
def select_apc(aircraft_id: str, attempt_id: str) -> dict:
    return apc_store.select_attempt(aircraft_id, attempt_id)


@app.post("/api/aircraft/{aircraft_id}/apc/ingest")
async def ingest_apc(aircraft_id: str, file: UploadFile = File(...)) -> StreamingResponse:
    aircraft_store.get_aircraft(aircraft_id)
    payload = await file.read()
    return StreamingResponse(
        apc_store.ingest_events(aircraft_id, file.filename or "upload", payload),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/aircraft/", response_model=AircraftOut, status_code=201)
def add_aircraft(payload: AircraftIn) -> AircraftOut:
    return aircraft_store.create_aircraft(payload)
