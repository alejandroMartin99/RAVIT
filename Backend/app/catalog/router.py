from fastapi import APIRouter

from app.catalog.fleet import fleet_catalog

router = APIRouter(tags=["catalog"])


@router.get("/api/catalog/")
def get_catalog() -> dict:
    return fleet_catalog()
