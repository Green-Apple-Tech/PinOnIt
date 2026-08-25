import unittest

from scout2.scrapers.extra import (
    is_angi_profile,
    is_avvo_profile,
    is_bbb_profile,
    is_calendly_page,
    is_coach_profile,
    is_gov_directory,
    is_houzz_profile,
    is_psychology_today,
    is_wedding_profile,
)


class ExtraSourceUrlTests(unittest.TestCase):
    def test_psychology_today(self):
        self.assertTrue(
            is_psychology_today("https://www.psychologytoday.com/us/therapists/jane-miami-fl/123")
        )
        self.assertFalse(is_psychology_today("https://www.psychologytoday.com/us/blog/hello"))

    def test_wedding(self):
        self.assertTrue(is_wedding_profile("https://www.theknot.com/marketplace/studio-miami"))
        self.assertTrue(is_wedding_profile("https://www.weddingwire.com/biz/photo-co"))
        self.assertFalse(is_wedding_profile("https://www.theknot.com/blog/tips"))

    def test_home_and_legal(self):
        self.assertTrue(is_houzz_profile("https://www.houzz.com/professionals/landscape-architects/p/x"))
        self.assertTrue(is_angi_profile("https://www.angi.com/companylist/us/fl/miami/plumber.htm"))
        self.assertTrue(is_bbb_profile("https://www.bbb.org/us/fl/miami/profile/plumber/acme-123"))
        self.assertTrue(is_avvo_profile("https://www.avvo.com/attorneys/33131-fl-jane-doe-123.html"))
        self.assertTrue(is_coach_profile("https://www.noomii.com/coaches/jane-doe"))

    def test_gov_and_calendly(self):
        self.assertTrue(is_gov_directory("https://www.cslb.ca.gov/onlineservices/checklicense"))
        self.assertFalse(is_gov_directory("https://www.irs.gov/news"))
        self.assertTrue(is_calendly_page("https://calendly.com/jane-studio/intro"))
        self.assertFalse(is_calendly_page("https://calendly.com/blog/tips"))
