# Ideeën en uitgezochte opties

Notities voor later werk aan het dashboard. Nog niet gebouwd.

## Reviews van TripAdvisor en Trustpilot (november 2026)

Uitgezocht, nog niet gebouwd. Documentatie kon niet worden nagekeken
(sites niet bereikbaar vanuit de ontwikkelomgeving), dus eerst controleren.

### TripAdvisor
- Officiële Content API: alleen de 5 nieuwste reviews per locatie, plus
  score en aantal reviews. Geen volledige geschiedenis.
- Reageren kan niet via de API; alleen op TripAdvisor zelf (dashboard kan
  een knop "Reageer op TripAdvisor" tonen).
- Voorstel: elke paar uur de 5 nieuwste ophalen en zelf bewaren, zodat er
  vanaf de start een overzicht ontstaat.
- Open: kosten (gratis aantal aanvragen per maand, waarschijnlijk met
  creditcard), voorwaarden over bewaren van reviews, verplicht logo/link,
  en of een intern dashboard is toegestaan.
- Niet doen: pagina's uitlezen (scrapen) — tegen hun regels en geblokkeerd.
- Nodig: TripAdvisor-pagina's per locatie en een API-sleutel.

### Trustpilot
- Koppeling voor bedrijfseigenaren: volledige lijst ophalen (per pagina) en
  in principe reageren, met inloggen via het bedrijfsaccount.
- API-toegang zit vermoedelijk alleen in de betaalde abonnementen.
- Eerst nagaan: staan de locaties op Trustpilot en met hoeveel reviews?

### Advies
1. Eerst per platform de links en aantallen reviews per locatie verzamelen.
2. Trustpilot is de beste koppeling, als er een betaald abonnement is.
3. TripAdvisor kan alleen beperkt (5 nieuwste + link om te reageren).

## Dashboard sneller laden (november 2026)

Voorgesteld, nog niet gebouwd. Waarschijnlijke oorzaak van het trage laden:
de volledige reviewlijst (tot 10.000 per locatie, sinds Sloterdijk >2.000
reviews heeft) wordt bij elk bezoek opnieuw bij Google opgehaald, 50 per
pagina en pagina na pagina (alleen 1 minuut bewaard). Alle reviews,
Rapportage, de sterrenverdeling op het Dashboard en de controle op
verwijderde reviews wachten daarop.

Voorstel:
1. De server bewaart de laatste volledige lijst op schijf en geeft die
   direct terug (ook na een herstart).
2. Is die ouder dan een paar minuten, dan haalt de server op de achtergrond
   een nieuwe op; niemand wacht daarop.
3. "Vernieuwen" wacht wel op een verse lijst van Google.
4. Een geplaatste reactie wordt direct in de bewaarde lijst verwerkt.

Nadeel: zonder "Vernieuwen" kan de lijst een paar minuten achterlopen
(de nieuwste reviews op het Dashboard niet; die komen uit een aparte,
snelle ophaalronde).

## Boerejongens West: volledige reviewgegevens zonder beheerderstoegang (november 2026)

Nu: tabblad met alleen openbare Google Maps-data (score, totaal, nieuwe
reviews per week, max. 5 door Google gekozen reviews), met rode asterisk.
Beste oplossing blijft: eigenaar voegt het dashboardaccount toe als
beheerder van het profiel (gratis, volledig, ook reageren).

Alternatieven om sterrenverdeling + teksten te krijgen (niet nagekeken,
eerst controleren):
1. SerpApi, gratis plan (~100 aanvragen/maand, Google Maps Reviews API,
   sorteren op nieuwste, ~10 reviews per aanvraag). Plan: 3x per dag de
   nieuwste reviews ophalen (~90/maand), teller die onder de grens blijft.
   Sleutel in Northflank als SERPAPI_API_KEY. Voorkeur.
2. Apify, gratis maandtegoed (~$5) met een Google Maps Reviews-scraper.
3. Oudere Google Places API (legacy) met reviews_sort=newest (5 nieuwste),
   met de bestaande Google-sleutel; mogelijk niet beschikbaar voor dit
   project, valt onder Google's gratis maandlimiet.
Outscraper valt af: vereist betaalgegevens voor API-gebruik.

Met volledige gegevens: West telt mee in Alle reviews, Rapportage/PDF en
de weekmail (incl. maandstand review bonus), zonder reageren.
