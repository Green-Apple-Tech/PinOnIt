import json
import unittest
from datetime import datetime, timedelta, timezone

from scout2.scaleserp_discover import discovery_queries, is_waiver_niche
from scout2.tool_detect import detect_tools, merge_tool_flags


class ToolDetectTests(unittest.TestCase):
    def test_calendly_script_and_link(self):
        html = """
        <a href="https://calendly.com/green-lawns/book">Book</a>
        <script>Calendly.initInlineWidget({url:'https://calendly.com/green-lawns/book'})</script>
        """
        flags = detect_tools(html)
        self.assertEqual(flags["uses_calendly"], "Y")
        self.assertEqual(flags["uses_docusign"], "N")
        self.assertIn("calendly.com", flags["detected_url"])

    def test_docusign_and_smartwaiver(self):
        html = """
        <a href="https://www.docusign.net/Member/PowerForms">Sign</a>
        <a href="https://waiver.smartwaiver.com/w/abc">Waiver</a>
        """
        flags = detect_tools(html)
        self.assertEqual(flags["uses_docusign"], "Y")
        self.assertEqual(flags["uses_waiver"], "Y")
        self.assertEqual(flags["waiver_provider"], "smartwaiver")
        self.assertIn("docusign.net", flags["detected_url"])

    def test_jotform_waiver_requires_both(self):
        plain = detect_tools('<a href="https://form.jotform.com/123">Contact</a>')
        waiver = detect_tools('<a href="https://form.jotform.com/123">Sign our waiver</a>')
        self.assertEqual(plain["uses_waiver"], "N")
        self.assertEqual(waiver["uses_waiver"], "Y")
        self.assertEqual(waiver["waiver_provider"], "jotform")

    def test_release_form_text(self):
        flags = detect_tools('<a href="/files/guest.pdf">Release form</a>')
        self.assertEqual(flags["uses_waiver"], "Y")
        self.assertEqual(flags["waiver_provider"], "pdf")

    def test_merge_keeps_first_url(self):
        first = '<a href="https://calendly.com/a">Book</a>'
        second = '<a href="https://www.docusign.com/sign">Sign</a>'
        merged = merge_tool_flags([first, second])
        self.assertEqual(merged["uses_calendly"], "Y")
        self.assertEqual(merged["uses_docusign"], "Y")
        self.assertIn("calendly.com", merged["detected_url"])


class DiscoveryQueryTests(unittest.TestCase):
    def test_waiver_niche_gets_online_waiver_query(self):
        self.assertTrue(is_waiver_niche("trampoline park"))
        queries = discovery_queries(["landscaping", "trampoline park"])
        texts = [query for _kind, query in queries]
        self.assertIn("trampoline park online waiver", texts)
        self.assertNotIn("landscaping online waiver", texts)
        self.assertIn('site:calendly.com "trampoline park"', texts)
        self.assertLess(
            texts.index("trampoline park book online calendly"),
            texts.index("landscaping book online calendly"),
        )

    def test_recent_query_filter(self):
        import scout2.scaleserp_discover as mod
        from tempfile import TemporaryDirectory

        old = datetime.now(timezone.utc) - timedelta(days=31)
        new = datetime.now(timezone.utc).isoformat()
        with TemporaryDirectory() as tmp:
            mod.LOG_PATH = __import__("pathlib").Path(tmp) / "log.json"
            mod.LOG_PATH.write_text(
                json.dumps(
                    [
                        {"query": "old query", "at": old.isoformat()},
                        {"query": "new query", "at": new},
                    ]
                )
            )
            found = mod.recent_queries()
        self.assertIn("new query", found)
        self.assertNotIn("old query", found)
