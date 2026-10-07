import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from app.aircraft.store import get_aircraft
from app.catalog.fleet import NATIONS
from app.core.paths import DATA_DIR
from app.rdg.source_ingestion.validation import Context, load_rules, run_check, to_named_rows

_CURRENT = "current"


def _common_dir(nation: str) -> Path:
    root = DATA_DIR / "common" / "apc" / nation
    root.mkdir(parents=True, exist_ok=True)
    return root


def _aircraft_dir(folder: str) -> Path:
    root = DATA_DIR / "fleet" / folder / "apc"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _uploads_dir(nation: str) -> Path:
    root = _common_dir(nation) / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _history_path(nation: str) -> Path:
    return DATA_DIR / "common" / "apc" / nation / "history.json"


def _version_stem(version: int) -> str:
    return f"v{int(version):02d}"


def _next_version(attempts: list[dict]) -> int:
    nums = [int(item["version"]) for item in attempts if item.get("status") == "ok" and item.get("version")]
    return (max(nums) if nums else 0) + 1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_history(nation: str) -> list[dict]:
    path = _history_path(nation)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("attempts") or []


def _write_history(nation: str, attempts: list[dict]) -> None:
    path = _history_path(nation)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"attempts": attempts}, indent=2), encoding="utf-8")


def _load_assigned(aircraft) -> dict | None:
    path = _aircraft_dir(aircraft.folder) / f"{_CURRENT}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _with_assigned(attempts: list[dict], assigned: dict | None, nation: str) -> list[dict]:
    source_id = assigned.get("source_id") if assigned else None
    source_nation = assigned.get("nation") if assigned else None
    out = []
    for item in attempts:
        row = dict(item)
        row["nation"] = row.get("nation") or nation
        row["current"] = item.get("status") == "ok" and bool(source_id) and item.get("id") == source_id and (
            not source_nation or source_nation == nation
        )
        out.append(row)
    return out


def list_uploads(aircraft_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    assigned = _load_assigned(aircraft)
    history = _with_assigned(_load_history(aircraft.nation), assigned, aircraft.nation)
    others: list[dict] = []
    for entry in NATIONS:
        code = entry["code"]
        if code == aircraft.nation:
            continue
        others.extend(
            item
            for item in _with_assigned(_load_history(code), assigned, code)
            if item.get("status") == "ok"
        )
    return {
        "history": history,
        "others": others,
        "latest": assigned.get("source_id") if assigned else None,
        "current": assigned,
        "nation": aircraft.nation,
    }


def get_current(aircraft_id: str) -> dict:
    listed = list_uploads(aircraft_id)
    if not listed["current"]:
        raise HTTPException(status_code=404, detail="No APC assigned")
    return listed["current"]


def _record_attempt(aircraft, *, status: str, filename: str, source: bytes, message: str | None = None, rows: int = 0) -> dict:
    attempts = _load_history(aircraft.nation)
    attempt_id = f"a{len(attempts) + 1:03d}"
    ext = Path(filename).suffix.lower() or ".xlsx"
    (_uploads_dir(aircraft.nation) / f"{attempt_id}{ext}").write_bytes(source)
    entry = {
        "id": attempt_id,
        "status": status,
        "message": message,
        "source_file": filename,
        "uploaded_at": _now(),
        "uploaded_by": aircraft.chief,
        "nation": aircraft.nation,
        "rows": rows,
        "version": _next_version(attempts) if status == "ok" else None,
    }
    attempts.append(entry)
    _write_history(aircraft.nation, attempts)
    return entry


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _save_common(nation: str, payload: dict, source: bytes, filename: str) -> None:
    folder = _common_dir(nation)
    stem = _version_stem(int(payload["version"]))
    _write_json(folder / f"{stem}.json", payload)
    ext = Path(filename).suffix.lower() or ".xlsx"
    (folder / f"{stem}{ext}").write_bytes(source)


def _assign(aircraft, payload: dict, source: bytes | None, filename: str | None) -> dict:
    folder = _aircraft_dir(aircraft.folder)
    assigned = dict(payload)
    _write_json(folder / f"{_CURRENT}.json", assigned)
    if source is not None:
        ext = Path(filename or assigned.get("source_file") or "upload.xlsx").suffix.lower() or ".xlsx"
        (folder / f"{_CURRENT}{ext}").write_bytes(source)
    return assigned


def _source_bytes(nation: str, attempt: dict) -> bytes | None:
    version = attempt.get("version")
    if version:
        stem = _version_stem(int(version))
        path = next(
            (item for item in sorted(_common_dir(nation).glob(f"{stem}.*")) if item.suffix.lower() != ".json" and item.is_file()),
            None,
        )
        if path:
            return path.read_bytes()
    uploads = _uploads_dir(nation)
    stored = next(iter(sorted(uploads.glob(f"{attempt['id']}.*"))), None)
    if stored and stored.is_file():
        return stored.read_bytes()
    return None


def _rows_from_attempt(nation: str, attempt: dict) -> list[dict]:
    version = attempt.get("version")
    if version:
        path = _common_dir(nation) / f"{_version_stem(int(version))}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8")).get("rows") or []
    source = _source_bytes(nation, attempt)
    if not source:
        raise HTTPException(status_code=404, detail="Fleet APC file was not kept")
    filename = attempt.get("source_file") or "upload.xlsx"
    rules = load_rules("apc")
    ctx = Context(filename=filename, payload=source, rules=rules)
    for check_id in ("workbook", "headers", "empty"):
        ok, detail = run_check(check_id, ctx)
        if not ok:
            raise HTTPException(status_code=400, detail=detail)
    return to_named_rows(ctx.rows, rules)


