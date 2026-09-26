import asyncio
import json
import random
import re
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from app.services.aircraft_store import get_aircraft
from app.services.source_validation import Context, fill_issue_label, load_rules, run_check, to_pd_rows, _version_from_filename

_ISSUE_RE = re.compile(r"^issue(\d{2})$")

_TEMPLATES = [
    ("A400M-PD-21-110-001", "21-00-00", "Air conditioning pack operational check"),
    ("A400M-PD-24-220-014", "24-00-00", "Electrical generation channel insulation test"),
    ("A400M-PD-27-310-008", "27-30-00", "Flap transmission wear inspection"),
    ("A400M-PD-28-410-003", "28-10-00", "Fuel tank water drain and sample"),
    ("A400M-PD-29-120-021", "29-10-00", "Hydraulic pump case drain check"),
    ("A400M-PD-32-210-006", "32-20-00", "Landing gear retraction sequence test"),
    ("A400M-PD-36-140-012", "36-10-00", "Bleed air leak detection functional test"),
    ("A400M-PD-49-050-002", "49-00-00", "APU start and load control check"),
    ("A400M-PD-52-330-009", "52-30-00", "Cargo door latch mechanism lubrication"),
    ("A400M-PD-57-180-017", "57-10-00", "Wing leading edge erosion survey"),
    ("A400M-PD-71-040-005", "71-00-00", "Power plant mount bolt torque check"),
    ("A400M-PD-73-260-011", "73-20-00", "Engine FADEC channel integrity test"),
    ("A400M-PD-78-090-004", "78-30-00", "Thrust reverser lock indication check"),
    ("A400M-PD-79-150-018", "79-20-00", "Oil cooler bypass valve inspection"),
]


def _pd_dir(folder: str) -> Path:
    root = Path(__file__).resolve().parent.parent.parent / "data" / "fleet" / folder / "pd"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _issue_name(number: int) -> str:
    return f"issue{number:02d}"


def _issue_number(name: str) -> int:
    match = _ISSUE_RE.match(name)
    if not match:
        raise HTTPException(status_code=404, detail="PD issue not found")
    return int(match.group(1))


def _versions_for(number: int, previous: list[str] | None = None) -> list[str]:
    extra = f"{number:02d}.00"
    if previous:
        return [*previous, extra] if extra not in previous else list(previous)
    return [extra]


def _flags(rng: random.Random, previous: dict[str, str] | None, versions: list[str]) -> dict[str, str]:
    flags: dict[str, str] = {}
    locked_out = False
    for col in versions:
        if previous:
            prior = previous.get(col, "Y")
            if locked_out or prior == "OUT":
                flags[col] = "OUT"
                locked_out = True
                continue
            if rng.random() < 0.28:
                flags[col] = "OUT"
                locked_out = True
            else:
                flags[col] = "Y"
            continue
        if locked_out:
            flags[col] = "OUT"
            continue
        if rng.random() < 0.22:
            flags[col] = "OUT"
            locked_out = True
        else:
            flags[col] = "Y"
    return flags


_FINS = (
    "21HA / LH",
    "21HA / RH",
    "24CE1 / FWD",
    "27VE / CTR",
    "28QT / WING",
    "32GB / NLG",
    "36HB / BLEED",
    "49AP / APU",
    "52CD / CARGO",
    "57LE / LE",
    "71EM / ENG1",
    "73FA / ENG2",
    "78TR / ENG3",
    "79OC / ENG4",
)
_PNS = (
    "ABS0638A01",
    "NSA5121-10",
    "EN3646A61405FN",
    "ASNA2397-5",
    "D92910000000",
    "NSA935401-03",
    "ABS1116-08",
    "EN4165M02NF",
    "NSA9313-12",
    "A400M-28-410-003",
    "NSA5127-4",
    "EN3646A61035FN",
    "ABS1114-06",
    "NSA935501-08",
)
_SNS = (
    "001238",
    "AB44192",
    "S/N 77421",
    "C04711",
    "XK-9082",
    "SN 31004",
    "M18420",
    "004901",
    "TR-2208",
    "SN 57118",
    "E71045",
    "002611",
    "R78019",
    "SN 79150",
)


def _ident(index: int) -> tuple[str, str, str]:
    if index == 6:
        return "", "", ""
    return _FINS[index % len(_FINS)], _PNS[index % len(_PNS)], _SNS[index % len(_SNS)]


