# Plan-dokumenter for agentteam

Et plan-dokument er det hovedagenten lager brief-filer
fra. Formatet under er hentet fra superpowers' `writing-plans` og tilpasset vår flyt
(ingen commit fra agenter, `verify.sh focus` i stedet for direkte testkjøring).
Skriv planen som om leseren er en dyktig utvikler uten kjennskap til kodebasen og med
tvilsom smak: alt må stå der, ingenting skal antas.

### Hode

```markdown
# <Funksjon> – implementeringsplan

**Mål:** <én setning>
**Arkitektur:** <2–3 setninger om tilnærming>
**Spec:** <sti til designdokument, hvis finnes>

## Globale krav
<prosjektomfattende krav, én linje hver, med eksakte verdier: navnekonvensjoner,
versjonsgrenser, tekststrenger, plattformkrav. Hvert steg arver disse implisitt.>

## 0. Status (hovedagent) – 0.1 commit-hash per steg, 0.2 åpne avgjørelser
## 1. Fremdrift (hovedagent)
```

### Filstruktur før stegene

Før stegene defineres: list hvilke filer som lages eller endres og hva hver har ansvar
for. Lista kommer fra grafen: `graphify query "<funksjon>"` for berørte filer og
`graphify explain "<symbol>"` for kallere som må endres sammen med symbolet. En fil grafen
viser som kaller, men som ikke står i planen, er et planhull.
Én fil, ett ansvar. Filer som endres sammen bor sammen. Splitt etter ansvar, ikke
etter teknisk lag. Følg eksisterende mønstre; en fil som allerede er uhåndterlig kan
splittes som del av planen, men ikke restrukturer utenfor oppgaven.

### Steg-størrelse

Et steg er den minste enheten som bærer sin egen testsyklus og fortjener en egen
reviewer-runde. Oppsett, konfigurasjon og dokumentasjon foldes inn i steget som trenger
det. Splitt bare der en reviewer kan avvise ett steg og godkjenne naboen. Hvert steg
ender i noe som kan testes for seg.

### Steg-struktur

````markdown
### P<n>: <komponent>

**Filer:**
- Lag: `eksakt/sti/fil.js`
- Endre: `eksakt/sti/eksisterende.js:123-145`
- Test: `eksakt/sti/__tests__/fil.unit.test.js`

**Grensesnitt:**
- Bruker: <hva dette steget bruker fra tidligere steg, eksakte signaturer>
- Leverer: <hva senere steg bygger på: funksjonsnavn, parametre, returtyper.
  Kodeagenten ser bare sitt eget steg; denne blokken er hvordan den lærer navnene
  nabostegene bruker.>

- [ ] **1. Skriv den feilende testen**

```js
test('avviser tom e-post', async () => { ... });
```

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus backend/modules/x/__tests__/fil.unit.test.js`
Forventet: FEIL med «x is not a function»

- [ ] **3. Minimal implementasjon**

```js
function x(input) { ... }
```

- [ ] **4. Kjør og se at den passerer**

Kjør: samme focus-kommando. Forventet: PASS

- [ ] **5. Dokumentasjon** (DATABASE.md / ARCHITECTURE.md / modul-README)
````

### Ingen plassholdere

Dette er planfeil og skal aldri stå i et steg:
- «TBD», «TODO», «implementeres senere», «fyll inn detaljer»
- «legg til passende feilhåndtering» / «legg til validering» / «håndter kanttilfeller»
- «skriv tester for det over» uten faktisk testkode
- «som i steg N» (gjenta koden; kodeagenten leser bare sitt eget steg)
- steg som sier hva uten å vise hvordan (kodeblokk kreves for kodesteg)
- referanser til typer eller funksjoner som ikke er definert i noe steg

### Selvgjennomgang av planen

Etter at planen er skrevet, sjekk den mot spec med friske øyne:
1. **Dekning:** kan hvert krav i spec pekes til et steg? List hull.
2. **Plassholdere:** søk etter mønstrene over. Fjern dem.
3. **Typekonsistens:** stemmer navn og signaturer i senere steg med det tidligere steg
   definerer? `clearLayers()` i P3 og `clearFullLayers()` i P7 er en feil.
4. **Rekkevidde:** for hvert symbol som endres, dekker stegene alle kallere
   `graphify explain` viser? Kallere som ikke skal endres begrunnes i Globale krav.
Rett inline. Mangler et krav et steg, legg til steget.
