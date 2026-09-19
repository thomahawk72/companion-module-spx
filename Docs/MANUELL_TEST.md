# Manuell test av spx-graphics-controller 2.0.1

Alt som kan automatiseres ligger i `scripts/verify.sh all` og `scripts/verify.sh integration`.
Denne lista dekker det som ikke kan: at Companion faktisk laster modulen, at knappene virker,
og at oppgraderingen ikke gjør eksisterende knapper stumme.

Grunnen til at `main.js` ikke har automatisert dekning er at den ikke kan `require`s i en
testprosess — `runEntrypoint()` kaller `process.exit(1)` uten `MODULE_MANIFEST`.

## Forutsetninger

- SPX Solo 1.4.1 kjører: `cd <din SPX-installasjon> && node server.js` (port 5656)
- Kontroller-siden er åpen: <http://127.0.0.1:5656/gc/MyFirstProject/MyFirstRundown>
- Renderer er åpen: <http://127.0.0.1:5656/renderer>
- Companion 4.2.6 kjører, tilkoblingen `spx` peker på 127.0.0.1:5656, apikey tom

## T1 Modulen lastes

1. Bygg med `npm run build` og importer `.tgz` i Companion, eller bruk
   `dev_modules_path` med en symlink til dette repoet og start Companion på nytt.
2. Forventet: modulen vises som versjon 2.0.1 under Modules, uten feil i Companion-loggen.

## T2 Tilkoblingsstatus

1. Sett porten til 5999 i tilkoblingens config. Lagre.
2. Forventet: status blir «Connection Failure» innen 10 sekunder, og Companion-loggen får en
   `error`-linje.
3. Sett porten tilbake til 5656.
4. Forventet: status blir «OK» med teksten `SPX Solo 1.4.1`.

Merk: å sette feil apikey gir **ikke** Bad config, fordi `/api/v1/version` ikke har
apikey-sjekk i SPX. Se T5.

## T3 Start item by ID

1. Lag en knapp med handlingen «Start item by ID», ID `1773083297693`.
2. Fokuser et annet element i kontroller-siden, for eksempel det første i rundownen.
3. Trykk knappen.
4. Forventet: riktig element spilles, og fokus i kontroller-siden flytter seg dit.
   Sjekk i renderer-konsollen:
   `document.getElementById('layer3').contentWindow.document.querySelector('#gfx').style.opacity`
   skal være `1`.
5. Gjenta 5 ganger med ulikt utgangsfokus. Alle 5 skal spille riktig element.

## T4 Stop item by ID

1. «Stop item by ID» med samme ID.
2. Forventet: `#gfx`-opacity går til `0`, elementet animeres ut, fokus blir stående.

## T5 Feil apikey

1. Sett en apikey i SPX sin `config.json` og start SPX på nytt. La feltet i Companion stå tomt.
2. Trykk en hvilken som helst handlingsknapp.
3. Forventet: Companion-loggen får en `error`-linje med SPX sin feilmelding, fordi SPX svarer
   HTTP 200 med `{error}` i kroppen i stedet for 401.
4. Forventet, og dette er verdt å merke seg: **tilkoblingsstatusen står fortsatt på OK**, fordi
   `/api/v1/version` ikke krever nøkkel. Vurderes som forbedring senere.

## T6 Feil ID

1. «Start item by ID» med ID `000`.
2. Forventet: SPX svarer 200, ingen grafikk spiller, og kontroller-konsollen viser at elementet
   ikke finnes. Noter faktisk oppførsel — den avgjør om modulen bør slå opp ID-en før den
   sender. Merk at `rundown/get`, som kunne besvart det, er 501 i Solo.

## T7 Handlinger som gir 501

1. «Direct playout» med standardverdiene.
2. Forventet: ingen krasj, og Companion-loggen får en linje som nevner SPX Solo og
   Production/Broadcast.

## T8 Eksisterende knapper overlever oppgraderingen

Dette er den viktigste testen før utrulling på Moses.

1. Noter hvilke handlinger knappene bruker **før** oppgradering.
2. Etter installasjon av 2.0.1: åpne hver knapp og bekreft at handlingen fortsatt er koblet,
   ikke vist som «Unknown action».
3. Forventet: alle fjorten `actionId`-ene fra 2.0.0 finnes fortsatt. Dekket automatisk av
   `src/__tests__/actions.independent.unit.test.js`, men bekreft én gang i ekte Companion.

## T9 Utrulling på Moses

1. Companion kjører headless. Kopier `.tgz` over og importer via web-UI-et, eller legg
   utpakket kopi i modulmappa.
2. Sett porten i tilkoblingen til den SPX faktisk lytter på. 2.0.1 endrer **ikke**
   eksisterende config; standardporten 5656 gjelder bare nye tilkoblinger.
3. Kjør T2, T3, T4 og T8 på nytt på maskinen.
