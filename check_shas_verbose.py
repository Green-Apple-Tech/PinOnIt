import hashlib, os

base = '/tmp/cc-agent/66248711/project'
files = {
    'src/App.tsx': 'cc22eb118a839347ab711f8a0d76c7297d3a599e',
    'src/components/AIChat.tsx': '2099501ad95dbd5a37835196c986995036a63755',
    'src/components/Auth.tsx': '51a635de97eba969c203e761e1b736cd47d95c31',
    'src/components/AuthCallback.tsx': 'f7932fb8ef53dec7a94c2a34d4adbe4c6d68ec5d',
    'src/components/CalendarConnections.tsx': '5c8a44419393059a1b848f0a3bfeb2e507270de6',
    'src/components/ColorSwatchRow.tsx': 'cf6f6afe1a649647bfb64bcd70b8438ac1106e67',
    'src/components/Footer.tsx': '5d51a0062b9571d7df284d65a41ea385ce2bfbbe',
    'src/components/OnboardingWizard.tsx': '033d3e996002ec7543faabee587238637b88f927',
    'src/components/PageChecklist.tsx': '17b333c66f95e5a02dae992efa7e191186b4e6ed',
    'src/components/ProtectedRoute.tsx': 'd407792818d3f2cde162b8b5abd6ab9fda4110b8',
    'src/components/QRModal.tsx': 'de945df98eef62b8ca832c0c6b09d2bbd136e408',
    'src/components/SessionManager.tsx': '2940b1ea0ec07cee443b67b92c5b9f0967a6459c',
    'src/components/Toast.tsx': 'd29d7f58c04f04afe335d20e39b7a602d82ca81a',
    'src/hooks/useAuth.tsx': 'f6df09fe65376221ce1321816809d005055ea0b9',
    'src/hooks/useTheme.tsx': '2fec9408aebf3710af0c4f9ea69b7bfc850ab1c1',
    'src/index.css': '8ec8792e3455051ded025b36522edf4c22a7089c',
    'src/lib/coordinateScheduling.ts': '06745b40d0d330f3203fb9297a5232d5f9f31561',
    'src/lib/phone.ts': 'bd7abe03a9bfb9fe997e8f2ee6838bcd7d3e993f',
    'src/lib/recurring.ts': 'ded9d2e14ea6feb54c781cf3922d8da384a8b441',
    'src/lib/reminderChannels.ts': 'cfe95b425f808d9ee83c5ea5790d6c816322a8c6',
    'src/lib/singleUseLinks.ts': '257ebb0f22ee2145fa0a5db8520ebbe22532b2be',
    'src/lib/supabase.ts': 'cb15a974437d35f34b874499ba37c0f1f7c81e72',
    'src/lib/types.ts': '41ababbab47eb0c98276ce31843e815c8da0d131',
    'src/main.tsx': 'ea9e3630a4f82a3cc92500297b28fa6f1ff72a75',
    'src/pages/AcceptableUse.tsx': '085eeedc57ce766bcb49a21db58c2d44dd11b57e',
    'src/pages/Analytics.tsx': '88b8ae2e8f3b937d493e58fa4ed8bc7277480bde',
    'src/pages/Appointments.tsx': '2ccba077ae8a599716ccead5fe3a7d9703c16f80',
    'src/pages/Availability.tsx': 'e616489fc1425ed2a191ba9fbdae83ea52e38ddc',
    'src/pages/Billing.tsx': 'f1f1cb62ffef81a0fe10aad068038411ddd98dd2',
    'src/pages/Book.tsx': '85a3cd0e2b8c9201b6984b656c17b8c6bd80ab38',
    'src/pages/BookingAction.tsx': '2ccd55925aa1db931566a21ec5a3d63c088af5df',
    'src/pages/Contacts.tsx': '277bea16b10c72395cbc60667f43f1539eed29bc',
    'src/pages/CoordinateMeetings.tsx': '6603160a8787a2869f2965c3b71221bd60da8c95',
    'src/pages/Dashboard.tsx': '092dcfcdd8b414932dd911c74098f0efaa6cebf4',
    'src/pages/EmailSignature.tsx': '43f85d3c1e48dad68ddb1e2f15c533df50df41fa',
    'src/pages/GroupScheduling.tsx': '9e14b57e632274904d5dc85f508acbeb1efdeacb',
    'src/pages/Landing.tsx': '7f38ced02e271e3f1daceb63695125e493e541b6',
    'src/pages/Leaderboard.tsx': '771fee8cdc156ea141bfd53fc93e6d9d402c453a',
    'src/pages/MeetingPolls.tsx': '137eac537dec7eec7e22f4978be12e21b669be84',
    'src/pages/NotFound.tsx': '2b25f06a9d4095112951d5a3a3beafaedc2c75f8',
    'src/pages/Onboarding.tsx': '4955b79fc35083d05b6a1ba46e311e8acfda9ddb',
    'src/pages/PaidBooking.tsx': '164521f9ca7fb322dbd04c564f466698b6d296c7',
    'src/pages/PollVote.tsx': 'df176e0561412c869832bf2d065a52d28aa9accc',
    'src/pages/Privacy.tsx': '2d38e45c826bf065d4df47eedc140b4408b0533a',
    'src/pages/QRCreator.tsx': '2fa5a23c24e586ee01590dec8d3ea5f6e09ed494',
    'src/pages/Reminders.tsx': 'd81ff07fd0388ccdd3874e931b0ba7f62e170943',
    'src/pages/Services.tsx': '9efd19ee6e81269ac01e8712fbf566a84a568f08',
    'src/pages/Settings.tsx': 'dcbf37d9aae5cc303afbfd62ad39511af45cb0f7',
    'src/pages/Status.tsx': '77ae2f20a22d9beaffdaafece5050521e965e3e1',
    'src/pages/Terms.tsx': 'af44e9df1851f1b8bfc3621cc897133a2b8129f6',
    'src/vite-env.d.ts': '11f02fe2a0061d6e6e1f271b21da95423b448b32',
    'supabase/functions/booking-reply/index.ts': '191efcd9c2232dd2e22dc561a94a3478db1653db',
    'supabase/functions/calendar-sync/index.ts': 'e41b5ce5faa798f1560ed9f1627d74833f9bfa66',
    'supabase/functions/coordinate-sms/index.ts': 'b7bc11541e875b1b26a214fec096e4f70afa5795',
    'supabase/functions/create-teams-meeting/index.ts': 'bb7932120b8bb8d4a67bfb982e74272bdeac428d',
    'supabase/functions/create-zoom-meeting/index.ts': '43a87b052489c5c4ca83acdba5427a19dc910d65',
    'supabase/functions/critical-alert/index.ts': '5a271291c310d686bbaceaf4074d97be6a304a54',
    'supabase/functions/google-calendar-auth/index.ts': '36f8503bc8ceb014ce86e945135bcb23b808b667',
    'supabase/functions/google-calendar-callback/index.ts': 'd914c39c26ae2c9c95014beb737b5bf2f6a88026',
    'supabase/functions/health-monitor/index.ts': 'f10862873686a86a87ae1829a655b999cd9da3d5',
    'supabase/functions/outlook-calendar-auth/index.ts': '9cb17ddfc5c6b413ab537135a0e4439f1457bb94',
    'supabase/functions/outlook-calendar-callback/index.ts': 'cfa4d35f3d00487598173adc6655d02db732488b',
    'supabase/functions/parse-availability/index.ts': 'f657cd6f25e03a0fd56d3a310f6ae2833d5479ca',
    'supabase/functions/paypal-order/index.ts': '6517b28c23db8e1ae6c673d3430479248600f71e',
    'supabase/functions/referral-signup/index.ts': 'a99f2c42fe630b0c0ea216f75b015f7da23284f4',
    'supabase/functions/scrape-calendly/index.ts': 'f1223c85960df2fed997991a1467128281f691d9',
    'supabase/functions/send-reminder/index.ts': '5e2f481811ec62b0eee1b52482e2ff7335a6a7fe',
    'supabase/functions/stripe-checkout/index.ts': '8299580b086718a98fdb0887118bb737e6de6656',
    'supabase/functions/stripe-portal/index.ts': 'd293e79ab3ff90f2ff9a106e90109539c9c5a203',
    'supabase/functions/stripe-webhook/index.ts': '5eb5bc2335b498c1c8c317104f6c7350e0bf2ea0',
    'supabase/functions/test-critical-call/index.ts': '2c2a5b7130d95f265625bea7f2ded8a4f690d9f9',
    'supabase/functions/verify-caldav/index.ts': '6f6b413e6e4a277aa4d8ea5a008baefd495390ae',
    'supabase/functions/zoom-auth/index.ts': '721139e11230237b05ec0a6ed6431e89939c8014',
    'supabase/functions/zoom-callback/index.ts': '3832848c5c526ad436ab01dfa408aba6d9cd80b8',
    'tailwind.config.js': '8ed035c9fb6a4678aa3af492b07a0a1634fdf257',
    'vite.config.ts': '147380affffa48cce8a70ee052703fd1538ac76a',
    'index.html': 'd61e549ce88af24fa4cf014916d5d42a5716a476',
    'package.json': '459835051cf102c9b94e97611cf340cc2263f382',
}

missing_count = 0
differ_count = 0
match_count = 0

for path, github_sha in files.items():
    full = os.path.join(base, path)
    if not os.path.exists(full):
        print(f"MISSING: {path}")
        missing_count += 1
        continue
    with open(full, 'rb') as f:
        data = f.read()
    header = f"blob {len(data)}\0".encode()
    sha = hashlib.sha1(header + data).hexdigest()
    if sha != github_sha:
        print(f"DIFFERS: {path}")
        print(f"  local:  {sha}")
        print(f"  github: {github_sha}")
        differ_count += 1
    else:
        match_count += 1

print(f"\nSummary: {match_count} matched, {differ_count} differ, {missing_count} missing")
