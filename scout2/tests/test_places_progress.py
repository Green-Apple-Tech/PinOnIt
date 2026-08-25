import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scout2.places_progress import city_from_query, next_queries, place_queries


class PlaceQueryOrderTests(unittest.TestCase):
    def test_city_from_query(self):
        self.assertEqual(city_from_query("landscaping in Miami FL"), "Miami FL")
        self.assertEqual(city_from_query("solo attorney in New York NY"), "New York NY")

    def test_place_queries_are_city_first(self):
        qs = place_queries(["landscaping", "plumbing"], ["Miami FL", "Austin TX"])
        self.assertEqual(
            qs,
            [
                "landscaping in Miami FL",
                "plumbing in Miami FL",
                "landscaping in Austin TX",
                "plumbing in Austin TX",
            ],
        )

    def test_next_queries_limit_cities(self):
        import scout2.places_progress as pp

        with TemporaryDirectory() as tmp:
            done = Path(tmp) / "done.txt"
            orig = pp.DONE_PATH
            pp.DONE_PATH = done
            try:
                all_q = place_queries(["a", "b"], ["Miami FL", "Austin TX"])
                got = next_queries(all_q, limit_cities=1)
                self.assertEqual(got, ["a in Miami FL", "b in Miami FL"])
            finally:
                pp.DONE_PATH = orig
