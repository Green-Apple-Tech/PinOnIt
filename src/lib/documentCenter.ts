import { INTENT_OG_IMAGE } from './seoPaths';
import { PINONIT_PRICE_MONTHLY, intentCanonical } from './seoIdentity';

export type DocumentCenterField = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

export type DocumentCenterFaq = { q: string; a: string };

export type DocumentCenterTemplate = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  city: string;
  state: string;
  trade: string;
  documentType: string;
  summary: string;
  fields: DocumentCenterField[];
  body: string;
  howTo: string[];
  faq: DocumentCenterFaq[];
};

export const DOCUMENT_CENTER_CTA =
  'Fill & send for signature by text — free PinOnIt account';

export const DOCUMENT_CENTER_DISCLAIMER =
  'This template is a starting point, not legal advice and not a substitute for a lawyer. Rules can change by Florida city, county, license type, and the kind of work. Have an attorney review anything you use with customers.';

export const DOCUMENT_CENTER_INDEX = {
  path: '/templates',
  title: 'Document Center — Miami and Florida trade templates | PinOnIt',
  description:
    'Free Miami and Florida service agreement and estimate templates. Fill one in and send it for signature by text with a free PinOnIt account.',
  h1: 'Document Center',
  eyebrow: 'Miami & Florida templates',
  intro:
    'Start with a city- and trade-specific template, fill in your details, and send it for e-signature by text. Viewing and filling a template is free. Sending for signature and the customer signing it requires a free PinOnIt account. PinOnIt Pro is $9.99/month after a 14-day trial.',
  canonical: intentCanonical('/templates'),
  ogImage: INTENT_OG_IMAGE,
};

export const DOCUMENT_CENTER_HOWTO = [
  'Fill in your business, customer, job, and price details on this page. Leave a blank if you will finish it after you create an account.',
  'Click “Fill & send for signature by text — free PinOnIt account” and create your free PinOnIt account. The customer does not need an account.',
  'Send the document as a text. They open the SMS link, enter a one-time code, and sign with a finger.',
  `PinOnIt stores an audit record. Pro is ${PINONIT_PRICE_MONTHLY} after a 14-day trial.`,
];

export const DOCUMENT_CENTER_INDEX_FAQ: DocumentCenterFaq[] = [
  {
    q: 'Are these templates legal advice?',
    a: 'No. They are starting language only. PinOnIt does not provide legal advice. Have an attorney review a template before you use it with customers.',
  },
  {
    q: 'Do I need a PinOnIt account to read or fill a template?',
    a: 'No. You can read and fill a template on this site for free. Sending it for signature by text, and having the other person sign, requires a free PinOnIt account.',
  },
  {
    q: 'Does my customer need an account to sign?',
    a: 'No. They get a normal text, open the link on their phone, enter a one-time code, and sign with a finger. They do not install an app.',
  },
  {
    q: 'What does PinOnIt cost?',
    a: `PinOnIt Pro is ${PINONIT_PRICE_MONTHLY} after a 14-day trial. One plan.`,
  },
  {
    q: 'Can I use my own PDF instead?',
    a: 'Yes. After you have an account you can upload a PDF your attorney already reviewed and send that same file by text. Waiver starting points are also listed on the waiver templates page.',
  },
];

const COMMON_FIELDS: DocumentCenterField[] = [
  { key: 'businessName', label: 'Business name', placeholder: 'Your business name' },
  { key: 'licenseNumber', label: 'Florida license or registration number', placeholder: 'License or registration no., if you have one' },
  { key: 'businessPhone', label: 'Business phone', placeholder: '(305) 555-0100' },
  { key: 'businessEmail', label: 'Business email', placeholder: 'you@example.com' },
  { key: 'businessAddress', label: 'Business address', placeholder: 'Street, Miami, FL' },
  { key: 'customerName', label: 'Customer name', placeholder: 'Customer full name' },
  { key: 'customerPhone', label: 'Customer phone', placeholder: '(305) 555-0199' },
  { key: 'jobAddress', label: 'Job address', placeholder: 'Street, Miami, FL' },
  { key: 'startDate', label: 'Start or service date', placeholder: 'Start date' },
  { key: 'price', label: 'Price or amount due', placeholder: '$0.00' },
  { key: 'deposit', label: 'Deposit (if any)', placeholder: '$0.00 or none' },
];

