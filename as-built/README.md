# AS BUILT: real estate website template

Designed and built by MAFSAN. A static, clickable preview of a premium Dubai brokerage website, built for client presentation.
The default deploy is the neutral "MAFSAN Realty" showcase; client versions come from one config file.

## Make a client version (five minutes)

1. Open `assets/js/brands.js`, copy the `'luxe-haven'` block, give it a new key (for example `'acme'`) and change the values: name, short name, logo suffix, wordmark, phone, WhatsApp digits, email, website, socials, office unit and tower, maps query, reception photo.
2. Send the link with the key: `https://luxe-new-demo.vercel.app/?client=acme`. The choice is remembered on that browser, so every page shows the client's name; `?client=default` goes back to the neutral showcase.
3. For a deploy that should always show one client, set `window.MF_DEFAULT_CLIENT = 'acme'` at the top of `brands.js`.

How it works: the HTML is written with the neutral values of the `mafsan` config. `assets/js/brand.js` swaps every neutral value for the client's (text, links, alt text, the title), rebuilds the footer wordmark, swaps the reception photo, and the 3D intro and NYLA read the name from the same config. Anything inside `data-nobrand` (the "Website by MAFSAN" credit) is never swapped.
The 3D scene always models One by Omniyat in Business Bay; a client in another tower changes the words, not the model.

## Light and dark theme

- Dark is the default. The switch in the header flips to light; the choice is saved (`localStorage` key `mf-theme`). With no saved choice the site follows the device setting.
- `brand.js` runs in `<head>` and sets `data-theme` on `<html>` before the first paint, so there is no flash of the wrong theme.
- Light theme tokens live in `site.css` under `html[data-theme=light]`. The 3D film, NYLA, the sample-note covers and a few art pieces stay dark in both themes on purpose; after the film the 3D city behind the showcase turns into a light drafting print, and the sunset footer becomes a sunrise.

---

Original preview notes follow.
It uses plain HTML, CSS and vanilla JavaScript with no build step, and makes no network calls apart from Google Fonts.
No form or chat message is sent anywhere.

- Language: English only for this preview. NYLA's language chips show how the live assistant greets in Arabic, Russian, Hindi and Chinese.
- Every page carries a "Preview build, for presentation" line in the footer legal row and a `noindex` robots meta. `vercel.json` also sends an `X-Robots-Tag: noindex` header.

## Run it

- **Locally:** serve the folder and open `index.html`, for example with `python3 -m http.server 8080`.
- **On Vercel:** deploy this folder as a static project with no framework and no build command.
  - `vercel.json` turns on `cleanUrls`, so `/true-cost-calculator` works, and caches `/assets/*` for a year.
  - `.vercelignore` keeps `qa/` and this README out of the deployment.
- **Cache busting:** CSS and JS are linked with `?v=20261017-3`. Bump that string in every page when either file changes (assets are cached for a year).
  - Images in `assets/img/` are not versioned, so give a changed image a new file name.

## Pages

| Page | File | What it does |
|---|---|---|
| Home | `index.html` | Particle hero: the Dubai skyline forms in copper light on load. Scrolling through the pinned hero re-forms the particles into the LUXE HAVEN wordmark. The rest of the page, in order: Trust Wall; five value pillars, each linking to a tool; Market Pulse (three sample articles); How we work (four steps, each with "You get"); three advisor placeholder cards; office band; contact form. |
| True Cost Calculator | `true-cost-calculator.html` | Working calculator (details below), plus a "Send me this breakdown as a PDF" form and a fee FAQ. |
| Business Bay guide | `business-bay.html` | Community guide: why Business Bay, four key numbers, a price-per-sq-ft chart (hover or tap, with a table view), anonymised recent transactions, yield and service-charge ranges, commute times, an advisor note, an FAQ and a report request form. |
| Off-plan Scorecard | `off-plan-scorecard.html` | The six weighted checks (25 / 20 / 15 / 15 / 15 / 10). A sample scorecard for the fictional "Sample Tower, Business Bay" by "Sample Developer" (78 / 100). A working payment-plan calculator and a scorecard request form. |
| Prime Market Report, Q3 2026 Review | `market-report.html` | Report landing page: CSS report cover, four highlight figures (Q3 2026 vs Q3 2025), takeaways, chapter list and a gated download form. |
| Privacy Policy | `privacy.html` | Placeholder page linked from every lead form and the footer. Lists what the final policy must cover; the text itself is marked "to be added". |

