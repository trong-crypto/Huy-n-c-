"""Check draft identity, provenance and lifecycle without loading the application or a database."""
import csv
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1] / "data"


def read_csv(name):
    with (DATA / name).open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def read_json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8-sig"))


class InterpretationDraftsTest(unittest.TestCase):
    def setUp(self):
        self.catalog = read_csv("hexagram_interpretation_sources.csv")
        self.pilots = read_json("hexagram_interpretation_pilot.draft.json")
        self.overviews = read_json("hexagram_interpretation_overviews.draft.json")

    def test_catalog_matches_e01_and_all_six_lines(self):
        trigrams = {row["code"]: row["lines_bottom_up"] for row in read_csv("trigram_source_review.csv")}
        names = read_csv("hexagram_names.csv")
        glosses = read_csv("e01_hexagram_gloss_review.csv")
        self.assertEqual(list(range(1, 65)), [int(row["order"]) for row in self.catalog])
        self.assertEqual(64, len({row["code"] for row in self.catalog}))
        self.assertEqual((64, 64), (len(names), len(glosses)))
        for entry, name, gloss in zip(self.catalog, names, glosses):
            with self.subTest(code=entry["code"]):
                self.assertEqual(entry["code"], gloss["hexagram_code"])
                self.assertEqual(entry["name"], name["name"])
                self.assertEqual(entry["upper_trigram"], name["upper"])
                self.assertEqual(entry["lower_trigram"], name["lower"])
                self.assertEqual(entry["lines_bottom_up"], trigrams[name["lower"]] + trigrams[name["upper"]])
                self.assertEqual(entry["e01_pdf_page"], gloss["pdf_page"])
                self.assertEqual(entry["e01_printed_label"], gloss["printed_source_label"])
                for key in ("zhou_yi_index_url", "zhou_yi_chapter_url"):
                    link = urlsplit(entry[key])
                    self.assertEqual((link.scheme, link.hostname), ("https", "zh.wikisource.org"))
                self.assertRegex(urlsplit(entry["zhou_yi_chapter_url"]).query, r"(?:^|&)oldid=[1-9]\d*$")
                self.assertEqual("SOURCE_LOCATED", entry["source_status"])
        self.assertEqual((self.catalog[47]["code"], self.catalog[47]["e01_printed_label"]), ("H_KHAM_TON", "Ích"))

    def test_drafts_cover_exactly_the_catalog_and_remain_unpublished(self):
        entries = self.pilots["entries"] + self.overviews["entries"]
        self.assertEqual(64, len(entries))
        self.assertCountEqual((row["code"] for row in self.catalog), (row["code"] for row in entries))
        self.assertEqual("DRAFT", self.overviews["status"])
        self.assertEqual(61, len({row["text"] for row in self.overviews["entries"]}))
        for row in self.overviews["entries"]:
            self.assertEqual("SOURCE_LOCATED", row["verificationStatus"])
            self.assertIn(len(row["text"].split()), range(150, 301))
            catalog = self.catalog[row["order"] - 1]
            self.assertEqual(row["code"], catalog["code"])
            self.assertEqual(row["source"]["url"], catalog["zhou_yi_chapter_url"])

    def test_pilots_have_provenance_and_correct_positional_lines(self):
        self.assertEqual([1, 2, 26], [row["order"] for row in self.pilots["entries"]])
        for row in self.pilots["entries"]:
            self.assertEqual(row["status"], "DRAFT")
            self.assertEqual(row["verificationStatus"], "SOURCE_LOCATED")
            catalog = self.catalog[row["order"] - 1]
            self.assertEqual(row["references"][0]["url"], catalog["zhou_yi_chapter_url"])
            self.assertEqual(row["references"][1]["pdfPage"], int(catalog["e01_pdf_page"]))
            self.assertTrue(all(section["sources"] == ["ZHOUYI"] for section in row["sections"]))
            overview = next(section["text"] for section in row["sections"] if section["kind"] == "OVERVIEW")
            self.assertIn(len(overview.split()), range(150, 301))
            lines = [section for section in row["sections"] if section["kind"] == "LINE"]
            self.assertEqual([1, 2, 3, 4, 5, 6], [line["lineNumber"] for line in lines])
            self.assertEqual(list(catalog["lines_bottom_up"]), ["1" if line["isYang"] else "0" for line in lines])


if __name__ == "__main__":
    unittest.main()
