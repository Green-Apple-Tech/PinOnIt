export type PageHelpGuide = {
  title: string;
  purpose: string;
  steps: string[];
};

function keyFromLocation(pathname: string, search: string, hash: string): string {
  const tab = new URLSearchParams(search).get('tab') || '';
  if (pathname === '/dashboard' && hash === '#share') return 'share';
  if (pathname === '/dashboard') return 'home';
  if (pathname.startsWith('/dashboard/reminders')) return 'reminders';
  if (pathname.startsWith('/dashboard/settings')) {
    if (tab === 'availability') return 'availability';
    if (tab === 'analytics') return 'analytics';
    if (tab === 'billing') return 'billing';
    if (tab === 'activity') return 'activity';
    return 'settings';
  }
  if (pathname.startsWith('/dashboard/appointments')) return 'calendar';
  if (pathname.startsWith('/dashboard/services')) return 'services';
  if (pathname.startsWith('/dashboard/quotes')) return 'quotes';
  if (pathname.startsWith('/dashboard/documents')) return 'documents';
  if (pathname.startsWith('/dashboard/paid-booking')) return 'paid-booking';
  if (pathname.startsWith('/dashboard/group-scheduling/polls')) return 'polls';
  if (pathname.includes('coordinate')) return 'coordinate';
  if (pathname.startsWith('/dashboard/group-scheduling')) return 'group';
  if (pathname.startsWith('/dashboard/contacts')) return 'contacts';
  if (pathname.startsWith('/dashboard/signature')) return 'signature';
  if (pathname.startsWith('/dashboard/qr')) return 'qr';
  if (pathname.startsWith('/dashboard/more-tools')) return 'more-tools';
  return 'home';
}