### Sitewide

- **Header:** sticky nav with active-page marking, a mobile menu with "Talk to an advisor" and "WhatsApp us" buttons, and a "Talk to an advisor" button that opens NYLA.
- **Footer:** contact details, live Dubai clock (GST), tool links, licence and regulation block, privacy link and an animated skyline line drawing. On the calculator page the main footer button is "Send me this breakdown"; elsewhere it is "Calculate your true cost".
- **NYLA:** a WhatsApp-style assistant on every page.
  - It opens from the launcher or from any "Talk to an advisor" button.
  - A small teaser bubble appears once per browser session after 7 seconds, hides itself after 8 seconds, and never shows while a lead form is on screen or a form field has focus.
  - It asks about the goal, budget, timeline, and cash versus mortgage, then takes a name and WhatsApp number (with country code).
  - Typed answers that match an option are accepted ("invest" picks "Invest for yield"). Anything else is kept as a "Notes" line for the advisor, and NYLA asks the question again with its buttons.
  - It ends with: "An advisor has been notified and will call you shortly, usually within minutes during business hours."
  - After a form hand-over it adds "Preview: nothing was sent" straight after its first reply.
  - Language chips: English, العربية (right-to-left), Русский, हिन्दी, 中文.
  - Labelled "Preview: simulated conversation. Nothing is sent."
- **Lead forms:** validate name, email, WhatsApp number (must start with + or 00, then 9 to 15 digits) and consent. Consent is unchecked by default.
  - Each form links to the Privacy Policy and has a separate, optional "also send me the weekly Market Pulse" box.
  - The home contact form starts with nothing selected: goal, budget and timeline must each be chosen.
  - On submit, a form shows a confirmation and opens NYLA already filled with what the visitor typed.
  - NYLA then asks only the questions that are still open.
  - The calculator form also echoes the visitor's own estimate back.
- **Motion:**
  - Smooth scroll with Lenis.
  - Scroll reveals, line-by-line headline reveals, count-ups, a magnetic hover on buttons and a glow on the pillar cards.
  - With `prefers-reduced-motion`, all of this is replaced by static, fully visible content and a still skyline.
- **Responsive:** checked at 1440 x 780 and 390 x 844 with no horizontal page scroll. On phones the Business Bay transactions show as one card per sale, the advisor cards are a swipe row, section spacing is tighter, and the calculator shows a slim bar with the live upfront total.

## What is functional

### True Cost Calculator

Inputs: price (accepts "2.5M" and "750k"), ready or off-plan, cash or mortgage, expected rent, service charge (per sq ft, or flat), maintenance %, management % and agency commission %.

Behaviour:
- Until the visitor types their own figures, rent follows the price at a 6% gross yield and size follows it at about AED 1,875 per sq ft, so yields stay realistic when the price slider moves. A note asks the visitor to check the rent when gross yield is above 12% or below 3%.
- Prices under AED 100,000 (or a blank field) show "—" for yields, percentages, the Golden Visa check and the summary instead of nonsense figures. Typing is debounced by 250 ms.
- Rent of 0 is treated as owner-occupied: the card shows the annual holding cost and the yields read "Not applicable".
- Loan to value is capped at 80% up to AED 5M and 70% above.
- Rates and percentages accept a decimal comma ("4,25"); the rate is limited to 0–15% and fee percentages to 0–10%.
- Off-plan: no trustee office fee (an "Oqood / developer admin fee, varies" row is shown instead, not in the total), agency set to "Paid by developer", and the scenario is cash only because mortgages are arranged near completion.
- A "Send me this breakdown" / "Ask an advisor" button pair sits under the results.

