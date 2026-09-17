from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.schemas.aircraft import AircraftIn, AircraftOut, AircraftPatch
from app.catalog.fleet import fleet_catalog
from app.core.config import settings
from app.services import aircraft_store

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


@app.post("/api/aircraft/", response_model=AircraftOut, status_code=201)
def add_aircraft(payload: AircraftIn) -> AircraftOut:
    return aircraft_store.create_aircraft(payload)
