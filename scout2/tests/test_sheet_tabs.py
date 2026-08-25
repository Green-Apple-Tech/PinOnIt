import unittest

from scout2.sheet_tabs import lead_tab


class LeadTabTests(unittest.TestCase):
    def test_calendly_wins_even_with_email_and_phone(self):
        self.assertEqual(
            lead_tab({
                "calendly_detected": "yes",
                "email": "a@b.com",
                "phone": "555-0100",
            }),
            "Calendly users",
        )

    def test_calendly_url_counts(self):
        self.assertEqual(
            lead_tab({
                "calendly_url": "https://calendly.com/shop/hello",
                "email": "",
                "phone": "",
            }),
            "Calendly users",
        )

    def test_email_and_phone(self):
        self.assertEqual(
            lead_tab({"email": "a@b.com", "phone": "5551112222"}),
            "Emails and phones",
        )

    def test_email_only(self):
        self.assertEqual(lead_tab({"email": "a@b.com", "phone": ""}), "Emails")

    def test_phone_only(self):
        self.assertEqual(lead_tab({"email": "", "phone": "5551112222"}), "Phones")

    def test_blanks(self):
        self.assertEqual(
            lead_tab({"email": "", "phone": "", "calendly_detected": "no"}),
            "Blanks",
        )

    def test_falsey_phone_is_email_only(self):
        self.assertEqual(lead_tab({"email": "a@b.com", "phone": "false"}), "Emails")


if __name__ == "__main__":
    unittest.main()