Fee model (as of Oct 2026, labelled "verify before transacting"):

| Item | Model |
|---|---|
| DLD transfer fee | 4% of price |
| DLD admin fee | AED 580 |
| Trustee office fee | AED 4,000 + 5% VAT (AED 2,000 + VAT below AED 500,000) |
| Agency commission | 2% + 5% VAT by default, editable. Set to 0 for off-plan bought direct from the developer. |
| Mortgage registration | 0.25% of the loan + AED 290 |
| Bank arrangement fee | 1% of the loan by default + 5% VAT, editable, capped at 1% |
| Valuation | AED 3,000 + 5% VAT |
| Off-plan | No trustee office fee; developer's Oqood admin fee not modelled |

Outputs:
- cash needed upfront, and costs on top of the price (AED and %);
- a donut chart with a legend and values;
- the monthly mortgage payment;
- net rental income;
- gross yield vs net yield, labelled. Net yield is net income divided by price plus purchase costs;
- cash-on-cash return when a mortgage is used;
- a Golden Visa check against the AED 2M property threshold.

Checked results:

| Scenario | Costs on top of price | Cash needed upfront | Other |
|---|---|---|---|
| AED 3,000,000, ready, cash | AED 187,780 | AED 3,187,780 | Gross 6.00%, net 3.52% |
| AED 3,000,000, 75% mortgage | AED 220,470 | AED 970,470 | Monthly AED 12,189 (bank fees now include 5% VAT; was AED 219,195 without) |
| AED 3,000,000, off-plan | AED 120,580 | AED 3,120,580 total cost | No trustee or agency fee |

### Payment-plan calculator (Off-plan Scorecard page)

- Inputs: price, plan (50/50, 60/40, 70/30 or 80/20), booking deposit and months to handover.
- Outputs: a bar schedule with booking plus the 4% DLD fee, quarterly instalments and handover; cash needed before keys; the amount due at handover; and the average per month.
- A deposit above the plan's pre-handover share shows "Deposit can't exceed the 60% due before handover", and the instalment row is hidden when it is zero.

### Business Bay chart

- An SVG line chart with a crosshair tooltip, a "View as a table" toggle and a draw-in animation.

## Placeholders the client must supply before launch

Placeholders are shown as dashed copper tags, or as "Illustrative" / "Sample" banners. Contact details carry a "to confirm" tag.

