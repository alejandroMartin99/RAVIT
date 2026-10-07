"""Generate a PD consistency report.

Inputs are the Program Directive (full or delta), APC, OMP, ACR and tt_brackdown.
The check body is a stub until the production consistency code is adapted in.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import HTTPException

from app.aircraft.store import get_aircraft
from app.core.paths import DATA_DIR
from app.rdg.connect_to_access import store as access_store
from app.rdg.source_ingestion.apc import store as apc_store
from app.rdg.source_ingestion.pd import store as pd_store

SourceKind = Literal["full", "delta"]


def _require(name: str, payload: dict | None) -> dict:
    if not payload:
        raise HTTPException(status_code=400, detail=f"{name} is required.")
    return payload


def _load_json(aircraft_id: str, name: str) -> dict | None:
    aircraft = get_aircraft(aircraft_id)
    path = DATA_DIR / "fleet" / aircraft.folder / name / "current.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_acr(aircraft_id: str) -> dict | None:
    return _load_json(aircraft_id, "acr")


def load_omp(aircraft_id: str) -> dict | None:
    return access_store.get_table(aircraft_id, "OMP_MAINTENANCE_TASK")


def load_tt_brackdown(aircraft_id: str) -> dict | None:
    return access_store.get_table(aircraft_id, "TT_BRACKDOWN")


def _try_apc(aircraft_id: str) -> dict | None:
    try:
        return apc_store.get_current(aircraft_id)
    except HTTPException:
        return None


def describe_source(label: str, payload: dict | None) -> dict[str, Any]:
    if not payload:
        return {"label": label, "loaded": False, "rows": 0, "version": None, "nation": None, "file": None}
    rows = payload.get("rows") or []
    return {
        "label": label,
        "loaded": True,
        "rows": len(rows) if isinstance(rows, list) else 0,
        "version": payload.get("version") or payload.get("issue") or payload.get("id") or payload.get("source_id"),
        "nation": payload.get("nation"),
        "file": payload.get("source_file"),
    }


def list_sources(aircraft_id: str) -> dict[str, Any]:
    get_aircraft(aircraft_id)
    return {
        "apc": describe_source("APC", _try_apc(aircraft_id)),
        "omp": describe_source("OMP", load_omp(aircraft_id)),
        "acr": describe_source("ACR", load_acr(aircraft_id)),
        "tt_brackdown": describe_source("tt_brackdown", load_tt_brackdown(aircraft_id)),
    }


def generate_consistency_report(
    *,
    pd: dict,
    apc: dict | None,
    omp: dict | None,
    acr: dict | None,
    tt_brackdown: dict | None,
    delta: dict | None = None,
    source: SourceKind = "full",
) -> dict[str, Any]:
    pd = _require("PD", pd)
    if not pd.get("rows"):
        raise HTTPException(status_code=400, detail="PD has no rows.")
    if source == "delta" and not delta:
        raise HTTPException(status_code=400, detail="Delta PD is required.")
    sources = {
        "apc": describe_source("APC", apc),
        "omp": describe_source("OMP", omp),
        "acr": describe_source("ACR", acr),
        "tt_brackdown": describe_source("tt_brackdown", tt_brackdown),
    }
    missing = [item["label"] for item in sources.values() if not item["loaded"]]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot launch the consistency report. Missing: {', '.join(missing)}.",
        )

    # TODO: replace with the adapted consistency checks.
    return {
        "ok": True,
        "ready": False,
        "message": "Consistency rules are not wired yet. PD, APC, OMP, ACR and tt_brackdown were received.",
        "source": source,
        "pd": {"issue": pd.get("issue") or pd.get("version"), "rows": len(pd.get("rows") or [])},
        "delta": None
        if not delta
        else {"new": delta.get("new"), "old": delta.get("old"), "rows": len(delta.get("rows") or [])},
        "sources": sources,
        "findings": [],
    }


def run_consistency_report(
    aircraft_id: str,
    source: str = "full",
    issue: str | None = None,
    new: str | None = None,
    old: str | None = None,
) -> dict[str, Any]:
    if source not in {"full", "delta"}:
        raise HTTPException(status_code=400, detail="Choose a full PD or a delta.")
    kind: SourceKind = "delta" if source == "delta" else "full"
    delta = None
    if kind == "delta":
        if not new or not old:
            raise HTTPException(status_code=400, detail="Pick New and Old PD issues for the delta.")
        pd = pd_store.get_issue(aircraft_id, new)
        delta = pd_store.compare_issues(aircraft_id, new, old)
    else:
        pd = pd_store.get_issue(aircraft_id, issue or "latest")
    return generate_consistency_report(
        pd=pd,
        apc=_try_apc(aircraft_id),
        omp=load_omp(aircraft_id),
        acr=load_acr(aircraft_id),
        tt_brackdown=load_tt_brackdown(aircraft_id),
        delta=delta,
        source=kind,
    )