_TYPES = ("Service bulletin", "Maintenance task")
_SB_SRC = (
    "A400M-SB-21-0056",
    "A400M-SB-24-0012",
    "A400M-SB-28-0008",
    "A400M-SB-32-0041",
    "A400M-SB-36-0019",
    "A400M-SB-52-0007",
    "A400M-SB-71-0023",
)
_MT_SRC = (
    "AMM 21-00-00-710-801",
    "AMM 24-22-00-200-001",
    "AMM 27-30-00-220-801",
    "AMM 29-10-00-610-801",
    "AMM 49-00-00-710-801",
    "AMM 57-10-00-200-801",
    "AMM 78-30-00-220-801",
)
_HOURS = ("1.50", "2.00", "0.50", "4.00", "3.00", "6.00", "1.00", "2.50")


def _meta(index: int) -> tuple[str, str, str]:
    kind = _TYPES[index % 2]
    sources = _SB_SRC if kind == "Service bulletin" else _MT_SRC
    return kind, sources[index % len(sources)], _HOURS[index % len(_HOURS)]


def _build_rows(msn: int, number: int, previous: list[dict] | None, versions: list[str]) -> list[dict]:
    rng = random.Random(f"ravit-pd-{msn}-{number}")
    prev_by_ref = {row["reference"]: row["flags"] for row in previous or []}
    rows: list[dict] = []
    revs = ("N/A", "00", "01", "03")
    for index, (reference, ata, description) in enumerate(_TEMPLATES):
        fin, pn, sn = _ident(index)
        kind, source_material, source_hours = _meta(index)
        rows.append(
            {
                "item_ref": f"1.{index + 1}",
                "reference": reference,
                "revision": revs[index % len(revs)],
                "ata": ata,
                "description": description,
                "type": kind,
                "source_material": source_material,
                "source_hours": source_hours,
                "fin_position": fin,
                "pn": pn,
                "sn": sn,
                "flags": _flags(rng, prev_by_ref.get(reference), versions),
            }
        )
    return rows


