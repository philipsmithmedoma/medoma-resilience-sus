# Medoma Center – beredskapsläge (prototyp)

En klickbar prototyp, enbart front-end, av **Medoma Center** med ett **beredskapsläge**: sjukhusets ledningscentral följer patienterna i ett sjukhus hemma-program och ser direkt vad som händer när något går sönder – en väg, strömmen, vattnet, mobilnätet, en värmebölja eller en leverantör. Förvalt paket är **Skånes universitetssjukhus (SUS, Lund och Malmö)**; **Karolinska** är det andra paketet. Prototypen är utlyft ur [Medoma-Resilience-KS](https://github.com/philipsmithmedoma/Medoma-Resilience-KS), där sjukhusledningsprodukten bor; gränssnittet mellan produkterna är överlämningsfilen (SPEC.md § 7).

Alla patienter, team, besök, personal och meddelanden är **syntetiska** och märkta så. Varje siffra bär konfidens (verifierad, uppgift, estimat, illustrativt) och källa enligt DATA.md; illustrativa värden presenteras aldrig som verifierade.

## Köra

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm test
npm run build      # dist/, bas /medoma-resilience-sus/ (GITHUB_REPOSITORY styr basen i workflowen)
```

Appen gör inga nätverksanrop utöver kartplattorna från OpenStreetMap. Kartgeometrin ligger i `src/data/packs/geo/<paket>/` och hämtas från Overpass bara av `scripts/fetch-osm.mjs` och av workflowen `fetch-osm.yml` (manuell körning, öppnar en PR med datafilerna). Tills workflowen har körts för ett paket används de handgjorda fixturfilerna (`fixture*.json`) med samma schema.

## Dokument

`CLAUDE.md` (protokoll och regler) · `SPEC.md` (vad appen gör) · `DATA.md` (data, konfidens, källor) · `DESIGN.md` (utseende, mörkt läge, språk) · `DECISIONS.md` (varje val som specen inte gjorde) · `PROMPTS.md` (uppdraget).

## Demoberättelsen (SUS)

1. Öppna Medoma Center. Du är i vanlig drift: Patienter, Aktiviteter, Planering, Kapacitet, Medarbetare, Utrustning, Rapportering. Enhetsväljaren längst till vänster visar SUS.
2. Tryck **Beredskap**. Läget byter navigering: Översikt, Sjukhus hemma, Incident, Beroenden.
3. **Översikt**: patienter hemma, påverkade nu, onåbara, batteri slut inom 2 h, aktiva störningar och de tre realtidskorten. Allt är illustrativt och märkt så.
4. **Sjukhus hemma**: kartan visar Lund och Malmö med patienterna. Öppna fliken Meddelanden, välj Trafikverkets notis om Inre Ringvägen och **skapa vägstörningen från meddelandet**. Patienter som nu bara nås via omväg får "+N km".
5. Tryck **+1 h** två gånger. Mobilnätet faller i urbana zoner efter 1 h och i övriga efter 4 h; patienter med kontinuerlig övervakning blir "utan kontakt" och listan sorterar om. Öppna **Kapacitet** och se hur dagens pass påverkas. Öppna **Beroenden** och se vad som faller inom timmen.
6. **Kontakta alla kritiska**. Där telefon inte går fram föreslår panelen Besök inom 2 h eller Ta in.
7. **Planering**: flytta ett besök till en ledig tid hos samma team.
8. Markera en patient **Ta in**. Patienten hamnar i listan Överlämningar till sjukhus på Översikt; tryck **Exportera** och få JSON-filen som sjukhusprodukten läser.
9. Byt paket i läget Sjukhus hemma (eller i enhetsväljaren) till **Karolinska**: andra patienter, andra broar, samma produkt.

Skärmbilder: `docs/screenshots/` (utan kartplattor, som är utanför appens egen data).
