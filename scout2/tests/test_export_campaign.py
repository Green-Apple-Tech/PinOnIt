import unittest

from scout2.derived import (
    CAMPAIGN_HEADERS,
    business_name,
    campaign_row,
    first_name_from_email,
    greeting_from_email,
)
from scout2.exclude import is_excluded_domain, load_exclude_hosts
from scout2.export_sheet import is_exportable_lead
from scout2.sync_results import outcomes_from_records


class FirstNameTests(unittest.TestCase):
    def test_personal_local_part(self):
        self.assertEqual(first_name_from_email("andrew@greenlawns.com"), "Andrew")
        self.assertEqual(first_name_from_email("rafael@example.com"), "Rafael")
        self.assertEqual(first_name_from_email("jim@shop.co"), "Jim")
        self.assertEqual(first_name_from_email("sarah.b@firm.com"), "Sarah")

    def test_role_addresses_blank_but_kept(self):
        for addr in (
            "info@x.com",
            "sales@x.com",
            "office@x.com",
            "hello@x.com",
            "admin@x.com",
            "contact@x.com",
        ):
            self.assertEqual(first_name_from_email(addr), "")
            self.assertEqual(greeting_from_email(addr), "there")

    def test_greeting_uses_first_name(self):
        self.assertEqual(greeting_from_email("jim@shop.co"), "Jim")


class BusinessNameTests(unittest.TestCase):
    def test_title_stripped(self):
        self.assertEqual(
            business_name("Acme Landscaping LLC | Home", "ignore.com"),
            "Acme Landscaping",
        )

    def test_domain_stem_fallback(self):
        self.assertEqual(business_name("", "green-lawns.com"), "Green Lawns")


class ExcludeTests(unittest.TestCase):
    def test_seed_file_and_patterns(self):
        hosts = load_exclude_hosts()
        self.assertTrue(is_excluded_domain("calendly.com", hosts))
        self.assertTrue(is_excluded_domain("squareup.com", hosts))
        self.assertTrue(is_excluded_domain("wa.me", hosts))
        self.assertTrue(is_excluded_domain("kiter.app", hosts))
        self.assertTrue(is_excluded_domain("miami.chamber.com", hosts))
        self.assertTrue(is_excluded_domain("licenses.ca.gov", hosts))
        self.assertTrue(is_excluded_domain("school.edu", hosts))
        self.assertFalse(is_excluded_domain("greenlawns.com", hosts))


class ExportFilterTests(unittest.TestCase):
    def test_requires_bucket_email_mx_ready(self):
        hosts = set()
        base = {
            "status": "ready",
            "email": "jim@x.com",
            "mx_valid": True,
            "employees_bucket": "1",
            "domain": "x.com",
        }
        self.assertTrue(is_exportable_lead(base, hosts))
        self.assertFalse(is_exportable_lead({**base, "employees_bucket": None}, hosts))
        self.assertFalse(is_exportable_lead({**base, "email": None}, hosts))
        self.assertFalse(is_exportable_lead({**base, "mx_valid": False}, hosts))
        self.assertFalse(is_exportable_lead({**base, "status": "classified"}, hosts))

    def test_header_order(self):
        self.assertEqual(
            CAMPAIGN_HEADERS,
            [
                "email",
                "greeting",
                "first_name",
                "business_name",
                "niche",
                "city",
                "state",
                "domain",
                "segment",
                "scheduler_name",
                "employees_bucket",
                "lead_score",
                "campaign_sent",
                "date_sent",
                "replied",
                "unsubscribed",
            ],
        )
        row = campaign_row(
            {
                "email": "jim@greenlawns.com",
                "page_title": "Green Lawns Inc",
                "niche": "landscaping",
                "city": "Miami",
                "state": "FL",
                "domain": "greenlawns.com",
                "segment": "switcher",
                "scheduler_name": "calendly",
                "employees_bucket": "1",
                "lead_score": 80,
            }
        )
        self.assertEqual(row[0], "jim@greenlawns.com")
        self.assertEqual(row[1], "Jim")
        self.assertEqual(row[2], "Jim")
        self.assertEqual(row[3], "Green Lawns")
        self.assertEqual(row[-4:], ["", "", "", ""])


class GmassSyncTests(unittest.TestCase):
    def test_priority_and_columns(self):
        out = outcomes_from_records(
            [
                {"Email": "a@x.com", "Status": "Replied"},
                {"email": "b@x.com", "Bounced": "yes"},
                {"Email Address": "c@x.com", "Unsubscribed": "TRUE"},
                {"email": "d@x.com", "status": "sent"},
                {"email": "a@x.com", "Unsubscribed": "yes"},
            ]
        )
        self.assertEqual(out["a@x.com"], "unsubscribed")
        self.assertEqual(out["b@x.com"], "bounced")
        self.assertEqual(out["c@x.com"], "unsubscribed")
        self.assertEqual(out["d@x.com"], "sent")


if __name__ == "__main__":
    unittest.main()