def _parse(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _history_path(folder: str) -> Path:
    return _pd_dir(folder) / "history.json"


def _uploads_dir(folder: str) -> Path:
    root = _pd_dir(folder) / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _load_history(aircraft) -> list[dict]:
    path = _history_path(aircraft.folder)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8")).get("attempts") or []
    attempts = []
    folder = _pd_dir(aircraft.folder)
    for issue_path in sorted(
        [item for item in folder.glob("issue*.json") if _ISSUE_RE.match(item.stem)],
        key=lambda item: _issue_number(item.stem),
    ):
        data = _parse(issue_path)
        attempts.append(
            {
                "id": issue_path.stem,
                "issue": issue_path.stem,
                "number": _issue_number(issue_path.stem),
                "status": "ok",
                "message": None,
                "source_file": data.get("source_file"),
                "uploaded_at": data.get("uploaded_at")
                or datetime.fromtimestamp(issue_path.stat().st_mtime, tz=timezone.utc).isoformat(),
                "uploaded_by": data.get("uploaded_by") or aircraft.chief,
                "rows": len(data.get("rows") or []),
            }
        )
    if attempts:
        _write_history(aircraft.folder, attempts)
    return attempts


def _write_history(folder: str, attempts: list[dict]) -> None:
    _history_path(folder).write_text(json.dumps({"attempts": attempts}, indent=2), encoding="utf-8")


def _next_attempt_id(attempts: list[dict]) -> str:
    nums = []
    for item in attempts:
        match = re.match(r"a(\d+)$", str(item.get("id") or ""))
        if match:
            nums.append(int(match.group(1)))
    return f"a{(max(nums) if nums else 0) + 1:03d}"


def _record_attempt(
    aircraft,
    *,
    status: str,
    filename: str,
    source: bytes,
    message: str | None = None,
    issue: str | None = None,
    number: int | None = None,
    rows: int = 0,
    fail_rows: list | None = None,
) -> dict:
    attempts = _load_history(aircraft)
    attempt_id = _next_attempt_id(attempts)
    ext = Path(filename).suffix.lower() or ".xlsx"
    (_uploads_dir(aircraft.folder) / f"{attempt_id}{ext}").write_bytes(source)
    entry = {
        "id": attempt_id,
        "issue": issue,
        "number": number,
        "status": status,
        "message": message,
        "source_file": filename,
        "uploaded_at": _now(),
        "uploaded_by": aircraft.chief,
        "rows": rows,
        "fail_rows": fail_rows or [],
    }
    attempts.append(entry)
    _write_history(aircraft.folder, attempts)
    return entry


def delete_attempt(aircraft_id: str, attempt_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    attempts = _load_history(aircraft)
    found = next((item for item in attempts if item.get("id") == attempt_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Upload not found")
    kept = [item for item in attempts if item.get("id") != attempt_id]
    folder = _pd_dir(aircraft.folder)
    uploads = _uploads_dir(aircraft.folder)
    paths = list(uploads.glob(f"{attempt_id}.*"))
    issue = found.get("issue")
    if found.get("status") == "ok" and issue:
        paths.extend(folder.glob(f"{issue}.*"))
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        path.unlink(missing_ok=True)
    _write_history(aircraft.folder, kept)
    return {"ok": True, "id": attempt_id}


def _source_path(folder: str, attempt: dict) -> Path | None:
    attempt_id = attempt.get("id") or ""
    uploads = _uploads_dir(folder)
    stored = next(iter(sorted(uploads.glob(f"{attempt_id}.*"))), None)
    if stored and stored.is_file():
        return stored
    issue = attempt.get("issue")
    if not issue:
        return None
    return next(
        (path for path in _pd_dir(folder).glob(f"{issue}.*") if path.suffix.lower() != ".json" and path.is_file()),
        None,
    )


def download_attempt(aircraft_id: str, attempt_id: str) -> FileResponse:
    aircraft = get_aircraft(aircraft_id)
    attempts = _load_history(aircraft)
    found = next((item for item in attempts if item.get("id") == attempt_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Upload not found")
    path = _source_path(aircraft.folder, found)
    if not path:
        raise HTTPException(status_code=404, detail="Uploaded file was not kept")
    name = found.get("source_file") or path.name
    types = {
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    }
    return FileResponse(path, filename=name, media_type=types.get(path.suffix.lower(), "application/octet-stream"))


def _with_current(attempts: list[dict]) -> list[dict]:
    latest = next((item["issue"] for item in reversed(attempts) if item.get("status") == "ok" and item.get("issue")), None)
    out = []
    for item in attempts:
        row = dict(item)
        row["current"] = bool(latest) and item.get("status") == "ok" and item.get("issue") == latest
        out.append(row)
    return out


def list_issues(aircraft_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    history = _with_current(_load_history(aircraft))
    issues = [item for item in history if item.get("status") == "ok" and item.get("issue")]
    latest = issues[-1]["issue"] if issues else None
    return {"issues": issues, "history": history, "latest": latest}


def get_issue(aircraft_id: str, issue: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    if issue == "latest":
        listed = list_issues(aircraft_id)
        if not listed["latest"]:
            raise HTTPException(status_code=404, detail="No PD loaded")
        issue = listed["latest"]
    path = _pd_dir(aircraft.folder) / f"{issue}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="PD issue not found")
    return _parse(path)


def create_next_issue(aircraft_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    listed = list_issues(aircraft_id)
    number = (listed["issues"][-1]["number"] + 1) if listed["issues"] else 1
    previous = get_issue(aircraft_id, listed["latest"]) if listed["latest"] else None
    versions = _versions_for(number, previous["versions"] if previous else None)
    payload = {
        "issue": _issue_name(number),
        "number": number,
        "versions": versions,
        "rows": _build_rows(aircraft.msn, number, previous["rows"] if previous else None, versions),
        "uploaded_at": _now(),
        "uploaded_by": aircraft.chief,
    }
    path = _pd_dir(aircraft.folder) / f"{payload['issue']}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _align_flags(flags: dict[str, str], versions: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    locked = False
    for col in versions:
        value = flags.get(col)
        if locked:
            out[col] = "OUT"
        elif value in {"Y", "OUT", "UNDER REVIEW"}:
            out[col] = value
            locked = value == "OUT"
        else:
            out[col] = value or "Y"
    return out


def _pending_dir(folder: str) -> Path:
    path = _pd_dir(folder) / "pending"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _issue_matches_version(data: dict, path: Path, version: str) -> bool:
    if data.get("version") == version or data.get("issue") == version or path.stem == version:
        return True
    major = int(version.split(".", 1)[0])
    if version.endswith(".00") and path.stem == f"issue{major:02d}":
        return True
    source = Path(str(data.get("source_file") or "")).stem
    return version in source


def find_issue_by_version(aircraft_id: str, version: str) -> dict | None:
    aircraft = get_aircraft(aircraft_id)
    folder = _pd_dir(aircraft.folder)
    for path in folder.glob("*.json"):
        if path.name == "history.json":
            continue
        data = _parse(path)
        if _issue_matches_version(data, path, version):
            return data
    for item in _load_history(aircraft):
        if item.get("status") != "ok":
            continue
        issue = item.get("issue")
        if not issue:
            continue
        path = folder / f"{issue}.json"
        if path.exists() and _issue_matches_version(_parse(path), path, version):
            return _parse(path)
        if item.get("version") == version or issue == version:
            return {"issue": issue, "version": version}
    return None


def _purge_version(aircraft, version: str) -> None:
    folder = _pd_dir(aircraft.folder)
    uploads = _uploads_dir(aircraft.folder)
    attempts = _load_history(aircraft)
    drop_ids: set[str] = set()
    for path in list(folder.glob("*.json")):
        if path.name == "history.json":
            continue
        data = _parse(path)
        if not _issue_matches_version(data, path, version):
            continue
        stem = path.stem
        for extra in folder.glob(f"{stem}.*"):
            extra.unlink(missing_ok=True)
    kept = []
    for item in attempts:
        same = item.get("status") == "ok" and (
            item.get("version") == version
            or item.get("issue") == version
            or version in Path(str(item.get("source_file") or "")).stem
        )
        if same:
            drop_ids.add(str(item.get("id") or ""))
            continue
        kept.append(item)
    for attempt_id in drop_ids:
        for path in uploads.glob(f"{attempt_id}.*"):
            path.unlink(missing_ok=True)
    _write_history(aircraft.folder, kept)


def stash_pending(aircraft_id: str, version: str, filename: str, source: bytes, versions: list[str], rows: list[dict]) -> None:
    aircraft = get_aircraft(aircraft_id)
    pending = _pending_dir(aircraft.folder)
    ext = Path(filename).suffix.lower() or ".xlsx"
    (pending / f"{version}{ext}").write_bytes(source)
    (pending / f"{version}.json").write_text(
        json.dumps({"filename": filename, "versions": versions, "rows": rows}, indent=2),
        encoding="utf-8",
    )


def discard_pending(aircraft_id: str, version: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    pending = _pending_dir(aircraft.folder)
    for path in pending.glob(f"{version}.*"):
        path.unlink(missing_ok=True)
    return {"ok": True}


def commit_pending(aircraft_id: str, version: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    pending = _pending_dir(aircraft.folder)
    meta_path = pending / f"{version}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="No validated PD waiting to replace")
    meta = _parse(meta_path)
    filename = meta.get("filename") or f"Issue {version}.xlsx"
    source_path = next((path for path in pending.glob(f"{version}.*") if path.suffix.lower() != ".json"), None)
    if not source_path:
        raise HTTPException(status_code=404, detail="No validated PD waiting to replace")
    source = source_path.read_bytes()
    _purge_version(aircraft, version)
    issue = save_issue(aircraft_id, meta.get("versions") or [], meta.get("rows") or [], filename, source, version)
    _record_attempt(
        aircraft,
        status="ok",
        filename=filename,
        source=source,
        issue=issue["issue"],
        number=issue["number"],
        rows=len(issue.get("rows") or []),
    )
    discard_pending(aircraft_id, version)
    return issue


def save_issue(
    aircraft_id: str,
    versions: list[str],
    rows: list[dict],
    filename: str,
    source: bytes,
    version: str,
) -> dict:
    aircraft = get_aircraft(aircraft_id)
    existing = find_issue_by_version(aircraft_id, version)
    number = int(version.split(".", 1)[0])
    issue_id = version
    aligned = []
    for row in rows:
        item = dict(row)
        item["flags"] = _align_flags(row.get("flags") or {}, versions)
        aligned.append(item)
    payload = {
        "issue": issue_id,
        "version": version,
        "number": number,
        "versions": versions,
        "rows": aligned,
        "source_file": filename,
        "uploaded_at": _now(),
        "uploaded_by": aircraft.chief,
    }
    folder = _pd_dir(aircraft.folder)
    if existing:
        old = existing.get("issue")
        if old and old != issue_id:
            for path in folder.glob(f"{old}.*"):
                path.unlink(missing_ok=True)
    (folder / f"{issue_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    ext = Path(filename).suffix.lower() or ".xlsx"
    (folder / f"{issue_id}{ext}").write_bytes(source)
    return payload


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def ingest_events(aircraft_id: str, filename: str, payload: bytes, replace: bool = False) -> AsyncIterator[str]:
    rules = load_rules("pd")
    ctx = Context(filename=filename, payload=payload, rules=rules)
    try:
        ctx.file_version = _version_from_filename(filename)
        ctx.issue_number = int(ctx.file_version.split(".", 1)[0])
    except ValueError:
        ctx.file_version = None
    checks = rules["checks"]
    shown = [check for check in checks if not check.get("silent")]
    total = len(shown) or len(checks)
    done = 0
    yield _sse(
        {
            "kind": "plan",
            "percent": 0,
            "checks": [{"id": check["id"], "label": fill_issue_label(check["label"], ctx.file_version)} for check in shown],
        }
    )
    fails: list[str] = []
    for check in checks:
        if check["id"] == "store" and ctx.failed:
            continue
        label = fill_issue_label(check["label"], ctx.file_version)
        silent = bool(check.get("silent"))
        if not silent:
            yield _sse(
                {
                    "kind": "step",
                    "id": check["id"],
                    "label": label,
                    "status": "running",
                    "percent": int(done / total * 100),
                }
            )
            await asyncio.sleep(0.45)
        ok, detail = run_check(check["id"], ctx)
        if not silent:
            done += 1
        percent = int(done / total * 100)
        if not ok:
            ctx.failed = True
            fails.append(detail)
        if not silent or not ok:
            yield _sse(
                {
                    "kind": "step",
                    "id": check["id"],
                    "label": label,
                    "status": "ok" if ok else "fail",
                    "detail": detail,
                    "percent": percent,
                    "rows": ctx.fail_rows,
                }
            )
    if fails:
        message = "\n\n".join(fails)
        _record_attempt(
            get_aircraft(aircraft_id),
            status="fail",
            filename=filename,
            source=payload,
            message=message,
            fail_rows=ctx.fail_rows,
        )
        yield _sse({"kind": "error", "message": message, "percent": 100, "rows": ctx.fail_rows})
        return
    version = ctx.file_version
    if not version:
        detail = "Filename must contain XX.XX"
        _record_attempt(get_aircraft(aircraft_id), status="fail", filename=filename, source=payload, message=detail)
        yield _sse({"kind": "error", "message": detail, "percent": 100})
        return
    existing = find_issue_by_version(aircraft_id, version)
    try:
        versions, rows = to_pd_rows(ctx.rows, rules)
    except Exception as exc:  # noqa: BLE001
        _record_attempt(
            get_aircraft(aircraft_id),
            status="fail",
            filename=filename,
            source=payload,
            message=str(exc) or "Could not store the Program Directive",
        )
        yield _sse({"kind": "error", "message": str(exc) or "Could not store the Program Directive", "percent": 100})
        return
    if existing:
        stash_pending(aircraft_id, version, filename, payload, versions, rows)
        yield _sse({"kind": "replace", "version": version, "percent": 100})
        return
    try:
        issue = save_issue(aircraft_id, versions, rows, filename, payload, version)
    except Exception as exc:  # noqa: BLE001
        _record_attempt(
            get_aircraft(aircraft_id),
            status="fail",
            filename=filename,
            source=payload,
            message=str(exc) or "Could not store the Program Directive",
        )
        yield _sse({"kind": "error", "message": str(exc) or "Could not store the Program Directive", "percent": 100})
        return
    _record_attempt(
        get_aircraft(aircraft_id),
        status="ok",
        filename=filename,
        source=payload,
        issue=issue["issue"],
        number=issue["number"],
        rows=len(rows),
    )
    yield _sse({"kind": "done", "percent": 100, "issue": issue})
