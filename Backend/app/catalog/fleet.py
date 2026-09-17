"""A400M fleet catalog. Single source for API and persistence."""

from typing import Literal, TypedDict

NationCode = Literal["FAF", "RAF", "GAF", "SAF"]
EventType = Literal["retrofit", "maintenance"]
LoadType = Literal["as-is", "ac-exchange", "mds-for-mro"]


class NationItem(TypedDict):
    code: NationCode
    label: str
    title: str


class CatalogItem(TypedDict):
    code: str
    label: str


NATIONS: tuple[NationItem, ...] = (
    {"code": "FAF", "label": "FAF", "title": "French Air Force"},
    {"code": "RAF", "label": "RAF", "title": "Royal Air Force"},
    {"code": "GAF", "label": "GAF", "title": "German Air Force"},
    {"code": "SAF", "label": "SAF", "title": "Spanish Air Force"},
)

# Given name + two family names (always three parts).
CHIEFS: tuple[str, ...] = (
    "Alejandro Martín Iglesias",
    "Marta Soler Campos",
    "James Hartley Cooper",
    "Lena Vogt Schneider",
)

EVENT_TYPES: tuple[CatalogItem, ...] = (
    {"code": "retrofit", "label": "Retrofit"},
    {"code": "maintenance", "label": "Maintenance"},
)

LOAD_TYPES: tuple[CatalogItem, ...] = (
    {"code": "as-is", "label": "AS-IS"},
    {"code": "ac-exchange", "label": "A/C Exchange"},
    {"code": "mds-for-mro", "label": "MDS for MRO"},
)


def fleet_catalog() -> dict:
    return {
        "nations": list(NATIONS),
        "chiefs": list(CHIEFS),
        "event_types": list(EVENT_TYPES),
        "load_types": list(LOAD_TYPES),
    }
