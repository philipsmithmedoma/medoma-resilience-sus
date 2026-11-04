# Medoma Center – beredskapsläge (prototyp)

En klickbar prototyp, enbart front-end, av **Medoma Center** med ett **beredskapsläge**: sjukhusets ledningscentral följer patienterna i ett sjukhus hemma-program och ser direkt vad som händer när något går sönder – en väg, strömmen, vattnet, mobilnätet, en värmebölja eller en leverantör. Organisationen är **Skånes universitetssjukhus (SUS, Lund och Malmö)**; en vårdgivare ser aldrig en annan vårdgivares miljö (se SPEC.md § 1). Prototypen är utlyft ur [Medoma-Resilience-KS](https://github.com/philipsmithmedoma/Medoma-Resilience-KS), där sjukhusledningsprodukten bor; gränssnittet mellan produkterna är överlämningsfilen (SPEC.md § 7).

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

1. Organisationen är **Skånes universitetssjukhus (SUS)**. Med en organisation hoppas startsidan över och appen öppnar direkt i SUS (adressen får prefixet `#/o/sus/`); finns fler organisationer väljer du en på startsidan med **Logga in**. Du är i vanlig drift: Patienter, Aktiviteter, Planering, Kapacitet, Medarbetare, Utrustning, Rapportering. Organisationens namn står vid logotypen och enhetsväljaren under det visar SUS med enheterna Lund och Malmö; användarmenyn längst till höger har **Byt organisation**.
2. Tryck **Beredskap**. Läget byter navigering: Översikt, Sjukhus hemma, Incident, Beroenden; plattformens sidor ligger i menyn Medoma.
3. **Översikt**: tre realtidskort (utan kontakt nu, kortaste hubbatteri, nästa pumpbyte), patienter hemma, påverkade nu, onåbara, batteri slut inom 2 h, aktiva störningar och incidentstatus. Allt är illustrativt och märkt så; realtidsfälten är simulerade.
4. **Sjukhus hemma**: kartan visar Lund och Malmö med patienterna. Öppna fliken Från meddelande, välj Trafikverkets notis om Inre Ringvägen och **skapa vägstörningen från meddelandet**. Eller tryck på en vägsträcka i Stäng vägar: samma väg stängs inom 250 m åt båda hållen. Patienter som nu bara nås via omväg får "+N km".
5. Tryck **+1 h** två gånger. Mobilnätet faller i urbana zoner efter 1 h och i övriga efter 4 h; patienter med kontinuerlig övervakning blir utan kontakt och listan sorterar om (sepsis före rytm före andning, sedan elkritiska). Fäll ut en rad och läs förklaringskedjan. Öppna **Kapacitet** och se hur dagens pass påverkas. Öppna **Beroenden** och se vad som faller inom timmen.
6. **Kontakta alla kritiska**. Där telefon inte går fram föreslår panelen Besök inom 2 h eller Ta in. Under Demo kan ett elavbrott utan registrering startas: panelen föreslår "Misstänkt störning" när patienterna tystnar.
7. **Planering**: flytta ett besök till en ledig tid hos samma team.
8. Markera en patient **Ta in**. Patienten hamnar i listan Överlämningar till sjukhus på Översikt; tryck **Exportera** och få JSON-filen som sjukhusprodukten läser.

## Skärmbilder

`docs/screenshots/normal/` (Patienter, Planering, Kapacitet i vanlig drift) och `docs/screenshots/prep/` (Översikt, Sjukhus hemma, Incident, Kapacitet och Beroenden i beredskapsläget, Beroenden både utan och med störning). Varje sida finns på svenska och engelska, ljust och mörkt. **Kartplattorna från OpenStreetMap är bortblockerade i skärmbilderna** (kartan visar bara appens egna lager på tom bakgrund); i appen laddas de. Bilderna är tagna mot fixturgeometrin för SUS (se nedan).

## Datafilernas status

**SUS har fixtur tills `fetch-osm.yml` har körts**: `src/data/packs/geo/sus/fixture*.json` är handgjorda med samma schema och de verkliga vägnamnen, siffrorna är påhittade. Kör workflowen (Actions, Fetch OpenStreetMap data, paket `sus`) så öppnas en PR med de riktiga filerna, och testerna körs då mot dem.
