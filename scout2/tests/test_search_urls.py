import base64
import unittest

from scout2.search import _clean_result, _decode_bing_redirect


class SearchUrlTests(unittest.TestCase):
    def test_duckduckgo_redirect_unwraps(self):
        href = (
            "//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.skyzone.com%2Fbirmingham-al%2F"
            "&rut=abc"
        )
        self.assertEqual(
            _clean_result(href),
            "https://www.skyzone.com/birmingham-al/",
        )

    def test_bing_ck_redirect_decodes(self):
        target = "https://www.skyzone.com/birmingham-al/"
        token = "a1" + base64.urlsafe_b64encode(target.encode()).decode().rstrip("=")
        href = f"https://www.bing.com/ck/a?!&&p=deadbeef&u={token}&ntb=1"
        self.assertEqual(_decode_bing_redirect(href), target)
        self.assertEqual(_clean_result(href), target)

    def test_bing_without_target_is_dropped(self):
        self.assertIsNone(_clean_result("https://www.bing.com/search?q=trampoline"))
