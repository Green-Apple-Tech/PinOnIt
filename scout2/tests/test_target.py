import unittest

from scout2.target import is_landscaper, is_multiparty_contract, is_out_of_scope


class TargetTests(unittest.TestCase):
    def test_landscaper(self):
        self.assertTrue(is_landscaper("landscaping", "greenerlawns.com"))
        self.assertTrue(is_landscaper("lawn care"))
        self.assertFalse(is_landscaper("landscape photography"))
        self.assertFalse(is_landscaper("trampoline park"))

    def test_multiparty(self):
        self.assertTrue(is_multiparty_contract("real estate agent"))
        self.assertTrue(is_multiparty_contract("solo attorney"))
        self.assertFalse(is_multiparty_contract("kayak rental"))

    def test_out_of_scope(self):
        self.assertTrue(is_out_of_scope("notary"))
        self.assertFalse(is_out_of_scope("tattoo studio"))


if __name__ == "__main__":
    unittest.main()
