import re
from typing import Any

_NA = "N/A"
_SKIP_FIELDS = {"source_hours", "document_type", "type", "ata", "title", "reference", "flags"}
_FIELDS = (
    "scope_comitee_id",
    "task_reference",
    "revision",
    "description",
    "pn",
    "sn",
    "fin_position",
    "source_material",
    "pd_comment",
)
_ISSUE_COL = re.compile(r"^\d{2}\.\d{2}$")


def _cell(value: Any) -> str:
    if value is None or value == "":
        return _NA
    return str(value)


def _issue_col(issue: str) -> str:
    return issue if _ISSUE_COL.fullmatch(issue) else f"{issue}.00"


def _is_out(value: str) -> bool:
    return value.lower() == "out"


def _flatten(row: dict, drop_issue: str | None = None) -> dict[str, str]:
    out: dict[str, str] = {"item_ref": _cell(row.get("item_ref"))}
    for key in _FIELDS:
        raw = row.get(key)
        if key == "description":
            raw = raw or row.get("title")
        if key == "task_reference":
            raw = raw or row.get("reference")
        if key == "scope_comitee_id":
            raw = raw or row.get("reference")
        out[key] = _cell(raw)
    for version, flag in (row.get("flags") or {}).items():
        name = str(version)
        if name in _SKIP_FIELDS or name == drop_issue:
            continue
        out[name] = _cell(flag)
    return out


def generate_delta_pd(pd_new: dict, pd_old: dict | None) -> dict:
    new_issue = str(pd_new.get("issue") or "")
    old_issue = str((pd_old or {}).get("issue") or "")
    str_new = _issue_col(new_issue)
    str_old = _issue_col(old_issue)

    # Newest issue flag lives only on the new PD. Never pair it (_New/_Old/__Check).
    new_rows = [_flatten(row) for row in pd_new.get("rows") or []]

    if not pd_old or not pd_old.get("rows"):
        rows = [{key: "" if value == _NA else value for key, value in row.items()} | {"Item_Status": "new_line"} for row in new_rows]
        columns = ["item_ref", "Item_Status", *[key for key in (rows[0] if rows else {}) if key not in {"item_ref", "Item_Status"}]]
        return {"new": new_issue, "old": old_issue or None, "versions": pd_new.get("versions") or [], "columns": columns, "rows": rows}

    old_rows = [_flatten(row, drop_issue=str_new) for row in pd_old["rows"]]
    old_by_ref = {row["item_ref"]: row for row in old_rows}

    new_keys: set[str] = set()
    old_keys: set[str] = set()
    for row in new_rows:
        new_keys.update(row)
    for row in old_rows:
        old_keys.update(row)
    new_keys.discard("item_ref")
    old_keys.discard("item_ref")

    shared = sorted((new_keys & old_keys) - {str_new})
    only_new = sorted((new_keys - old_keys) | ({str_new} & new_keys))
    only_old = sorted((old_keys - new_keys) - {str_new})

    rows: list[dict[str, str]] = []
    for neu in new_rows:
        prev = old_by_ref.get(neu["item_ref"])
        rec: dict[str, str] = {"item_ref": neu["item_ref"]}

        for key in shared:
            rec[f"{key}_New"] = neu.get(key, _NA)
            rec[f"{key}_Old"] = (prev or {}).get(key, _NA)
        for key in only_new:
            rec[key] = neu.get(key, _NA)
        for key in only_old:
            rec[key] = (prev or {}).get(key, _NA)

        old_cols = [key for key in rec if key.endswith("_Old")]
        rec["Item_Status"] = "new_line" if not prev or (old_cols and all(rec[key] == _NA for key in old_cols)) else "Change"

        for key in shared:
            left = rec[f"{key}_New"]
            right = rec[f"{key}_Old"]
            rec[f"{key}__Check"] = _NA if left == _NA and right == _NA else ("-" if left == right else "X")

        if rec["Item_Status"] != "Change":
            for key in rec:
                if "__" in key:
                    rec[key] = "!"

        last_new = rec.get(f"{str_old}_New", _NA)
        next_flag = rec.get(str_new, _NA)
        rec["ChangeStatus__Check"] = "-" if last_new == next_flag else "X"

        if not any(value in {"X", "!"} or (isinstance(value, str) and ("X" in value or "!" in value)) for key, value in rec.items() if "__Check" in key):
            continue

        if last_new != next_flag and last_new == "Y" and _is_out(next_flag):
            rec["Item_Status"] = "Discard_Line"

        for key, value in rec.items():
            if value == _NA:
                rec[key] = ""
        rows.append(rec)

    exclude = {key for key in (rows[0] if rows else {}) if key.startswith("Item") or key == "item_ref"}
    status = {key for key in (rows[0] if rows else {}) if key.startswith("ChangeStatus")}
    all_cols = list(rows[0]) if rows else ["item_ref", "Item_Status", "ChangeStatus__Check"]
    digits = sorted(key for key in all_cols if key not in exclude and key not in status and re.search(r"\d", key))
    other = sorted(key for key in all_cols if key not in exclude and key not in status and key not in digits)
    columns = ["item_ref", "Item_Status", *other, *digits, *sorted(status)]
    rows.sort(key=lambda row: (row.get("Item_Status") or "", row.get("item_ref") or ""))
    versions = [col for col in (pd_new.get("versions") or []) if col != str_new]
    if str_old not in versions:
        versions = [*versions, str_old]
    return {"new": new_issue, "old": old_issue, "versions": versions, "columns": columns, "rows": rows}
