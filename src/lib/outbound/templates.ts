// Texas repeat-buyer outreach templates — Rameel-approved copy (v3, 2026-10-01;
// source of truth: docs/outbound-templates-v1.md). The goal is to become one of
// the 3–5 sign companies a contractor, property manager, developer, or
// architect emails whenever signage comes up — not to sell a project.
//
// HARD RULE: these words are Rameel's. The system only fills {{first_name}},
// {{company}}, and {{local_line}}. Never let an LLM rewrite them, and never
// change copy here without his written approval.

export type Segment = "gc" | "property_manager" | "developer" | "architect";
export type Market = "houston" | "san_antonio" | "austin" | "dfw" | "texas";

export const SEGMENT_LABELS: Record<Segment, string> = {
  gc: "General contractor",
  property_manager: "Property manager",
  developer: "Developer",
  architect: "Architect / design firm",
};

// Approved claims (Rameel 2026-09-25: staff in San Antonio and Austin;
// 2026-10-01: include Dallas). Never claim offices or shops outside Houston.
export const LOCAL_LINES: Record<Market, string> = {
  houston: "We're a Houston shop.",
  san_antonio: "We're a Houston shop with people on the ground in San Antonio.",
  austin: "We're a Houston shop with people on the ground in Austin.",
  dfw: "We're a Houston shop and we take work all over Texas.",
  texas: "We're a Houston shop and we take work all over Texas.",
};

// Street address on every touch (Rameel 2026-10-01: "add the address").
const ADDRESS = "1359 E 40th St, Houston, TX 77022";
const SIG_FULL = `Ray\nHouston Sign Crafters\n(832) 974-2546\nhoustonsigncrafters.com\n${ADDRESS}`;
const SIG_SHORT = `Ray\nHouston Sign Crafters, ${ADDRESS}`;
const SIG_PHONE = `Ray\n(832) 974-2546\nHouston Sign Crafters, ${ADDRESS}`;

interface Touch {
  subject: string; // touch 1 only; follow-ups reply in-thread as "Re: <touch 1 subject>"
  body: string;
}

export const TEMPLATES: Record<Segment, [Touch, Touch, Touch]> = {
  gc: [
    {
      subject: "sign bids",
      body: `Hey {{first_name}},

Ray here from Houston Sign Crafters. {{local_line}}

Reaching out because we'd like to get on {{company}}'s bid list for signage.

We handle the drawings, permits, fabrication, and install ourselves. Channel letters, monument and pylon signs, cabinets, awnings, and the other random sign scopes that end up in commercial jobs.

If you have anything out for bid now, send it over. Otherwise, just keep this email and send us the next one.

${SIG_FULL}`,
    },
    {
      subject: "",
      body: `{{first_name}},

One other thing. If {{company}} has a subcontractor prequal or vendor packet, send it over and I'll get it filled out.

We can send over our W-9 and COI as well.

${SIG_SHORT}`,
    },
    {
      subject: "",
      body: `{{first_name}},

Last one from me.

If a sign scope comes across your desk and you need another number on it, send it here.

We'll bid it.

${SIG_PHONE}`,
    },
  ],
  property_manager: [
    {
      subject: "sign vendor",
      body: `Hey {{first_name}},

Ray here from Houston Sign Crafters. {{local_line}}

Wanted to put us on your radar as a sign vendor for {{company}}.

We handle repairs, tenant panels, storefront signs, monument and pylon signs, lighting, and new signage. We'll also work on signs we didn't originally build.

Basically, if something comes up at one of your properties, send me a photo and an address. We'll figure out what it needs.

${SIG_FULL}`,
    },
    {
      subject: "",
      body: `{{first_name}},

Bumping this once.

We do both the little annoying stuff like a tenant panel or dead LEDs and the bigger projects like replacing a monument or pylon.

So no need to figure out who handles what. Just send it over.

${SIG_SHORT}`,
    },
    {
      subject: "",
      body: `{{first_name}},

Last one from me.

Save my number for the next time someone at one of your properties says, "the sign is broken."

(832) 974-2546

${SIG_SHORT}`,
    },
  ],
  developer: [
    {
      subject: "sign vendor for {{company}}",
      body: `Hey {{first_name}},

Ray here from Houston Sign Crafters. {{local_line}}

Wanted to introduce ourselves and get on {{company}}'s radar for signage.

We handle the whole thing from drawings and permitting through fabrication and install. Monument and pylon signs, building signage, tenant signage, awnings, and the smaller stuff that comes after a property opens.

If you have something we can price now, send it over. Otherwise, keep us in mind for the next development.

${SIG_FULL}`,
    },
    {
      subject: "",
      body: `{{first_name}},

For context, we've built multi-tenant pylon and monument signage around Houston, including work at the At Home center and Kirkwood Tech Center.

Happy to send examples if useful.

Mostly just trying to make sure we're one of the companies {{company}} calls when signage comes up.

${SIG_SHORT}`,
    },
    {
      subject: "",
      body: `{{first_name}},

Last one.

If you ever need another sign company to price something, send it here.

${SIG_PHONE}`,
    },
  ],
  architect: [
    {
      subject: "commercial sign vendor",
      body: `Hey {{first_name}},

Ray here from Houston Sign Crafters. {{local_line}}

Wanted to introduce ourselves in case {{company}} ever needs a sign fabricator on a project.

We take what's on the drawings and handle the shop drawings, permitting, fabrication, and installation.

We're also happy to help earlier if you need a rough budget or want someone to look at a sign before the design is locked.

If signage comes up on a project, send it our way.

${SIG_FULL}`,
    },
    {
      subject: "",
      body: `{{first_name}},

One other reason to keep us around: we're happy to look at something before there's a full sign package.

Send an elevation or concept and we can usually help with rough pricing, fabrication questions, or permitting issues.

${SIG_SHORT}`,
    },
    {
      subject: "",
      body: `{{first_name}},

Last one from me.

If you need a sign fabricator to price something or gut check a design, send it over.

${SIG_PHONE}`,
    },
  ],
};

/** Strip corporate suffixes so "Gage Commercial Construction, LLC" reads naturally in a sentence. */
export function displayCompany(name: string): string {
  return name
    .replace(/,?\s+(inc\.?|llc\.?|l\.l\.c\.|ltd\.?|lp|llp|corp\.?|corporation|co\.)$/i, "")
    .trim();
}

export interface RenderInput {
  segment: Segment;
  step: 1 | 2 | 3;
  firstName: string;
  company: string;
  market: Market;
  /** Touch 1's subject as sent — follow-ups reply to it. */
  threadSubject?: string | null;
}

export function renderTouch(input: RenderInput): { subject: string; body: string } {
  const touch = TEMPLATES[input.segment][input.step - 1];
  const fill = (s: string) =>
    s
      .replaceAll("{{first_name}}", input.firstName.trim())
      .replaceAll("{{company}}", displayCompany(input.company))
      .replaceAll("{{local_line}}", LOCAL_LINES[input.market]);
  const firstSubject = fill(TEMPLATES[input.segment][0].subject);
  const subject =
    input.step === 1 ? firstSubject : `Re: ${input.threadSubject?.replace(/^re:\s*/i, "") || firstSubject}`;
  return { subject, body: fill(touch.body) };
}

// Business days between touches, counted from touch 1's send (docs table).
export const FOLLOWUP_OFFSETS_BUSINESS_DAYS: Record<2 | 3, number> = { 2: 3, 3: 7 };

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}
