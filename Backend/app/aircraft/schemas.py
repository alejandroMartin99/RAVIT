from datetime import date

from pydantic import BaseModel, Field

from app.catalog.fleet import EventType, LoadType, NationCode


class AircraftIn(BaseModel):
    msn: int = Field(ge=1, le=999)
    nation: NationCode
    chief: str = Field(min_length=1, max_length=120)
    event_type: EventType
    load_type: LoadType
    hang_over: date
    transfer_of_custody: date


class AircraftOut(BaseModel):
    id: str
    msn: int
    folder: str
    nation: NationCode
    chief: str
    event_type: EventType
    load_type: LoadType
    hang_over: date
    transfer_of_custody: date


class AircraftPatch(BaseModel):
    event_type: EventType | None = None
    load_type: LoadType | None = None
    hang_over: date | None = None
    transfer_of_custody: date | None = None
