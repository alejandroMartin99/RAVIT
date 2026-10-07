from fastapi import APIRouter

from app.aircraft import store as aircraft_store
from app.rdg.source_ingestion.pd import store as pd_store
from app.rdp.plan_data.pd.consistency import list_sources, run_consistency_report

router = APIRouter(prefix="/api/aircraft/{aircraft_id}/pd", tags=["rdp-pd"])


@router.get("/")
def list_pd(aircraft_id: str) -> dict:
    return pd_store.list_issues(aircraft_id)


@router.get("/compare")
def compare_pd(aircraft_id: str, new: str, old: str) -> dict:
    return pd_store.compare_issues(aircraft_id, new, old)


@router.get("/consistency/sources")
def consistency_sources(aircraft_id: str) -> dict:
    aircraft_store.get_aircraft(aircraft_id)
    return list_sources(aircraft_id)


@router.get("/consistency")
def consistency_pd(
    aircraft_id: str,
    source: str = "full",
    issue: str | None = None,
    new: str | None = None,
    old: str | None = None,
) -> dict:
    aircraft_store.get_aircraft(aircraft_id)
    return run_consistency_report(aircraft_id, source, issue, new, old)


@router.get("/{issue}")
def get_pd(aircraft_id: str, issue: str) -> dict:
    return pd_store.get_issue(aircraft_id, issue)