const GUIDES: Record<string, PageHelpGuide> = {
  home: {
    title: 'Dashboard',
    purpose: 'This is your home base. On a phone it shows today’s meetings. On a computer you share your booking link and manage meeting types.',
    steps: [
      'Set your booking URL in Settings if you have not already (pinonit.com/yourname).',
      'Tap Share my link (phone) or copy the link on this page and send it to a client.',
      'When they pick a time, the meeting shows here and on Calendar.',
      'Turn on Advanced mode in Settings → General if you want every tool in the sidebar.',
    ],
  },
  share: {
    title: 'Share your link',
    purpose: 'This is how clients book you. One link. They pick a time that is free on your calendar.',
    steps: [
      'Copy the link or send it by text / email / WhatsApp from this page.',
      'Check the boxes for which meeting types appear on the link.',
      'Test it yourself in a private browser window before you send it to clients.',
    ],
  },
  calendar: {
    title: 'Calendar',
    purpose: 'See every PinOnIt booking and busy times from connected calendars. Call, text, or reschedule from here.',
    steps: [
      'Connect Google, Outlook, or Apple in Availability so you do not double-book.',
      'Tap a meeting to see the client, location, and actions.',
      'If the calendar looks empty, share your booking link from the Dashboard.',
    ],
  },
  availability: {
    title: 'Availability',
    purpose: 'Tell PinOnIt when you are willing to take meetings. Guests only see those times, minus your calendar conflicts.',
    steps: [
      'Turn on the days you work and set start/end hours.',
      'Connect Google, Outlook, or Apple so existing events block those slots.',
      'Add an override for a vacation day or a one-off late evening.',
      'Set a buffer between meetings if you need drive time.',
    ],
  },
  reminders: {
    title: 'Smart Reminders',
    purpose: 'PinOnIt can text, email, WhatsApp, or call so people actually show up. Nothing sends until a reminder is turned on here.',
    steps: [
      'Add coworkers under Settings → Coworkers (name, email/phone, channels).',
      'On Calendar, click the bell on an event → Step 1: check who to copy → Save for this event.',
      'Turn on Booking Confirmation and 24h / 1h guest reminders below.',
      'Optional: Step 2 in the bell modal adds a one-off custom reminder for that event.',
    ],
  },
  services: {
    title: 'Event types',
    purpose: 'Each event type is a meeting people can book — length, place, price, and questions.',
    steps: [
      'Tap Create event type (or edit an existing one).',
      'Set the name, duration, and in-person / video / phone.',
      'Add a price if you want to get paid when they book.',
      'Save, then include it in your share link on the Dashboard.',
    ],
  },
  documents: {
    title: 'Documents',
    purpose: "Send NDAs, invoices, contracts, receipts, and liability waivers for phone confirmation. Built to hold up if it's ever challenged — verified signatures, timestamps, and identity confirmation.",
    steps: [
      'Tap New document and pick NDA, invoice, contract, receipt, or waiver.',
      'Add the recipient name, phone, and a short topic.',
      'They get a text with a link. They enter an SMS code, then sign, initial, or confirm.',
      'Copy the link from the list if you need to resend it another way.',
    ],
  },
  quotes: {
    title: 'Quote / Invoice',
    purpose: 'Send a quote, invoice, or cash receipt by email or text. Tax and line items can start from your industry presets — change them on any quote.',
    steps: [
      'Pick Quote, Invoice, or Receipt.',
      'Add the client name and email or phone.',
      'Fill in line items and tax %. The total updates as you type.',
      'Tap Send. They get a link they can open and pay if you added a pay link.',
    ],
  },
  'paid-booking': {
    title: 'Paid Booking',
    purpose: 'A price-list page clients can book from — share by link, email, SMS, or embed.',
    steps: [
      'See what it is: a short menu of your priced options.',
      'Customize your logo, colors, and which event types appear (set prices under Event types).',
      'Share the full page link, or a single-option booking link.',
    ],
  },
  group: {
    title: 'Group Scheduling',
    purpose: 'Find a time when several people are free — polls for people with email, or SMS coordinate for people who only have a phone.',
    steps: [
      'Create a poll if the group can click a link and vote on times.',
      'Use Coordinate if you only have phone numbers.',
      'When a time wins, confirm it so it lands on your calendar.',
    ],
  },
  polls: {
    title: 'Meeting poll',
    purpose: 'Offer a few time options. The group votes. You pick the winner.',
    steps: [
      'Add a title and 2+ time slots.',
      'Invite people. They vote on the public poll link.',
      'Confirm the winning slot when you are ready.',
    ],
  },
  coordinate: {
    title: 'Coordinate by SMS',
    purpose: 'Text people who do not have a calendar. PinOnIt collects when they are free and you confirm a time.',
    steps: [
      'Set the date range you are trying to fill.',
      'Add phone numbers and send the texts.',
      'Review replies, then confirm the meeting.',
    ],
  },
  contacts: {
    title: 'Contacts',
    purpose: 'Your people list. Guests who book you show up here. You can also import Gmail or Outlook.',
    steps: [
      'Tap Import from Gmail or Outlook, or add someone by hand.',
      'Share your booking link — new bookers appear automatically.',
      'Open a contact to see their past meetings.',
    ],
  },
  signature: {
    title: 'Email signature',
    purpose: 'A professional signature with your booking link so every email can get you a meeting.',
    steps: [
      'Fill in your name, title, and booking link.',
      'Copy the signature.',
      'Paste it into Gmail or Outlook signature settings.',
    ],
  },
  qr: {
    title: 'QR Code',
    purpose: 'A code people can scan to open your booking page — cards, trucks, shop windows.',
    steps: [
      'Make sure your booking URL is set.',
      'Download or print the QR code.',
      'Test it with your phone camera before you print a batch.',
    ],
  },
  analytics: {
    title: 'Analytics',
    purpose: 'A simple picture of how many meetings you are booking. After 10 meetings it also appears in the sidebar.',
    steps: [
      'Share your link so bookings start coming in.',
      'Use the 7 / 30 / 90 day buttons to change the range.',
      'If this page is empty, you do not have bookings in that range yet.',
    ],
  },
  billing: {
    title: 'Billing',
    purpose: 'Manage your Pro subscription. Every account starts with a 14-day trial; subscribe before it ends to keep booking and reminders running.',
    steps: [
      'Expired accounts are read-only until you reactivate — your data stays.',
      'Calendly switchers: 60 days with a card on file ($0 today).',
      'Cancel anytime before a paid period renews if you do not want to be charged.',
    ],
  },
  settings: {
    title: 'Settings',
    purpose: 'Your account, booking URL, advanced mode, and other preferences.',
    steps: [
      'General → set your name and booking username.',
      'Turn on Advanced mode if you want every tool in the sidebar.',
      'Settings → General → Advanced to block an email or domain from booking, or mark it as spam.',
      'Use the tabs for Availability, Billing, and Analytics.',
    ],
  },
  activity: {
    title: 'Activity',
    purpose: 'A log of messages PinOnIt sent — reminders, quotes, and similar.',
    steps: [
      'Scroll to see what went out and whether it failed.',
      'If something failed, check the phone/email on the contact and try again.',
    ],
  },
  'more-tools': {
    title: 'More Tools',
    purpose: 'Every extra PinOnIt tool in one place. In simple mode these stay tucked away until you need them.',
    steps: [
      'Open any card to use that tool.',
      'Paid booking, quotes, and the rest stay here so the main menu stays simple.',
      'Turn on Advanced mode in Settings if you want every tool listed in the sidebar.',
    ],
  },
};

export function getPageHelp(pathname: string, search = '', hash = ''): PageHelpGuide {
  return GUIDES[keyFromLocation(pathname, search, hash)] ?? GUIDES.home;
}
