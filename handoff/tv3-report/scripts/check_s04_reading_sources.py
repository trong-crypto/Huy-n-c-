"""Read-only S04 source inventory/coverage check; never imports or approves data.

Checks candidate transcriptions, not book-reading accuracy or runtime coverage.
Use --pdf-dir to additionally match the two original user PDFs by SHA-256.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SURVEY_PATH = ROOT / "data/s04_reading_source_survey.json"
SURVEY_SHA256 = "269fc5cbd3e8dca0812e9eb485233d493b89efd68ad00a96b966eeb934431457"
BRANCHES = ("TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI")
ELEMENTS = ("KIM", "MOC", "THUY", "HOA", "THO")
TOPICS = {"GENERAL", "CAREER", "WEALTH", "LOVE"}
RELATIONS = {"SAME_ELEMENT", "USE_GENERATES_BODY", "BODY_GENERATES_USE", "BODY_CONTROLS_USE", "USE_CONTROLS_BODY"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def check(path: Path = SURVEY_PATH, pdf_dir: Path | None = None) -> dict:
    text = path.read_text(encoding="utf-8")
    require(hashlib.sha256(text.encode("utf-8")).hexdigest() == SURVEY_SHA256,
            "Pinned S04 survey changed; review the transcription before updating its pin.")
    survey = json.loads(text, object_pairs_hook=unique_object)
    require(survey["schemaVersion"] == 1 and survey["task"] == "S04", "Wrong S04 schema/task")
    require(survey["runtimeApproval"] is False and survey["reviewStage"] == "SOURCE_SURVEY_ONLY",
            "S04 must not claim runtime approval or VERIFIED review")
    require(set(survey["books"]) == {"MH", "TT"}, "Missing book identity")
    for book in survey["books"].values():
        require(len(book["sha256"]) == 64 and int(book["pages"]) > 0, "Invalid book identity")
        if pdf_dir is not None:
            original = pdf_dir / book["filename"]
            require(original.is_file(), f"Original PDF missing: {book['filename']}")
            with original.open("rb") as stream:
                actual = hashlib.file_digest(stream, "sha256").hexdigest()
            require(actual == book["sha256"], f"Wrong PDF edition/hash: {book['filename']}")

    mh = survey["maiHoa"]
    require(set(mh["topics"]) == TOPICS and len(mh["topics"]) == 4, "Wrong topic set")
    require(set(mh["relations"]) == RELATIONS and len(mh["relations"]) == 5, "Wrong relation set")
    require(mh["paraphraseStatus"] == "SOURCE_LOCATED", "Candidate paraphrases must remain unapproved")
    require(mh["paraphraseKind"] == "EDITORIAL_PARAPHRASE_CANDIDATE_NOT_LITERAL_BOOK_QUOTE",
            "Paraphrases must not be labelled literal book quotations")
    require(set(mh["candidateParaphrases"]) == TOPICS, "Missing topic paraphrases")
    for topic, passages in mh["candidateParaphrases"].items():
        require(set(passages) == RELATIONS, f"Missing/extra relation for {topic}")
        require(all(isinstance(value, str) and value.strip() for value in passages.values()),
                f"Empty candidate passage for {topic}")
    sources = mh["sources"]
    require(len(sources) == 7 and len({s["id"] for s in sources}) == 7, "Missing/duplicate source sections")
    for source in sources:
        require(source["status"] == "SOURCE_LOCATED" and source["finding"] and source["limitation"],
                "Every surveyed source needs explicit findings and limitations")
        require(len(source["pdfPages"]) == len(source["printedPages"]) and source["pdfPages"], "Missing page identity")
        require(all(type(page) is int and 1 <= page <= survey["books"]["MH"]["pages"]
                    for page in source["pdfPages"]), "Invalid Mai Hoa PDF page")

    sang_hen = survey["tamThe"]["sangHen"]
    dien_san = survey["tamThe"]["dienSan"]
    require(tuple(sang_hen["monthsByBranch"]) == BRANCHES and len(sang_hen["columns"]) == 12,
            "Sang hen must contain twelve source branches/columns")
    sang_keys = set()
    for branch, row in sang_hen["monthsByBranch"].items():
        require(len(row) == 12 and all(type(value) is int for value in row)
                and set(row) == set(range(1, 13)), f"Missing/duplicate month for {branch}")
        sang_keys.update((branch, month) for month in row)
    require(len(sang_keys) == 144 and sang_hen["coverageCandidate"] == {"keys": 144, "expectedKeys": 144},
            "Sang hen candidate coverage changed")
    require(tuple(dien_san["rowsByElement"]) == ELEMENTS and len(dien_san["columns"]) == 7,
            "Dien san must contain five source elements/seven columns")
    dien_keys = set()
    for element, rows in dien_san["rowsByElement"].items():
        require(len(rows) == 2 and all(len(row) == 7 for row in rows), f"Wrong source layout: {element}")
        values = [value for row in rows for value in row if value is not None]
        require(len(values) == 12 and all(type(value) is int for value in values)
                and set(values) == set(range(1, 13)), f"Missing/duplicate month for {element}")
        dien_keys.update((element, month) for month in values)
    require(len(dien_keys) == 60 and dien_san["coverageCandidate"] == {"keys": 60, "expectedKeys": 60},
            "Dien san candidate coverage changed")
    for table in (sang_hen, dien_san):
        require(table["status"] == "SOURCE_LOCATED" and table["reviewIssues"], "Missing source review limitations")
        require(len(table["pdfPages"]) == len(table["printedPages"]) == 2, "Missing Tam The source pages")
    return {
        "task": "S04", "stage": "SOURCE_SURVEY_ONLY", "runtimeApproval": False,
        "pinnedSurveyMatched": True, "originalPdfHashesChecked": pdf_dir is not None,
        "maiHoaLocatedSections": len(sources), "maiHoaCandidateParaphrases": 20,
        "sangHenCandidateKeys": len(sang_keys), "dienSanCandidateKeys": len(dien_keys),
        "databaseChanged": False, "verificationPromoted": False,
        "remaining": ["M01_SOURCE_REVIEW", "M02_DATABASE_AND_CONTRACT", "M03_READING_SERVICE",
                      "D04_TAM_THE_COVERAGE", "I02_CLIENT", "T02_LIVE_ACCEPTANCE"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, help="Directory containing both original user PDFs")
    args = parser.parse_args()
    try:
        report = check(pdf_dir=args.pdf_dir)
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"S04 source check failed: {error}")
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
