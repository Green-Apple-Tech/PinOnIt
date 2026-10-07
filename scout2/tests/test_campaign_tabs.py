import unittest

from scout2.campaign_tabs import next_open_batch
from scout2.scrapers.serp import doc_phrase


class BatchTabTests(unittest.TestCase):
    def test_starts_at_one(self):
        self.assertEqual(next_open_batch([]), ("new-001", 0))

    def test_fills_current_until_1000(self):
        self.assertEqual(next_open_batch([("new-001", 40)]), ("new-001", 40))

    def test_rolls_after_1000(self):
        self.assertEqual(
            next_open_batch([("new-001", 1000), ("All emails", 2873)]),
            ("new-002", 0),
        )


class DocPhraseTests(unittest.TestCase):
    def test_rotates(self):
        self.assertEqual(doc_phrase(0), "waiver")
        self.assertEqual(doc_phrase(1), "NDA")
        self.assertEqual(doc_phrase(4), "waiver")


if __name__ == "__main__":
    unittest.main()
