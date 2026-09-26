from copy import deepcopy
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parent / "pd"

HEADERS = [
    "ITEM REF",
    "REFERENCE",
    "REVISION",
    "ATA",
    "DESCRIPTION",
    "TYPE",
    "SOURCE MATERIAL",
    "SOURCE HOURS",
    "FIN / POSITION",
    "PN",
    "SN",
]

ROWS = [
    ["1.1", "A400M-PD-21-110-001", "N/A", "21-00-00", "Air conditioning pack operational check", "Service bulletin", "A400M-SB-21-0056", "1.50", "21HA / LH", "ABS0638A01", "001238"],
    ["1.2", "A400M-PD-24-220-014", "00", "24-00-00", "Electrical generation channel insulation test", "Maintenance task", "AMM 24-22-00-200-001", "2.00", "21HA / RH", "NSA5121-10", "AB44192"],
    ["1.3", "A400M-PD-27-310-008", "01", "27-30-00", "Flap transmission wear inspection", "Service bulletin", "A400M-SB-28-0008", "0.50", "27VE / CTR", "EN3646A61405FN", "S/N 77421"],
    ["1.4", "A400M-PD-28-410-003", "03", "28-10-00", "Fuel tank water drain and sample", "Maintenance task", "AMM 29-10-00-610-801", "4.00", "", "", ""],
    ["1.5", "A400M-PD-32-210-006", "N/A", "32-20-00", "Landing gear retraction sequence test", "Service bulletin", "A400M-SB-32-0041", "3.00", "32GB / NLG", "D92910000000", "XK-9082"],
]


def save(name: str, headers: list, rows: list[list], sheet_name: str = "PD-SUMMARY") -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    book = Workbook()
    sheet = book.active
    sheet.title = sheet_name
    sheet.append(headers)
    for cell in sheet[1]:
        cell.number_format = "@"
    for row in rows:
        sheet.append(row)
    book.save(ROOT / name)


def ok_issue(number: int, versions: list[str], flags: list[list[str]]) -> None:
    headers = [*HEADERS, *versions]
    rows = [row + flag for row, flag in zip(ROWS, flags, strict=True)]
    save(f"ok-issue-{number:02d}.00.xlsx", headers, rows)


ROOT.mkdir(parents=True, exist_ok=True)
for stale in ROOT.glob("*.xlsx"):
    stale.unlink()


def fail(name: str, headers: list, rows: list[list], sheet_name: str = "PD-SUMMARY") -> None:
    save(name, headers, rows, sheet_name=sheet_name)


ok_issue(
    1,
    ["00.10", "00.02", "01.00"],
    [
        ["Y", "Y", "Y"],
        ["Y", "Y", "OUT"],
        ["Y", "OUT", "OUT"],
        ["Y", "Y", "Y"],
        ["Y", "Y", "Y"],
    ],
)

ok_issue(
    2,
    ["00.10", "00.02", "01.00", "02.00"],
    [
        ["Y", "OUT", "OUT", "OUT"],
        ["Y", "Y", "Y", "OUT"],
        ["Y", "Y", "Y", "Y"],
        ["Y", "Y", "OUT", "OUT"],
        ["Y", "Y", "Y", "Y"],
    ],
)

ok_issue(
    3,
    ["00.10", "00.02", "01.00", "02.00", "03.00"],
    [
        ["Y", "OUT", "OUT", "OUT", "OUT"],
        ["Y", "Y", "Y", "OUT", "OUT"],
        ["Y", "Y", "Y", "Y", "Y"],
        ["Y", "Y", "OUT", "OUT", "OUT"],
        ["Y", "Y", "Y", "Y", "OUT"],
    ],
)

fail(
    "fail-sheet.xlsx",
    [*HEADERS, "01.00"],
    [row + ["Y"] for row in ROWS],
    sheet_name="PD",
)

fail(
    "fail-issue-name.xlsx",
    [*HEADERS, "01.00"],
    [row + ["Y"] for row in ROWS],
)

fail(
    "fail-issue-version-02.00.xlsx",
    [*HEADERS, "00.10", "01.00"],
    [row + ["Y", "Y"] for row in ROWS],
)

fail(
    "fail-headers-01.00.xlsx",
    [h for h in HEADERS if h != "TYPE"] + ["01.00"],
    [row[:5] + row[6:] + ["Y"] for row in ROWS],
)

empty_rows = deepcopy(ROWS)
empty_rows[0][4] = ""
fail("fail-empty-01.00.xlsx", [*HEADERS, "01.00"], [row + ["Y"] for row in empty_rows])

bad_rows = deepcopy(ROWS)
bad_rows[0][1] = "PD-21-110-001"
bad_rows[1][5] = "SB"
bad_rows[2][2] = "1"
bad_rows[3][7] = "two"
fail("fail-values-01.00.xlsx", [*HEADERS, "01.00"], [row + ["Y"] for row in bad_rows])

fail(
    "fail-flags-01.00.xlsx",
    [*HEADERS, "00.10", "01.00"],
    [
        ROWS[0] + ["OUT", "Y"],
        ROWS[1] + ["Y", "Y"],
        ROWS[2] + ["Y", "OUT"],
        ROWS[3] + ["Y", "Y"],
        ROWS[4] + ["Y", "Y"],
    ],
)

dup_rows = deepcopy(ROWS)
dup_rows[1][0] = "1.1"
dup_rows[2][1] = "A400M-PD-21-110-001"
dup_rows[2][2] = "N/A"
fail("fail-unique-01.00.xlsx", [*HEADERS, "01.00"], [row + ["Y"] for row in dup_rows])

print("Wrote", len(list(ROOT.glob("*.xlsx"))), "files in", ROOT)
