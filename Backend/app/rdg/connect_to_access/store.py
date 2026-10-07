import json
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from app.aircraft.store import get_aircraft
from app.core.paths import DATA_DIR

_CATALOG = DATA_DIR / "validations" / "sources" / "access" / "tables.json"
_SAFE = re.compile(r"^[A-Za-z0-9_]+$")
_FOLDER = re.compile(r"^[A-Za-z0-9_ ]+$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def load_catalog() -> list[dict]:
    if not _CATALOG.exists():
        return []
    return list(json.loads(_CATALOG.read_text(encoding="utf-8")).get("tables") or [])


def _catalog_item(table_id: str) -> dict | None:
    return next((item for item in load_catalog() if item["id"] == table_id), None)


def _folder_name(item: dict) -> str:
    name = str(item.get("label") or item["id"]).strip()
    return name if _FOLDER.fullmatch(name) else item["id"]


def _current_path(folder: str, item: dict) -> Path:
    return DATA_DIR / "fleet" / folder / "Access" / _folder_name(item) / "current.json"


def get_table(aircraft_id: str, table_id: str) -> dict | None:
    aircraft = get_aircraft(aircraft_id)
    item = _catalog_item(table_id)
    if not item:
        return None
    path = _current_path(aircraft.folder, item)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def current_tables(aircraft_id: str) -> dict:
    aircraft = get_aircraft(aircraft_id)
    out = []
    for item in load_catalog():
        path = _current_path(aircraft.folder, item)
        payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        out.append(
            {
                **item,
                "current": bool(payload),
                "rows": len((payload or {}).get("rows") or []),
                "updated_at": (payload or {}).get("updated_at"),
                "source_file": (payload or {}).get("source_file"),
            }
        )
    return {"tables": out}


def _names_for(item: dict) -> set[str]:
    names = {item["id"], item.get("label") or "", *(item.get("aliases") or [])}
    return {_norm(name) for name in names if name}


def _match(item: dict, file_tables: list[str]) -> str | None:
    wanted = _names_for(item)
    for name in file_tables:
        if _norm(name) in wanted:
            return name
    return None


def _list_file_tables(path: Path) -> list[str]:
    names = _odbc_tables(path)
    if names is not None:
        return names
    names = _parser_tables(path)
    if names is not None:
        return names
    names = _dao_tables(path)
    if names is not None:
        return names
    raise HTTPException(
        status_code=400,
        detail="Could not read this Access database. Install the Microsoft Access Driver or use a .mdb file.",
    )


def _odbc_tables(path: Path) -> list[str] | None:
    try:
        import pyodbc
    except ImportError:
        return None
    conn = None
    try:
        conn = pyodbc.connect(
            rf"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={path};",
            autocommit=True,
        )
        cursor = conn.cursor()
        return [row.table_name for row in cursor.tables(tableType="TABLE") if row.table_name]
    except Exception:  # noqa: BLE001
        return None
    finally:
        if conn is not None:
            conn.close()


def _parser_tables(path: Path) -> list[str] | None:
    try:
        from access_parser import AccessParser
    except ImportError:
        return None
    try:
        parser = AccessParser(str(path))
        catalog = parser.catalog or {}
        return list(catalog.keys())
    except Exception:  # noqa: BLE001
        return None


def _odbc_rows(path: Path, table: str) -> list[dict] | None:
    try:
        import pyodbc
    except ImportError:
        return None
    conn = None
    try:
        conn = pyodbc.connect(
            rf"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={path};",
            autocommit=True,
        )
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM [{table}]")
        cols = [col[0] for col in cursor.description]
        rows = []
        for raw in cursor.fetchall():
            rows.append({cols[i]: "" if raw[i] is None else str(raw[i]) for i in range(len(cols))})
        return rows
    except Exception:  # noqa: BLE001
        return None
    finally:
        if conn is not None:
            conn.close()


def _parser_rows(path: Path, table: str) -> list[dict] | None:
    try:
        from access_parser import AccessParser
    except ImportError:
        return None
    try:
        parsed = AccessParser(str(path)).parse_table(table) or {}
        cols = list(parsed.keys())
        size = len(next(iter(parsed.values()), []))
        rows = []
        for index in range(size):
            rows.append({col: "" if parsed[col][index] is None else str(parsed[col][index]) for col in cols})
        return rows
    except Exception:  # noqa: BLE001
        return None


def _dao_db(path: Path):
    import win32com.client

    return win32com.client.Dispatch("DAO.DBEngine.120").OpenDatabase(str(path))


def _dao_cell(field) -> str:
    try:
        value = field.Value
    except Exception:  # noqa: BLE001
        return ""
    return "" if value is None else str(value)


def _dao_tables(path: Path) -> list[str] | None:
    try:
        import win32com.client  # noqa: F401
    except ImportError:
        return None
    db = None
    try:
        db = _dao_db(path)
        return [table.Name for table in db.TableDefs if table.Name and not table.Name.startswith(("MSys", "~"))]
    except Exception:  # noqa: BLE001
        return None
    finally:
        if db is not None:
            db.Close()


def _dao_rows(path: Path, table: str) -> list[dict] | None:
    try:
        import win32com.client  # noqa: F401
    except ImportError:
        return None
    db = None
    try:
        db = _dao_db(path)
        record = db.OpenRecordset(table)
        cols = [record.Fields(index).Name for index in range(int(record.Fields.Count))]
        rows = []
        while not record.EOF:
            rows.append({col: _dao_cell(record.Fields(index)) for index, col in enumerate(cols)})
            record.MoveNext()
        record.Close()
        return rows
    except Exception:  # noqa: BLE001
        return None
    finally:
        if db is not None:
            db.Close()


def _read_rows(path: Path, table: str) -> list[dict]:
    rows = _odbc_rows(path, table)
    if rows is not None:
        return rows
    rows = _parser_rows(path, table)
    if rows is not None:
        return rows
    rows = _dao_rows(path, table)
    if rows is not None:
        return rows
    raise HTTPException(status_code=400, detail=f"Could not read Access table {table}.")


def _write_upload(suffix: str, payload: bytes) -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(payload)
    tmp.close()
    return Path(tmp.name)


def scan_access(aircraft_id: str, filename: str, payload: bytes) -> dict:
    aircraft = get_aircraft(aircraft_id)
    suffix = Path(filename).suffix.lower() or ".mdb"
    if suffix not in {".mdb", ".accdb"}:
        raise HTTPException(status_code=400, detail="Select an Access database (.mdb or .accdb).")
    path = _write_upload(suffix, payload)
    try:
        file_tables = _list_file_tables(path)
        current = {item["id"]: item for item in current_tables(aircraft_id)["tables"]}
        tables = []
        for item in load_catalog():
            file_name = _match(item, file_tables)
            held = current.get(item["id"]) or {}
            tables.append(
                {
                    **item,
                    "in_file": bool(file_name),
                    "file_name": file_name,
                    "current": bool(held.get("current")),
                    "rows": held.get("rows") or 0,
                }
            )
        return {"file": filename, "tables": tables}
    finally:
        path.unlink(missing_ok=True)


def commit_access(aircraft_id: str, filename: str, payload: bytes, table_ids: list[str]) -> dict:
    aircraft = get_aircraft(aircraft_id)
    wanted = {item for item in table_ids if _SAFE.fullmatch(item)}
    if not wanted:
        raise HTTPException(status_code=400, detail="Select at least one table to ingest.")
    suffix = Path(filename).suffix.lower() or ".mdb"
    if suffix not in {".mdb", ".accdb"}:
        raise HTTPException(status_code=400, detail="Select an Access database (.mdb or .accdb).")
    catalog = {item["id"]: item for item in load_catalog()}
    unknown = wanted - set(catalog)
    if unknown:
        raise HTTPException(status_code=400, detail="Unknown tables in the ingest list.")
    upload = _write_upload(suffix, payload)
    saved = []
    try:
        file_tables = _list_file_tables(upload)
        current = {item["id"]: item for item in current_tables(aircraft_id)["tables"]}
        for table_id in [item["id"] for item in load_catalog() if item["id"] in wanted]:
            item = catalog[table_id]
            file_name = _match(item, file_tables)
            if not file_name:
                raise HTTPException(status_code=400, detail=f"Not in this Access file: {item['label']}.")
            rows = _read_rows(upload, file_name)
            body = {
                "id": item["id"],
                "label": item["label"],
                "source_table": file_name,
                "source_file": filename,
                "updated_at": _now(),
                "rows": rows,
            }
            dest = _current_path(aircraft.folder, item)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(body, indent=2), encoding="utf-8")
            saved.append(
                {
                    "id": table_id,
                    "label": item["label"],
                    "rows": len(rows),
                    "replaced": bool((current.get(table_id) or {}).get("current")),
                }
            )
    finally:
        upload.unlink(missing_ok=True)
    return {"ok": True, "file": filename, "saved": saved, **current_tables(aircraft_id)}