def select_attempt(aircraft_id: str, attempt_id: str, nation: str | None = None) -> dict:
    aircraft = get_aircraft(aircraft_id)
    source_nation = nation or aircraft.nation
    found = next((item for item in _load_history(source_nation) if item.get("id") == attempt_id), None)
    if not found or found.get("status") != "ok":
        raise HTTPException(status_code=404, detail="Fleet APC not found")
    rows = _rows_from_attempt(source_nation, found)
    source = _source_bytes(source_nation, found)
    payload = {
        "rows": rows,
        "source_file": found.get("source_file"),
        "uploaded_at": found.get("uploaded_at"),
        "uploaded_by": found.get("uploaded_by"),
        "nation": source_nation,
        "version": found.get("version"),
        "source_id": found["id"],
    }
    return _assign(aircraft, payload, source, found.get("source_file"))


def delete_attempt(aircraft_id: str, attempt_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    attempts = _load_history(aircraft.nation)
    found = next((item for item in attempts if item.get("id") == attempt_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Upload not found")
    kept = [item for item in attempts if item.get("id") != attempt_id]
    paths = list(_uploads_dir(aircraft.nation).glob(f"{attempt_id}.*"))
    if found.get("version"):
        paths.extend(_common_dir(aircraft.nation).glob(f"{_version_stem(int(found['version']))}.*"))
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        path.unlink(missing_ok=True)
    _write_history(aircraft.nation, kept)
    return {"ok": True, "id": attempt_id}


def download_attempt(aircraft_id: str, attempt_id: str, nation: str | None = None) -> FileResponse:
    aircraft = get_aircraft(aircraft_id)
    source_nation = nation or aircraft.nation
    attempts = _load_history(source_nation)
    found = next((item for item in attempts if item.get("id") == attempt_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Upload not found")
    path = next(iter(sorted(_uploads_dir(source_nation).glob(f"{attempt_id}.*"))), None)
    if (not path or not path.is_file()) and found.get("version"):
        path = next(
            (item for item in sorted(_common_dir(source_nation).glob(f"{_version_stem(int(found['version']))}.*")) if item.suffix.lower() != ".json"),
            None,
        )
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded file was not kept")
    types = {
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    }
    return FileResponse(path, filename=found.get("source_file") or path.name, media_type=types.get(path.suffix.lower(), "application/octet-stream"))


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def ingest_events(aircraft_id: str, filename: str, payload: bytes) -> AsyncIterator[str]:
    rules = load_rules("apc")
    ctx = Context(filename=filename, payload=payload, rules=rules)
    checks = rules["checks"]
    total = len(checks)
    yield _sse({"kind": "plan", "percent": 0, "checks": [{"id": check["id"], "label": check["label"]} for check in checks]})
    for index, check in enumerate(checks, start=1):
        yield _sse({"kind": "step", "id": check["id"], "label": check["label"], "status": "running", "percent": int((index - 1) / total * 100)})
        await asyncio.sleep(0.45)
        ok, detail = run_check(check["id"], ctx)
        percent = int(index / total * 100)
        yield _sse({"kind": "step", "id": check["id"], "label": check["label"], "status": "ok" if ok else "fail", "detail": detail, "percent": percent})
        if not ok:
            _record_attempt(get_aircraft(aircraft_id), status="fail", filename=filename, source=payload, message=detail)
            yield _sse({"kind": "error", "message": detail, "percent": percent})
            return
    rows = to_named_rows(ctx.rows, rules)
    aircraft = get_aircraft(aircraft_id)
    entry = _record_attempt(aircraft, status="ok", filename=filename, source=payload, rows=len(rows))
    common = {
        "rows": rows,
        "source_file": filename,
        "uploaded_at": entry["uploaded_at"],
        "uploaded_by": entry["uploaded_by"],
        "nation": aircraft.nation,
        "version": entry["version"],
        "source_id": entry["id"],
    }
    _save_common(aircraft.nation, common, payload, filename)
    saved = _assign(aircraft, common, payload, filename)
    yield _sse({"kind": "done", "percent": 100, "current": saved})
