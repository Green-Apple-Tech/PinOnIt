import { usePageMeta } from '../lib/pageMeta';

type Shot = { src: string; alt: string; caption: string };
type ShotGroup = { id: string; title: string; shots: Shot[] };

const GROUPS: ShotGroup[] = [
  {
    id: 'sign',
    title: 'Sign by text',
    shots: [
      { src: '/shots/sign-sms.png', alt: 'Text message with a waiver link', caption: 'The text a guest gets, with the link to review.' },
      { src: '/shots/sign-waiver.png', alt: 'Waiver on a phone with a short summary', caption: 'The waiver on the phone, with a short summary above the full text.' },
      { src: '/shots/sign-verify.png', alt: 'Six-digit phone verification code', caption: 'They confirm the phone number on the document.' },
      { src: '/shots/sign-submit.png', alt: 'Drawn signature and sign button', caption: 'Signature, consent, and Sign & submit.' },
      { src: '/shots/sign-confirmed.png', alt: 'Waiver confirmed screen', caption: 'Confirmed after they sign.' },
    ],
  },
  {
    id: 'docs',
    title: 'Send docs',
    shots: [
      { src: '/shots/send-docs.png', alt: 'Send docs screen with document counts', caption: 'Quotes, waivers, invoices, and how many are sent, pending, viewed, or confirmed.' },
    ],
  },
  {
    id: 'reminders',
    title: 'NeverMiss reminders',
    shots: [
      { src: '/shots/reminders.png', alt: 'Reminder channel options on a phone', caption: 'Exact time, 15 minutes, and 30 minutes, with email, text, WhatsApp, and voice.' },
      { src: '/shots/reminder-add.png', alt: 'Speak or type a reminder', caption: 'Add a reminder by speaking it or typing it.' },
    ],
  },
  {
    id: 'booking',
    title: 'Booking and prices',
    shots: [
      { src: '/shots/price-list.png', alt: 'Price list a client can book from', caption: 'A price list on the phone, with Book and Edit on each option.' },
    ],
  },
  {
    id: 'signature',
    title: 'Email signature',
    shots: [
      { src: '/shots/email-signature.png', alt: 'Email signature editor on a phone', caption: 'The signature editor, with copy and download.' },
    ],
  },
  {
    id: 'qr',
    title: 'QR code',
    shots: [
      { src: '/shots/qr-code.png', alt: 'QR code creator on a phone', caption: 'Turn a link into a QR code.' },
    ],
  },
  {
    id: 'home',
    title: 'Home',
    shots: [
      { src: '/shots/home-tools.png', alt: 'Home screen with the main tools', caption: 'Send docs, calendar, booking, and NeverMiss from the home screen.' },
    ],
  },
  {
    id: 'compare',
    title: 'Calendly comparison',
    shots: [
      { src: '/shots/calendly.png', alt: 'What Calendly does not include', caption: 'WhatsApp, voice, and personal reminders, shown on a phone.' },
    ],
  },
];

/** Unlisted phone-screenshot library. Not linked from the app. */
export function PhoneShotsPage() {
  usePageMeta({
    title: 'Phone shots',
    description: 'Phone screenshots of PinOnIt tools.',
    url: 'https://pinonit.com/shots/phone',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PinOnIt</p>
          <h1 className="mt-1 text-2xl font-bold">Phone shots</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Screenshots of the main tools on a phone. This page is not linked from the site.
          </p>
          <nav className="mt-4 flex flex-wrap gap-2">
            {GROUPS.map((group) => (
              <a
                key={group.id}
                href={`#${group.id}`}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                {group.title}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {GROUPS.map((group) => (
          <section key={group.id} id={group.id}>
            <h2 className="text-lg font-bold">{group.title}</h2>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {group.shots.map((shot) => (
                <figure key={shot.src} className="shrink-0 w-[220px] sm:w-[260px]">
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    width={260}
                    height={520}
                    loading="lazy"
                    className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                  />
                  <figcaption className="mt-2 text-xs text-slate-500 leading-snug">{shot.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
