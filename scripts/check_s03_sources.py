#!/usr/bin/env python3
"""Read-only integrity check for the S03 survey. Never imports SQL or approves rules."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/s03_source_manifest.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_csv(relative: str) -> list[dict[str, str]]:
    with (ROOT / relative).open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    require(bool(rows) and all(None not in row and None not in row.values() for row in rows),
            f"Empty or malformed CSV: {relative}")
    return rows


def pages(value: str) -> list[int]:
    ends = [int(part) for part in value.split("-")]
    require(len(ends) in (1, 2) and min(ends) > 0, f"Invalid page range: {value}")
    require(ends[0] <= ends[-1], f"Reversed page range: {value}")
    return list(range(ends[0], ends[-1] + 1))


def check(pdf_dir: Path) -> tuple[dict, dict[str, list[int]]]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    require(manifest["schemaVersion"] == 1 and manifest["task"] == "S03", "Wrong manifest version/task")
    require(manifest["runtimeApproval"] is False
            and manifest["reviewStage"] == "SOURCE_SURVEY_ONLY", "A survey cannot approve runtime rules")
    require(set(manifest["files"]) == {
        "data/s03_source_matrix.csv", "data/s03_hexagram_source_map.csv", "data/hexagram_names.csv",
    }, "Unexpected data files in manifest")
    for name, expected in manifest["files"].items():
        require(digest(ROOT / name) == expected, f"Data hash mismatch: {name}")
    books = {book["bookId"]: book for book in manifest["books"]}
    require(len(manifest["books"]) == 2 and set(books) == {"MH", "TT"}, "Expected two distinct books")
    for book in books.values():
        filename = book["filename"]
        require(Path(filename).name == filename, "Book filename must not contain directories")
        require(digest(pdf_dir / filename) == book["sha256"], f"PDF hash mismatch: {book['bookId']}")
        reviewed = book["reviewedPdfPages"]
        require(len(reviewed) == len(set(reviewed))
                and all(type(p) is int and 1 <= p <= book["pages"] for p in reviewed), "Invalid reviewed pages")

    matrix = read_csv("data/s03_source_matrix.csv")
    require(len(matrix) == 13 and len({r["source_key"] for r in matrix}) == 13, "Expected 13 distinct source entries")
    require({"CAREER", "WEALTH", "LOVE"} <= {r["category"] for r in matrix}, "Missing required Tam The category")
    render_pages: dict[str, set[int]] = {key: set() for key in books}
    for row in matrix:
        require(all(row.values()), f"Missing matrix metadata: {row['source_key']}")
        require(row["source_status"] in {"SOURCE_LOCATED", "SOURCE_AMBIGUOUS"}, "Survey must not promote verification")
        book = books[row["book_id"]]
        selected = pages(row["pdf_pages"])
        require(set(selected) <= set(book["reviewedPdfPages"]), f"Unreviewed matrix page: {row['source_key']}")
        render_pages[row["book_id"]].update(selected)
        if not row["printed_pages"].startswith("TOC:"):
            printed = pages(row["printed_pages"])
            require(len(printed) == len(selected), f"Mismatched PDF/printed ranges: {row['source_key']}")

    canonical = read_csv("data/hexagram_names.csv")
    meanings = read_csv("data/s03_hexagram_source_map.csv")
    require(len(meanings) == len(canonical) == 64, "Expected 64 canonical identities and 64 gloss candidates")
    require({int(r["order"]) for r in meanings} == set(range(1, 65)), "Missing/duplicate canonical orders")
    require(len({r["hexagram_code"] for r in meanings}) == 64, "Duplicate hexagram code")
    names = {r["order"]: r for r in canonical}
    for row in meanings:
        name = names[row["order"]]
        require(row["hexagram_code"] == f"H_{name['upper']}_{name['lower']}"
                and row["canonical_name"] == name["name"]
                and (row["upper"], row["lower"]) == (name["upper"], name["lower"]), "Canonical identity changed")
        require(row["pdf_page"] == name["pdf_page"] and row["printed_page"] == name["printed_page"], "Gloss page mismatch")
        require(row["book_id"] == "MH" and row["source_sha256"] == books["MH"]["sha256"], "Wrong gloss edition")
        require(bool(row["gloss_candidate"].strip()) and row["source_status"] in {
            "SOURCE_LOCATED", "SOURCE_AMBIGUOUS",
        }, "Missing gloss or invalid survey status")
        require(row["review_stage"] == "SOURCE_SURVEY_ONLY" and not row["reviewer"], "Survey is not second-pass approval")
        order = int(row["order"])
        require(row["section"] == ("THUONG_KINH" if order <= 30 else "HA_KINH")
                and int(row["item_in_section"]) == (order if order <= 30 else order - 30), "Wrong list locator")
    tinh = next(row for row in meanings if row["hexagram_code"] == "H_KHAM_TON")
    require(tinh["source_status"] == "SOURCE_AMBIGUOUS"
            and tinh["notes"] == "SOURCE_LABEL_ICH_AT_TINH_POSITION", "Lost printed Tinh/Ich conflict")
    for finding in manifest["findings"]:
        require(set(finding["pages"]) <= set(books[finding["bookId"]]["reviewedPdfPages"]), "Finding references an unreviewed page")
    return manifest, {key: sorted(value) for key, value in render_pages.items()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--render-dir", type=Path, help="Optionally render matrix pages here; no PDF or database is modified")
    args = parser.parse_args()
    try:
        manifest, selected = check(args.pdf_dir)
        print("S03 integrity OK: 2 PDF hashes, 13 source entries, 64 canonical gloss candidates.")
        print("Survey only: no SQL, no VERIFIED promotion, no runtime approval.")
        if args.render_dir is not None:
            executable = shutil.which("pdftoppm")
            require(executable is not None, "pdftoppm is required for --render-dir")
            args.render_dir.mkdir(parents=True, exist_ok=True)
            for book in manifest["books"]:
                for page in selected[book["bookId"]]:
                    subprocess.run([
                        executable, "-f", str(page), "-l", str(page), "-scale-to", "1700",
                        "-singlefile", "-png", str(args.pdf_dir / book["filename"]),
                        str(args.render_dir / f"{book['bookId']}-{page:03}"),
                    ], check=True, capture_output=True)
            print(f"Rendered {sum(map(len, selected.values()))} matrix pages.")
        return 0
    except (KeyError, ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"S03 integrity FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
