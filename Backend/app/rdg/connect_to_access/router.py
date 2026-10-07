import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.aircraft.store import get_aircraft
from app.rdg.connect_to_access import store as access_store

router = APIRouter(prefix="/api/aircraft/{aircraft_id}/access", tags=["rdg-access"])


@router.get("/")
def list_access(aircraft_id: str) -> dict:
    get_aircraft(aircraft_id)
    return access_store.current_tables(aircraft_id)


@router.post("/scan")
async def scan_access(aircraft_id: str, file: UploadFile = File(...)) -> dict:
    get_aircraft(aircraft_id)
    payload = await file.read()
    return access_store.scan_access(aircraft_id, file.filename or "source.mdb", payload)


@router.post("/commit")
async def commit_access(
    aircraft_id: str,
    tables: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    get_aircraft(aircraft_id)
    try:
        ids = json.loads(tables)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid table selection.") from exc
    if not isinstance(ids, list) or not all(isinstance(item, str) for item in ids):
        raise HTTPException(status_code=400, detail="Invalid table selection.")
    payload = await file.read()
    return access_store.commit_access(aircraft_id, file.filename or "source.mdb", payload, ids)