| # | Item | Where it appears | Notes |
|---|---|---|---|
| 1 | RERA Office Registration Number (ORN) | Home Trust Wall; footer licence block (all pages) | Shows "ORN: to be added" and "to be added". |
| 2 | DED trade licence number | Footer licence block (all pages) | "to be added" |
| 3 | Advisor names, photos, BRNs and languages (three advisors) | Home, Advisors section | Cards read "Advisor name", "Photo to be added", "BRN: to be added", "Languages: to be added". The focus areas are suggestions only. |
| 4 | Advisor BRNs, sitewide claim | Home Trust Wall | "BRN: to be added" |
| 5 | Trakheesi permit QR codes | Home Trust Wall ("QR placeholder"); footer | A real permit number and QR are needed on every live listing ad. |
| 6 | Google rating and reviews | Home Trust Wall | "Shown live once connected". Pull the real rating from the Google Business Profile; do not type one in. |
| 7 | Dubai REST verification | Home Trust Wall | Links to the DLD site (https://dubailand.gov.ae/en/). Replace with the brokerage's own verification route or listing once the ORN is in place. |
| 8 | Business Bay figures: price per sq ft, sales count, yields, service charges, quarterly chart, transactions | `business-bay.html` | All labelled "Illustrative data for this preview. The live site pulls Dubai Land Department transaction data." Building names are anonymised ("Canal-front tower A"). |
| 9 | Business Bay advisor note | `business-bay.html` | Sample text: "Advisor name to be added", "BRN: to be added". |
| 10 | Market report figures and chapters | `market-report.html` | Illustrative; replace with the real quarterly report and PDF. |
| 11 | Market Pulse articles (three) | Home | Tagged "Sample articles for this preview". Replace with real weekly posts. |
| 12 | Off-plan sample scorecard | `off-plan-scorecard.html` | Fictional project and developer, by design. Real scorecards need verified DLD, RERA and escrow records. |
| 13 | Fee model | Calculator, scorecard | Rates as of Oct 2026. Confirm with the trustee office and lenders before launch, and again on each update. |
| 14 | PDF delivery (calculator breakdown, community report, market report, scorecard) | Lead forms | Not built in the preview. Needs PDF generation plus email or WhatsApp delivery. |
| 15 | NYLA live assistant | All pages | The preview is a scripted, simulated chat. For live: WhatsApp Business API, NYLA AI, CRM lead routing and advisor alerts, plus replies in the visitor's language. |
| 16 | Form back end and CRM | All lead forms | Nothing is sent. Connect to the CRM with consent logging. |
| 17 | Privacy policy text and terms page | `privacy.html` (placeholder), every lead form, footer | The page exists with headings only. The final text must be supplied and reviewed against the UAE Personal Data Protection Law before forms go live. Terms page still to add. |
| 18 | Photography and photo rights | Office band, Business Bay | Uses the office and One by Omniyat photos from the concept demo. Confirm the rights to the `omniyat-*` images (they may be developer marketing images). The reception photo is cropped to the logo wall and desk; a professional shot would be better. Business Bay needs a real skyline photo. |
| 19 | Analytics and consent banner | Sitewide | Not included in the preview. |
| 20 | RERA status | Home Trust Wall, hero | "RERA-regulated brokerage" is stated, with "Status to confirm". Confirm before launch alongside the ORN. |
| 21 | Advisor response time | NYLA closing message, home lead list | Copy says an advisor calls "shortly, usually within minutes during business hours" and replies come "in minutes on WhatsApp". Confirm the service level the team can keep. |

Contact details (+971 56 576 6004, info@luxehavenrealty.ae, Instagram, YouTube) and the office address (Office 603, One by Omniyat, Business Bay) are carried over from the concept demo. Confirm them before launch.

## Files

```
index.html                    Home
true-cost-calculator.html     True Cost Calculator
business-bay.html             Business Bay community guide
off-plan-scorecard.html       Off-plan Scorecard + payment plan
market-report.html            Prime Market Report landing (Q3 2026 Review)
privacy.html                  Privacy Policy placeholder
assets/css/site.css           Design system and all page styles
assets/js/site.js             Shared: smooth scroll, reveals, nav, forms, NYLA, skyline helpers
assets/js/hero.js             Home particle hero
assets/js/calculator.js       True Cost Calculator
assets/js/community.js        Business Bay chart
assets/js/scorecard.js        Scorecard gauge + payment plan
assets/vendor/                GSAP 3.13 (+ ScrollTrigger, SplitText), Lenis (local copies)
assets/img/                   Favicon and office / One by Omniyat photos (AVIF + JPG)
vercel.json                   Clean URLs, asset caching, noindex header
qa/                           Playwright screenshots and results (not deployed)
```

## QA

Automated with Playwright at 1440 x 780 and 390 x 844, with font requests blocked. Results are in `qa/qa-results.txt`.

The checks cover:
- no console errors and no horizontal overflow on any page;
- no external requests;
- chat opens and greets on every page;
- calculator figures for cash, mortgage, sub-AED 500k and off-plan scenarios, plus edge cases: "1.5M" / "750k", blank price, rent following the price, rent 0, LTV caps, decimal comma, fee caps;
- form validation, consent default and NYLA pre-fill;
- Arabic RTL and Chinese greetings;
- particle hero and wordmark;
- illustrative labels on Business Bay, and no real developer names on the scorecard;
- reduced motion;
- the review fixes: teaser timing, privacy links, WhatsApp format, NYLA free text, scorecard deposit limit, mobile layouts (transaction cards, advisor swipe row, section spacing, calculator bar, menu buttons).

Screenshots in `qa/` use fallback fonts because Google Fonts was blocked during testing. The live page loads Cormorant Garamond and Manrope.
