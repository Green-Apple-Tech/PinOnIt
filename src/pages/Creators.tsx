import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePageMeta, SITE_OG } from '../lib/pageMeta';
import { CREATOR_TERMS_DRAFT, PROPOSED_CREATOR_SETTINGS } from '../lib/creatorProgram';

const PITCH = 'Teach small-business owners a simpler way to quote, book, invoice, and get documents signed by text. Apply to become a PinOnIt creator partner.';

export function CreatorsPage() {
  usePageMeta({
    title: 'Creator partners (draft) | PinOnIt',
    description: PITCH,
    url: 'https://pinonit.com/creators',
    image: SITE_OG.image,
    robots: 'noindex, nofollow',
  });
  const [form, setForm] = useState({
    name: '',
    email: '',
    profileUrl: '',
    topics: '',
    audience: '',
  });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage('');
    const { error } = await supabase.from('creator_applications').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      profile_url: form.profileUrl.trim(),
      topics: form.topics.trim(),
      audience: form.audience.trim(),
      status: 'pending',
    });
    setSending(false);
    if (error) {
      setMessage('The application could not be saved. The creator tables are not active yet.');
      return;
    }
    setMessage('Application received. Approval is manual. Applying does not grant access or a commission.');
    setForm({ name: '', email: '', profileUrl: '', topics: '', audience: '' });
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Draft — not a published offer</p>
        <h1 className="mt-2 text-3xl font-bold">Creator partners</h1>
        <p className="mt-4 text-lg leading-relaxed">{PITCH}</p>
        <p className="mt-3 text-sm text-slate-600">
          PinOnIt is the text-first office for a one-person shop or a team of a few people: quote a job, book a time, send an invoice, and get a document signed from a phone. Pro is $9.99/month after the trial. This page is for educators who teach that audience. It is separate from the $1 customer referral credit.
        </p>

        <form onSubmit={submit} className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Apply</h2>
          <label className="block text-sm">Name
            <input required value={form.name} onChange={set('name')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">Business email
            <input required type="email" value={form.email} onChange={set('email')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">Primary profile URL
            <input required type="url" value={form.profileUrl} onChange={set('profileUrl')} placeholder="https://" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">Main topics
            <input required value={form.topics} onChange={set('topics')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">Audience description
            <textarea required value={form.audience} onChange={set('audience')} rows={4} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <p className="text-xs text-slate-500">Submitting does not create complimentary access or make you eligible for a commission.</p>
          <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#5864C6' }}>
            {sending ? 'Sending…' : 'Submit application'}
          </button>
          {message && <p className="text-sm">{message}</p>}
        </form>

        <section className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="font-semibold">{CREATOR_TERMS_DRAFT.title}</h2>
          <p className="mt-1 text-sm font-medium text-amber-800">{CREATOR_TERMS_DRAFT.status}</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            {CREATOR_TERMS_DRAFT.paragraphs.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            Proposed and not activated: {PROPOSED_CREATOR_SETTINGS.proposedGrantDurationDays} days of complimentary access and {PROPOSED_CREATOR_SETTINGS.proposedOutboundMessageLimit} outbound messages, only after a separate grant. Heepsy stays your research list. PinOnIt does not connect to it.
          </p>
        </section>
        <p className="mt-6 text-sm text-slate-500">
          <Link to="/signup" className="underline">Customer signup</Link> still uses the $1 referral program. Creator links, after approval, use <span className="font-mono">?creator=</span>.
        </p>
      </div>
    </main>
  );
}
