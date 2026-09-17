from copy import deepcopy
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parent / "apc"

HEADERS = ["POSITION CODE", "PNR", "SNR"]

ROWS = [
    ["21HA / LH", "ABS0638A01", "001238"],
    ["21HA / RH", "NSA5121-10", "AB44192"],
    ["27VE / CTR", "EN3646A61405FN", "S/N 77421"],
    ["32GB / NLG", "D92910000000", "XK-9082"],
]


def save(name: str, headers: list, rows: list[list]) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    book = Workbook()
    sheet = book.active
    sheet.title = "APC"
    sheet.append(headers)
    for cell in sheet[1]:
        cell.number_format = "@"
    for row in rows:
        sheet.append(row)
    book.save(ROOT / name)


save("upload.xlsx", HEADERS, ROWS)
save("ok.xlsx", HEADERS, ROWS)

save(
    "fail-headers.xlsx",
    ["POSITION CODE", "PNR"],
    [row[:2] for row in ROWS],
)

empty_rows = deepcopy(ROWS)
empty_rows[0][0] = ""
save("fail-empty.xlsx", HEADERS, empty_rows)

dup_rows = deepcopy(ROWS)
dup_rows[1][0] = ROWS[0][0]
save("fail-unique.xlsx", HEADERS, dup_rows)

print("Wrote", len(list(ROOT.glob("*.xlsx"))), "files in", ROOT)
