import json
import uuid
from datetime import date
from pathlib import Path

from fastapi import HTTPException

from app.aircraft.schemas import AircraftIn, AircraftOut, AircraftPatch
from app.catalog.fleet import CHIEFS
from app.core.paths import DATA_DIR

_ROOT = DATA_DIR / "fleet"
_ID_NS = uuid.NAMESPACE_DNS


def aircraft_id(msn: int) -> str:
    return str(uuid.uuid5(_ID_NS, f"ravit.a400m.msn.{msn:03d}"))


def folder_name(msn: int) -> str:
    return f"{msn:03d}"


def _seed() -> list[AircraftOut]:
    return [
        AircraftOut(
            id=aircraft_id(14),
            msn=14,
            folder=folder_name(14),
            nation="SAF",
            chief="Alejandro Martín Iglesias",
            event_type="retrofit",
            load_type="as-is",
            hang_over=date(2026, 1, 12),
            transfer_of_custody=date(2026, 6, 30),
        ),
        AircraftOut(
            id=aircraft_id(30),
            msn=30,
            folder=folder_name(30),
            nation="RAF",
            chief="James Hartley Cooper",
            event_type="maintenance",
            load_type="ac-exchange",
            hang_over=date(2025, 11, 3),
            transfer_of_custody=date(2026, 3, 18),
        ),
        AircraftOut(
            id=aircraft_id(110),
            msn=110,
            folder=folder_name(110),
            nation="FAF",
            chief="Marta Soler Campos",
            event_type="retrofit",
            load_type="mds-for-mro",
            hang_over=date(2026, 2, 20),
            transfer_of_custody=date(2026, 9, 1),
        ),
    ]


def _meta_path(folder: str) -> Path:
    return _ROOT / folder / "aircraft.json"


def _write_one(item: AircraftOut) -> None:
    path = _meta_path(item.folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(item.model_dump(mode="json"), indent=2), encoding="utf-8")


def _as_date(value: object, fallback: date) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        return date.fromisoformat(value)
    return fallback


def _parse(row: dict, folder: str) -> AircraftOut:
    msn = int(row["msn"])
    return AircraftOut(
        id=row.get("id") or aircraft_id(msn),
        msn=msn,
        folder=row.get("folder") or folder,
        nation=row["nation"],
        chief=row.get("chief") or CHIEFS[0],
        event_type=row.get("event_type") or row.get("maintenance_type") or "maintenance",
        load_type=row.get("load_type") or "as-is",
        hang_over=_as_date(row.get("hang_over"), date(2026, 1, 1)),
        transfer_of_custody=_as_date(row.get("transfer_of_custody"), date(2026, 12, 31)),
    )


def _ensure_store() -> None:
    _ROOT.mkdir(parents=True, exist_ok=True)
    if any(_ROOT.glob("*/aircraft.json")):
        return
    for item in _seed():
        _write_one(item)


def list_aircraft() -> list[AircraftOut]:
    _ensure_store()
    items: list[AircraftOut] = []
    for meta in _ROOT.glob("*/aircraft.json"):
        raw = json.loads(meta.read_text(encoding="utf-8"))
        items.append(_parse(raw, meta.parent.name))
    return sorted(items, key=lambda item: item.msn)


def get_aircraft(aircraft_id: str) -> AircraftOut:
    key = aircraft_id.strip()
    msn = int(key) if key.isdigit() else None
    for item in list_aircraft():
        if item.id == key or item.folder == key or item.msn == msn:
            return item
    raise HTTPException(status_code=404, detail="Aircraft not found")


def create_aircraft(payload: AircraftIn) -> AircraftOut:
    if payload.chief not in CHIEFS:
        raise HTTPException(status_code=422, detail="Invalid aircraft chief")
    fleet = list_aircraft()
    if any(item.msn == payload.msn for item in fleet):
        raise HTTPException(status_code=409, detail=f"MSN {payload.msn:03d} already exists")
    if payload.transfer_of_custody < payload.hang_over:
        raise HTTPException(status_code=422, detail="ToC cannot be before Hang Over")
    created = AircraftOut(
        id=aircraft_id(payload.msn),
        msn=payload.msn,
        folder=folder_name(payload.msn),
        nation=payload.nation,
        chief=payload.chief,
        event_type=payload.event_type,
        load_type=payload.load_type,
        hang_over=payload.hang_over,
        transfer_of_custody=payload.transfer_of_custody,
    )
    _write_one(created)
    return created


def update_aircraft(aircraft_id: str, payload: AircraftPatch) -> AircraftOut:
    current = get_aircraft(aircraft_id)
    updated = current.model_copy(
        update={
            "event_type": payload.event_type or current.event_type,
            "load_type": payload.load_type or current.load_type,
            "hang_over": payload.hang_over or current.hang_over,
            "transfer_of_custody": payload.transfer_of_custody or current.transfer_of_custody,
        }
    )
    _write_one(updated)
    return updated
