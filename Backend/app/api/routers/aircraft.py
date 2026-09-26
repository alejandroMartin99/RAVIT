from fastapi import APIRouter

from app.api.schemas.aircraft import AircraftIn, AircraftOut, AircraftPatch
from app.services import aircraft_store

router = APIRouter(prefix="/api/aircraft", tags=["aircraft"])


@router.get("/", response_model=list[AircraftOut])
def get_fleet() -> list[AircraftOut]:
    return aircraft_store.list_aircraft()


@router.post("/", response_model=AircraftOut, status_code=201)
def add_aircraft(payload: AircraftIn) -> AircraftOut:
    return aircraft_store.create_aircraft(payload)


@router.get("/{aircraft_id}", response_model=AircraftOut)
def get_aircraft(aircraft_id: str) -> AircraftOut:
    return aircraft_store.get_aircraft(aircraft_id)


@router.patch("/{aircraft_id}", response_model=AircraftOut)
def patch_aircraft(aircraft_id: str, payload: AircraftPatch) -> AircraftOut:
    return aircraft_store.update_aircraft(aircraft_id, payload)
