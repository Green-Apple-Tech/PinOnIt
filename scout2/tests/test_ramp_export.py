import unittest
from datetime import date

from scout2.ramp_export import load_ramp, niche_slug, ramp_tab_name, target_for_day


class RampConfigTests(unittest.TestCase):
    def test_day_targets(self):
        ramp = load_ramp()
        self.assertEqual(target_for_day(1, ramp), 10)
        self.assertEqual(target_for_day(4, ramp), 20)
        self.assertEqual(target_for_day(8, ramp), 35)
        self.assertEqual(target_for_day(12, ramp), 50)
        self.assertEqual(target_for_day(20, ramp), 75)
        self.assertEqual(target_for_day(21, ramp), 110)
        self.assertEqual(target_for_day(99, ramp), 110)

    def test_tab_name(self):
        self.assertEqual(
            ramp_tab_name("landscaping", 1, date(2026, 8, 26)),
            "landscaping-day01-20260826",
        )
        self.assertEqual(niche_slug("Pest Control"), "pest-control")


if __name__ == "__main__":
    unittest.main()