function fields(extra: DocumentCenterField[] = []): DocumentCenterField[] {
  const keys = new Set(extra.map((f) => f.key));
  return [...COMMON_FIELDS, ...extra.filter((f) => !COMMON_FIELDS.some((c) => c.key === f.key) || keys.has(f.key))].filter(
    (field, index, all) => all.findIndex((f) => f.key === field.key) === index,
  );
}

export const DOCUMENT_CENTER_TEMPLATES: DocumentCenterTemplate[] = [
  {
    slug: 'miami-fl-handyman-service-agreement',
    path: '/templates/miami-fl-handyman-service-agreement',
    title: 'Miami FL handyman service agreement',
    metaTitle: 'Miami FL Handyman Service Agreement Template | PinOnIt',
    metaDescription:
      'Free Miami, Florida handyman service agreement starting template. Fill it in and send it for signature by text with a free PinOnIt account. Not legal advice.',
    h1: 'Miami FL handyman service agreement',
    eyebrow: 'Miami, Florida',
    city: 'Miami',
    state: 'Florida',
    trade: 'Handyman',
    documentType: 'Service agreement',
    summary:
      'A short agreement for small home repairs and punch-list work in Miami: scope, access, materials, payment, and what is not included.',
    fields: fields([
      {
        key: 'scope',
        label: 'Work included',
        placeholder: 'e.g. hang TV, patch drywall in guest bath, replace two door hinges',
        multiline: true,
      },
      {
        key: 'excluded',
        label: 'Work not included',
        placeholder: 'e.g. electrical panel work, permit drawings, roof repairs',
        multiline: true,
      },
    ]),
    body: `MIAMI, FLORIDA HANDYMAN SERVICE AGREEMENT

This is a starting template, not legal advice.

Date: {{startDate}}

Provider (“Handyman”)
Business name: {{businessName}}
Florida license or registration number (if any): {{licenseNumber}}
Address: {{businessAddress}}
Phone: {{businessPhone}}
Email: {{businessEmail}}

Customer
Name: {{customerName}}
Phone: {{customerPhone}}
Job address (Miami-Dade / Miami, Florida): {{jobAddress}}

1. Scope of work
The Handyman will perform the following work at the job address:
{{scope}}

The following is not included unless the parties agree in a written change:
{{excluded}}

This agreement is for the work described above. It does not cover licensed trades the Handyman is not authorized to perform, such as work that requires a licensed electrician, plumber, HVAC contractor, or roofer, unless the Handyman holds that license and the work is listed in the scope.

2. Access and the job site
The Customer will provide reasonable access to the work area, including parking or building entry if the property is a condo or HOA community, and will tell the Handyman about pets, alarms, and any building rules that apply to the visit. The Customer confirms they have authority to approve work at the job address.

3. Materials and unexpected conditions
The price below includes materials only if they are listed in the scope or a written change. If hidden damage, unsafe conditions, or missing parts are found after work starts, the Handyman will pause and agree on a change with the Customer before adding cost or time.

4. Permits and local rules
Some Miami and Miami-Dade jobs need a permit or a licensed contractor. The Customer and Handyman will confirm, before work begins, who is responsible for checking permit needs and pulling any required permit. This template does not decide whether a permit is required.

5. Price and payment
Total price: {{price}}
Deposit due before work begins (if any): {{deposit}}
The remaining balance is due when the listed work is completed, unless the parties write a different schedule. The Handyman may pause work if a scheduled payment is late.

6. Changes
Any change to scope, price, or timing should be written (including a text) and agreed before the extra work is done.

7. Cleanup and completion
The Handyman will make a reasonable effort to leave the work area swept and to haul away debris from this job, unless the scope says otherwise.

8. Cancellation
If the Customer cancels after materials have been purchased for this job, the Customer is responsible for those unreturnable materials, plus work already performed.

9. Signatures
By signing, each person says they have read this agreement, had a chance to ask questions, and agree to these terms. Electronic signatures sent by text are intended to have the same effect as handwritten signatures.

Handyman: ______________________________    Date: __________

Customer: ______________________________    Date: __________
`,
    howTo: DOCUMENT_CENTER_HOWTO,
    faq: [
      {
        q: 'Can a Miami handyman use this for any job?',
        a: 'Use it only as a starting point for the small repair work you actually offer. If the job needs a permit or a licensed trade you do not hold, this template is not enough. Ask a Florida attorney and check City of Miami or Miami-Dade rules for that job.',
      },
      {
        q: 'Do I have to put a license number on the agreement?',
        a: 'If you have a Florida license or registration that applies to the work, include that number. If you are not sure what you must display, ask your attorney or the licensing board — this page does not decide that for you.',
      },
      {
        q: 'How do I send this for signature by text?',
        a: 'Fill the fields, create a free PinOnIt account, and send the document as an SMS link. Your customer opens the text, enters a one-time code, and signs with a finger. They do not need a PinOnIt account.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. PinOnIt does not provide legal advice. Have an attorney review the language before you use it with customers.',
      },
    ],
  },
  {
    slug: 'florida-contractor-estimate-invoice',
    path: '/templates/florida-contractor-estimate-invoice',
    title: 'Florida contractor estimate / invoice',
    metaTitle: 'Florida Contractor Estimate and Invoice Template | PinOnIt',
    metaDescription:
      'Free Florida contractor estimate and invoice starting template. Fill line items and send for approval or signature by text with a free PinOnIt account. Not legal advice.',
    h1: 'Florida contractor estimate / invoice',
    eyebrow: 'Florida',
    city: 'Statewide',
    state: 'Florida',
    trade: 'General contractor',
    documentType: 'Estimate / invoice',
    summary:
      'A Florida contractor estimate that can be reused as an invoice: license line, line items, deposit, and a place for the customer to approve the price.',
    fields: fields([
      { key: 'documentNumber', label: 'Estimate or invoice number', placeholder: 'EST-104 or INV-104' },
      { key: 'documentRole', label: 'This document is a', placeholder: 'Estimate or Invoice' },
      { key: 'validUntil', label: 'Estimate good through (if estimate)', placeholder: 'Good through date' },
      {
        key: 'lineItems',
        label: 'Line items',
        placeholder: 'e.g. Kitchen backsplash labor — $1,200\nTile and thinset — $480\nHaul-away — $75',
        multiline: true,
      },
      { key: 'tax', label: 'Sales tax (if any)', placeholder: '$0.00 or not collected on this job' },
      { key: 'balanceDue', label: 'Balance due', placeholder: '$0.00' },
      { key: 'paymentTerms', label: 'Payment terms', placeholder: 'e.g. deposit now, balance on completion', multiline: true },
    ]),
    body: `FLORIDA CONTRACTOR ESTIMATE / INVOICE

This is a starting template, not legal advice.

Document type: {{documentRole}}
Document number: {{documentNumber}}
Date: {{startDate}}
Estimate good through (if this is an estimate): {{validUntil}}

Contractor
Business name: {{businessName}}
Florida contractor license or registration number: {{licenseNumber}}
Address: {{businessAddress}}
Phone: {{businessPhone}}
Email: {{businessEmail}}

Customer
Name: {{customerName}}
Phone: {{customerPhone}}
Job address (Florida): {{jobAddress}}

1. Description of work and line items
{{lineItems}}

2. Amounts
Subtotal / contract price: {{price}}
Sales tax (if any): {{tax}}
Deposit: {{deposit}}
Balance due: {{balanceDue}}

3. Payment terms
{{paymentTerms}}

If this document is an estimate, the prices are good through the date above unless a line item says it is an allowance or is subject to a change after a site condition is confirmed. If this document is an invoice, the balance is due on the payment terms above.

4. What is not included
Unless a line item lists it, this document does not include permit fees, engineering, after-hours work, hidden damage, or changes requested after approval. Those items can be added in a written change order.

5. Approval and changes
If this is an estimate, the Customer approves the described work and price by signing or approving this document. Work that is not listed should not start until both sides agree in writing (including a text). Approved changes may adjust the price and schedule.

6. License and local requirements
The Contractor will include the Florida license or registration number that applies to this work. Permit responsibility should be stated in a line item or a separate written note before work begins. This template does not decide whether a permit or a particular license is required for the job.

7. Signatures
By signing or approving, the Customer acknowledges the amounts and the work described. Electronic signatures or approvals sent by text are intended to have the same effect as a handwritten signature or approval.

Contractor: ______________________________    Date: __________

Customer: ______________________________    Date: __________
`,
    howTo: DOCUMENT_CENTER_HOWTO,
    faq: [
      {
        q: 'Can I use the same form as an estimate and later as an invoice?',
        a: 'Yes. Fill “This document is a” with Estimate or Invoice, and use a document number you can reuse (for example EST-104, then INV-104). Update the amounts and payment terms when you convert it.',
      },
      {
        q: 'Should Florida contractors put a license number on estimates?',
        a: 'Licensed contractors in Florida often must show a license number on advertising and contracts. Put yours in the license field. Ask your attorney or the licensing board if you are unsure what applies to you.',
      },
      {
        q: 'How do I get this approved or signed by text?',
        a: 'Fill the line items, create a free PinOnIt account, and send the document as a text. The customer opens the SMS link, enters a one-time code, and approves or signs on their phone.',
      },
      {
        q: 'Is this legal advice or an official Florida form?',
        a: 'No. It is starting language only. PinOnIt does not provide legal advice and this is not a government form.',
      },
    ],
  },
  {
    slug: 'miami-lawn-care-service-agreement',
    path: '/templates/miami-lawn-care-service-agreement',
    title: 'Miami lawn care service agreement',
    metaTitle: 'Miami Lawn Care Service Agreement Template | PinOnIt',
    metaDescription:
      'Free Miami lawn care service agreement starting template for weekly or seasonal yard work. Fill it and send for signature by text. Not legal advice.',
    h1: 'Miami lawn care service agreement',
    eyebrow: 'Miami, Florida',
    city: 'Miami',
    state: 'Florida',
    trade: 'Lawn care',
    documentType: 'Service agreement',
    summary:
      'A recurring Miami lawn-care agreement covering mowing, weather and storm skips, chemicals, access, and how billing works.',
    fields: fields([
      { key: 'frequency', label: 'Service frequency', placeholder: 'e.g. weekly, every 10 days, twice a month' },
      {
        key: 'scope',
        label: 'Services included',
        placeholder: 'e.g. mow, edge, blow walkways, trim hedges along the front walk',
        multiline: true,
      },
      {
        key: 'excluded',
        label: 'Services not included',
        placeholder: 'e.g. tree removal, irrigation repairs, sod installation',
        multiline: true,
      },
      { key: 'billingDay', label: 'Billing schedule', placeholder: 'e.g. billed monthly on the 1st' },
    ]),
    body: `MIAMI, FLORIDA LAWN CARE SERVICE AGREEMENT

This is a starting template, not legal advice.

Start date: {{startDate}}

Provider
Business name: {{businessName}}
Florida license or registration number (if any): {{licenseNumber}}
Address: {{businessAddress}}
Phone: {{businessPhone}}
Email: {{businessEmail}}

Customer
Name: {{customerName}}
Phone: {{customerPhone}}
Service address (Miami / Miami-Dade, Florida): {{jobAddress}}

1. Services and schedule
Service frequency: {{frequency}}
Included services:
{{scope}}

Not included unless added in writing:
{{excluded}}

Visit days can shift for weather, holidays, or route changes. The Provider will use a reasonable effort to keep the stated frequency during the growing season.

2. Weather, flooding, and storms
South Florida rain, heat, and storm debris can change a visit. The Provider may skip or delay a visit when the yard is too wet, unsafe, or blocked by storm debris. A skipped visit is not automatically a credit unless the parties agree in writing. After a named storm, debris cleanup, downed limbs, or fence work are extra unless they are listed in the scope.

3. Plants, irrigation, and chemicals
The Customer will tell the Provider about irrigation schedules, newly sodded areas, and any chemical or pet sensitivities before work starts. If fertilizers, herbicides, or pest products are part of the scope, the Provider will follow the label and any applicable Florida or local rules for those products. This template does not take the place of any required notices.

4. Access and HOA or condo rules
The Customer will provide gate codes, parking instructions, and any HOA or building rules that apply to landscape vendors. The Customer confirms they have authority to approve service at this address and that pets will be secured during visits.

5. Price and billing
Price: {{price}}
Deposit (if any): {{deposit}}
Billing schedule: {{billingDay}}

Prices are for the included services only. Extra work — for example, storm debris, sod, or irrigation repair — needs a written okay (including a text) before it is done.

6. Term and cancellation
This agreement starts on the start date and continues until either party cancels. Either party may cancel by giving written notice (including a text or email). Amounts already owed for visits completed remain due.

7. Signatures
By signing, each person agrees to these terms. Electronic signatures sent by text are intended to have the same effect as handwritten signatures.

Provider: ______________________________    Date: __________

Customer: ______________________________    Date: __________
`,
    howTo: DOCUMENT_CENTER_HOWTO,
    faq: [
      {
        q: 'Does this cover storm cleanup after a hurricane?',
        a: 'Only if you list that work in the scope. The starting language treats named-storm debris and downed limbs as extra work unless you write them in. Adjust the language with your attorney if you offer a storm package.',
      },
      {
        q: 'Can I use this for a one-time cleanup instead of a weekly route?',
        a: 'Yes. Set the frequency to one-time, describe the cleanup in the services box, and set the price for that visit.',
      },
      {
        q: 'How does the customer sign by text?',
        a: 'Create a free PinOnIt account and send the filled agreement as an SMS link. They open the text, enter a one-time code, and sign with a finger. They do not need an account.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. It is a starting template only. PinOnIt does not provide legal advice.',
      },
    ],
  },
  {
    slug: 'miami-house-cleaning-service-agreement',
    path: '/templates/miami-house-cleaning-service-agreement',
    title: 'Miami house cleaning service agreement',
    metaTitle: 'Miami House Cleaning Service Agreement Template | PinOnIt',
    metaDescription:
      'Free Miami house cleaning service agreement starting template for recurring or move-out cleans. Fill it and send for signature by text. Not legal advice.',
    h1: 'Miami house cleaning service agreement',
    eyebrow: 'Miami, Florida',
    city: 'Miami',
    state: 'Florida',
    trade: 'House cleaning',
    documentType: 'Service agreement',
    summary:
      'A Miami house-cleaning agreement for recurring or move-out jobs, including rooms included, supplies, access, and cancellation.',
    fields: fields([
      { key: 'frequency', label: 'Service frequency', placeholder: 'e.g. weekly, biweekly, one-time move-out' },
      {
        key: 'scope',
        label: 'Rooms and tasks included',
        placeholder: 'e.g. 3/2 condo: bathrooms, kitchen, floors, dusting; no oven this visit',
        multiline: true,
      },
      {
        key: 'excluded',
        label: 'Tasks not included',
        placeholder: 'e.g. windows, walls, interior oven, hoarding cleanup',
        multiline: true,
      },
      { key: 'supplies', label: 'Who provides supplies', placeholder: 'e.g. cleaner brings standard supplies' },
      { key: 'accessNotes', label: 'Access notes', placeholder: 'e.g. lockbox code, condo visitor parking', multiline: true },
    ]),
    body: `MIAMI, FLORIDA HOUSE CLEANING SERVICE AGREEMENT

This is a starting template, not legal advice.

Start or first visit date: {{startDate}}

Provider
Business name: {{businessName}}
Florida license or registration number (if any): {{licenseNumber}}
Address: {{businessAddress}}
Phone: {{businessPhone}}
Email: {{businessEmail}}

Customer
Name: {{customerName}}
Phone: {{customerPhone}}
Service address (Miami / Miami-Dade, Florida): {{jobAddress}}

1. Services
Service frequency: {{frequency}}
Rooms and tasks included:
{{scope}}

Not included unless added in writing:
{{excluded}}

A “standard clean” means the listed rooms and tasks only. A move-out, post-construction, or deep clean should be described in the scope and priced separately if it is more than a standard visit.

2. Supplies and special instructions
Who provides supplies: {{supplies}}
The Customer will tell the Provider about surface sensitivities, pets, children, alarms, and any product the Customer does not want used. The Provider will not move large furniture or climb higher than a standard step stool unless the scope says so.

3. Access, parking, and building rules
Access notes: {{accessNotes}}
The Customer will provide keys, codes, or a lockbox and any condo, rental, or HOA rules that apply to cleaning vendors, including parking and elevator reservations. The Customer confirms they have authority to allow entry.

4. Price and payment
Price: {{price}}
Deposit (if any): {{deposit}}
Payment is due on the terms the parties write here or in a later invoice. Extra time caused by a much messier space than described, or extra rooms, may be billed only after the Provider tells the Customer and the Customer agrees (including by text).

5. Cancellation and no-access visits
Please give at least 24 hours’ notice to cancel or move a visit. If the Provider arrives and cannot enter, or pets are not secured, the Provider may charge for the reserved visit. Either party may end a recurring plan by written notice (including a text or email). Amounts for completed visits remain due.

6. Breakage and valuables
The Customer should put away fragile or high-value items before a visit. The Provider will take reasonable care. Claims about damage should be reported promptly so both sides can review them. This paragraph is not an insurance policy.

7. Signatures
By signing, each person agrees to these terms. Electronic signatures sent by text are intended to have the same effect as handwritten signatures.

Provider: ______________________________    Date: __________

Customer: ______________________________    Date: __________
`,
    howTo: DOCUMENT_CENTER_HOWTO,
    faq: [
      {
        q: 'Can I use this for Airbnb or short-term rental turnovers in Miami?',
        a: 'You can start with it, but describe the turnover checklist, laundry, restocking, and timing in the rooms-and-tasks box. Building or rental-program rules still apply. Have an attorney review language you use for rental clients.',
      },
      {
        q: 'What if the condo needs a certificate of insurance?',
        a: 'Many Miami buildings ask vendors for insurance certificates. This template does not replace insurance. Bring whatever your building or client requires, and ask your insurance agent or attorney if you are unsure.',
      },
      {
        q: 'How do I send this for signature by text?',
        a: 'Fill the fields, create a free PinOnIt account, and text the document to your customer. They open the link, enter a one-time code, and sign. They do not need an account.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. PinOnIt does not provide legal advice. This is starting language only.',
      },
    ],
  },
  {
    slug: 'florida-painting-contractor-agreement',
    path: '/templates/florida-painting-contractor-agreement',
    title: 'Florida painting contractor agreement',
    metaTitle: 'Florida Painting Contractor Agreement Template | PinOnIt',
    metaDescription:
      'Free Florida painting contractor service agreement starting template. Cover prep, paint, weather delays, and payment, then send for signature by text. Not legal advice.',
    h1: 'Florida painting contractor agreement',
    eyebrow: 'Florida',
    city: 'Statewide',
    state: 'Florida',
    trade: 'Painting',
    documentType: 'Service agreement',
    summary:
      'A Florida interior or exterior painting agreement covering surfaces, prep, colors, South Florida weather delays, and payment.',
    fields: fields([
      { key: 'scope', label: 'Surfaces and rooms to paint', placeholder: 'e.g. exterior stucco and fascia, or living room and hallway ceilings and walls', multiline: true },
      { key: 'prep', label: 'Prep included', placeholder: 'e.g. scrape loose paint, caulk gaps, one coat primer on bare areas', multiline: true },
      { key: 'products', label: 'Paint and products', placeholder: 'e.g. customer-chosen brand, two coats, color TBA' },
      { key: 'excluded', label: 'Not included', placeholder: 'e.g. rot repair, pressure washing roof, wallpaper removal', multiline: true },
      { key: 'endDate', label: 'Estimated completion', placeholder: 'Estimated end date' },
    ]),
    body: `FLORIDA PAINTING CONTRACTOR AGREEMENT

This is a starting template, not legal advice.

Date: {{startDate}}
Estimated completion: {{endDate}}

Painter (“Contractor”)
Business name: {{businessName}}
Florida license or registration number (if any): {{licenseNumber}}
Address: {{businessAddress}}
Phone: {{businessPhone}}
Email: {{businessEmail}}

Customer
Name: {{customerName}}
Phone: {{customerPhone}}
Job address (Florida): {{jobAddress}}

1. Scope
Surfaces and rooms to be painted:
{{scope}}

Prep included:
{{prep}}

Paint and products:
{{products}}

Not included unless added in a written change:
{{excluded}}

Color, sheen, and product choices should be confirmed in writing before paint is purchased or applied. A sample or small test area is a good way to confirm color on site.

2. Site conditions and older paint
The Customer will tell the Contractor about known leaks, soft wood, or earlier moisture problems. If rotten wood, active leaks, or unsafe surfaces are found, the Contractor will pause and agree on a change before going further. For homes or surfaces that may have older paint, the Contractor and Customer should follow any applicable lead-safe or other work practices. This template does not decide which rules apply and is not a lead disclosure form.

3. Weather and schedule (especially exterior work)
South Florida heat, rain, wind, and salt air can delay exterior work. The estimated completion date may move when weather, access, or drying times require it. The Contractor will use a reasonable effort to keep the Customer updated.

4. Access and protection
The Customer will provide reasonable access, parking, and a water or power source if needed. The Contractor will use reasonable care to protect floors, plants, and furnishings in the work area. The Customer should move small or fragile items before work starts when possible.

5. Price and payment
Total price: {{price}}
Deposit (if any): {{deposit}}
The remaining balance is due when the listed work is completed, unless the parties write a different schedule. Unused product that the Customer paid for stays with the Customer.

6. Changes and punch list
Changes to colors, added rooms, or extra prep should be written and priced before that work starts. After completion, the Customer should walk the job with the Contractor and list punch-list items in writing. The Contractor will reasonably correct work that does not match the agreed scope.

7. Signatures
By signing, each person agrees to these terms. Electronic signatures sent by text are intended to have the same effect as handwritten signatures.

Contractor: ______________________________    Date: __________

Customer: ______________________________    Date: __________
`,
    howTo: DOCUMENT_CENTER_HOWTO,
    faq: [
      {
        q: 'Does this work for both interior and exterior jobs in Florida?',
        a: 'Yes, if you describe the surfaces clearly. The weather section matters most for exterior work. Add or remove details with your attorney so they match the job you actually sell.',
      },
      {
        q: 'What about lead paint in older Florida homes?',
        a: 'This template is not a lead disclosure or a lead-safe work plan. If a home or surface may have older paint, follow the rules that apply to that job and use the forms your attorney or regulator requires.',
      },
      {
        q: 'How do I send this for signature by text?',
        a: 'Fill the fields, create a free PinOnIt account, and send the agreement as an SMS link. The customer enters a one-time code and signs on their phone. They do not need an account.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. PinOnIt does not provide legal advice. Have an attorney review this language before you use it with customers.',
      },
    ],
  },
];

export function getDocumentCenterTemplate(slug: string) {
  return DOCUMENT_CENTER_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function documentCenterSignupHref(slug?: string) {
  const params = new URLSearchParams({
    utm_source: 'document-center',
    utm_medium: 'templates',
    utm_campaign: 'document-center',
  });
  if (slug) params.set('utm_content', slug);
  return `/signup?${params.toString()}`;
}

/** Replace {{field}} tokens. Unknown tokens and empty values stay visible as a blank line cue. */
export function fillTemplateBody(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key]?.trim();
    return value ? value : '__________';
  });
}

export function documentCenterRelated(slug: string) {
  return DOCUMENT_CENTER_TEMPLATES.filter((t) => t.slug !== slug).map((t) => ({
    path: t.path,
    label: t.title,
  }));
}

export function documentCenterCanonical(path: string) {
  return intentCanonical(path);
}

export const DOCUMENT_CENTER_PATHS = [
  DOCUMENT_CENTER_INDEX.path,
  ...DOCUMENT_CENTER_TEMPLATES.map((t) => t.path),
] as const;
