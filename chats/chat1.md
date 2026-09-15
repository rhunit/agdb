# # Amsterdam Genetics Review Dashboard

I appreciate the detailed brief. However, I need to be transparent: I cannot browse external websites or access live URLs, including

_Started 2026-09-08 07:48 UTC_

---

## User

Design a clean, professional internal dashboard tool for the team at Amsterdam Genetics, a cannabis seed brand and coffeeshop operator in Amsterdam. This is an internal tool used by the marketing/operations team to monitor Google Business Profile reviews across multiple coffeeshop locations — it is NOT a customer-facing page, but it should still feel unmistakably on-brand for Amsterdam Genetics.

BRAND REFERENCE
Look at https://www.amsterdamgenetics.com/ for the actual brand identity — extract the real color palette, typography, logo treatment, iconography style (the brand uses cannabis-leaf and landrace/heritage motifs, and has a mascot character called "Professor Harvest"), and overall visual tone (rooted in Amsterdam's classic coffeeshop culture — heritage, quality, connoisseurship — but presented in a modern way). Use the site's actual colors and fonts rather than generic cannabis-brand clichés (avoid stock "weed leaf on black" tropes unless that's genuinely what the brand uses).

DESIGN PRIORITIES FOR THIS INTERNAL TOOL
- Since this is used daily by a small team to catch urgent issues (like a 1-2 star review), clarity and scannability come first — the brand styling should wrap around a functional layout, not fight it
- Should still feel like "an Amsterdam Genetics product," not a generic SaaS admin panel
- Support for viewing multiple physical locations side by side or via a switcher

SCREENS TO DESIGN

1. Main dashboard (primary screen)
   - Location switcher/tabs at the top (2-3 locations + "Alle locaties")
   - A prominent, unmissable alert area for new 1-2 star reviews from the last 7 days — this needs to visually stand out without looking alarmist or off-brand (avoid harsh red-alert styling that clashes with the brand's palette; find a way to signal urgency using the brand's own accent colors)
   - A "new reviews this week" feed: reviewer name, star rating, short text snippet, and a small colored pill/tag indicating the source (Organisch / QR-scan / Smoke Session / Onbekend) with a secondary label for confidence (bevestigd / vermoedelijk / onbekend)
   - A trend chart area showing search visibility/performance over the last 8 weeks per location, with a short "+X% vs vorige week" indicator
   - A "weekly log" timeline showing the append-only history of manual updates (Smoke Session notes + QR-scan notes), grouped by ISO week, most recent first, with submitter name and timestamp — this should visually read as an audit trail, not an editable list

2. Weekly update form screen
   - Simple, fast-to-fill form: location dropdown, "Smoke Session update" textarea, "QR-scan update" textarea, name field, submit button
   - Below it, a read-only table/timeline of past entries for that location (no edit/delete affordances — make it visually clear this is a permanent log)

3. Mobile push notification mockup
   - A small mockup of what the "1-2 sterren review binnengekomen" push notification looks like on a phone lock screen, styled with the brand's accent color/logo mark, showing reviewer name, rating, and location at a glance

DELIVERABLE
Provide high-fidelity desktop mockups for screens 1 and 2, plus the mobile notification mockup for screen 3. Use realistic Dutch placeholder content (reviewer names, review snippets, coffeeshop location names like "AG Coffeeshop Centrum" and "AG Coffeeshop Oost"). Show both an empty/normal state and the "urgent alert" state for the main dashboard so the team can compare how the alert draws attention without breaking the overall design.

## Assistant

I'll pull the actual brand identity from the site first.

_[tool: list_files]_

_[tool: web_fetch]_

Brand palette confirmed (green #3CAA36, warm brown #4D3935, green-and-gold logo, Professor Harvest). Building the mockups.

_[tool: dc_write]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: web_search]_

_[tool: web_fetch]_

_[tool: ready_for_verification]_

Four artboards on a pan/zoom canvas: **1a** dashboard normale staat, **1b** urgente staat, **1c** weekly update form, **1d** push lockscreen.

Brand basis pulled from the real identity: AG green #3CAA36, warm brown #4D3935 chrome, green-and-gold logo mark, Professor Harvest as a footer voice ("Get smart, before you get high"). Urgency is carried entirely by the brand's **gold on dark brown** — no alert red — so 1b reads instantly next to 1a without changing the layout. Monospace + "append-only / alleen-lezen" stamps give the weeklog its audit-trail feel.

Say the word if you'd like a location-detail screen or the reply-composer modal.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Contrast pass applied: filled stars now #7A5E0E on light grounds (gold kept only on dark), all mono metadata and labels darkened to #6E635C, chart axis labels likewise, and the primary CTA moved to the deep green #24651F. Gold-on-brown urgency styling in 1b is unchanged.

