# Agentteam-protokoll

**Opprettet:** 2026-09-06
**Revidert:** 2026-09-11 (graf-oppslag obligatorisk med bevis, sequential thinking §9); 2026-09-08 (kunnskapsgraf/graphify som første oppslagskilde, §3b)
**Gjelder:** alle utviklingsoppgaver som kjøres med agentteam i dette repoet. Generisk versjon
vedlikeholdes i agentteam-skillen (`~/.claude/skills/agentteam/PROTOKOLL.md`); repo-spesifikke
tillegg står i §11.

Spawn-prompten til en agent skal være kort: rolle, agent-ID, sti til brief-fil, og
«les og følg `Docs/AGENT_TEAM_PROTOCOL.md`», pluss påminnelsen om graf og sekvensiell (§2).
Alt annet står her eller i brief-filen.

## 0. Prinsipper

- **Ingen agent snakker med en annen agent.** All informasjon går via filer og hovedagenten.
  Agenter venter aldri på hverandre og avslutter så snart rapporten er skrevet.
- **Én agent om gangen per steg.** Kodeagent, deretter testagent, deretter reviewer. Aldri to
  agenter som skriver i arbeidstreet samtidig.
- **Bevis, ikke påstander.** Grønt finnes bare som resultatfil fra `scripts/verify.sh`.
  Spec-samsvar finnes bare som reviewer-rapport skrevet mot diffen.
- **Hovedagenten koordinerer, koder ikke, tester ikke.** Den leser rapporter, tar avgjørelser,
  fører ledger og rapporterer til Thomas.

## 1. Roller

| Rolle | Agent-ID | Modell | Kan | Kan ikke |
|---|---|---|---|---|
| Hovedagent | `hovedagent` | (sesjonens) | Starte agenter, lage brief-filer og diff-pakker, lese rapporter, ta avgjørelser, føre ledger, oppdatere plan-dokumentets §0/§1, rapportere til Thomas | Skrive kode eller tester selv; kjøre testsuiten selv for å «dobbeltsjekke»; rette funn selv |
| Kodeagent | `kodeagent-<steg>` | sonnet (runde 4–5: opus) | Skrive produksjonskode, migrasjoner, dokumentasjon; skrive **første feilende test** for hver ny atferd; kjøre fokuserte tester via `verify.sh focus`; krysse av plan-dokumentets §4 | Erklære grønt; kjøre full suite direkte; commit/push; skrive i §0/§1; svekke eller slette eksisterende tester; starte egne subagenter |
| Testagent | `testagent-<steg>` | sonnet | Skrive uavhengige tester og testoppsett; kjøre `scripts/verify.sh`; erklære GRØNT/RØDT | Endre produksjonskode; commit/push; starte egne subagenter |
| Reviewer | `reviewer-<steg>` | sonnet (sluttreview av hele steget: opus) | Lese brief, kodeagentens rapport og diff-pakken; vurdere spec-samsvar og kodekvalitet; skrive review-rapport | Endre noe som helst i arbeidstreet; kjøre testsuiten; starte egne subagenter |

Kodeagent og testagent kan aldri enes om å svekke eller slette en eksisterende test.
Slike behov meldes som eget punkt i rapporten, og hovedagenten avgjør.

## 2. Filer og mapper

Alt for ett steg ligger i `.agentteam/<steg>/` (git-ignorert, hovedagenten oppretter mappen):

| Fil | Skrives av | Leses av |
|---|---|---|
| `brief.md` | hovedagent | kodeagent, testagent, reviewer |
| `kode-rapport.md` | kodeagent (fiks-runder legges **til** nederst) | hovedagent, testagent, reviewer |
| `test-rapport.md` | testagent | hovedagent, reviewer |
| `diff-<n>.diff` | hovedagent via `scripts/diff-pakke.sh <steg>` | reviewer |
| `review-<n>.md` | reviewer | hovedagent, kodeagent (neste runde) |
| `ledger.md` | hovedagent | hovedagent (overlever komprimering) |
| `.verify/<scope>-<hash>.md` | `scripts/verify.sh` | alle |

**Brief-filen** inneholder: plan-steg (kopiert inn, ikke referert), hvilke filer som skal
lages/endres, grensesnitt mot tidligere steg (nøyaktige signaturer), globale krav fra planen,
og hovedagentens avgjørelser om uklarheter. Eksakte verdier står bare her. Ingen agent skal
lese hele plan-dokumentet.

**Spawn-prompt** er fire linjer: rolle og agent-ID, sti til brief (og til rapport/review ved
fiks-runde), «les og følg `Docs/AGENT_TEAM_PROTOCOL.md`», og «start med `graphify query` (§3b);
rapporten skal ha `GRAF-OPPSLAG` med output-utdrag og `SEKVENSIELL` (§9)». Ikke lim inn historikk.

**Retur fra agent** er under 15 linjer: status, én linje testsammendrag, bekymringer, sti til
rapportfil. Detaljene ligger i filen.

## 3. Verifisering: én kilde til sannhet

Alt som skal telle som verifisert kjøres med `scripts/verify.sh`.

- `scripts/verify.sh [<scope>|all]` kjører lint, tester og build for scopet. Scopes og kommandoer
  er definert i `scripts/verify.conf`.
- `scripts/verify.sh focus <testfil>` kjører én testfil under samme lås. Dette er
  kodeagentens verktøy i RØD/GRØNN-syklusen. Resultatet skrives til
  `.verify/focus-<navn>-<hash>.md`.
- Skriptet tar en lås. Kjører en annen, venter det. Ingen kjører `npm test` direkte i et team.
- Resultatet skrives til `.verify/<scope>-<hash>.md` med faktisk output og linjen
  `RESULTAT: GRØNT` eller `RESULTAT: RØDT`. Sett `VERIFY_AGENT=<din agent-ID>` før kjøring.
- Bare testagenten erklærer GRØNT, og bare med sti til resultatfil for fullt scope. Et GRØNT
  uten resultatfil er ugyldig. Hovedagenten leser filen og sjekker at hash-en stemmer med
  arbeidstreet.

## 3b. Kunnskapsgraf (graphify)

Finnes `graphify-out/graph.json` i repoet, er grafen første oppslagskilde for alle agenter.
Grafen erstatter ikke lesing av kode; den sier hvor man skal lese og hva som henger sammen.
Det grafen sier verifiseres i fila før det brukes.

**Ferskhet (hovedagent, før første spawn i en oppgave):** kjør `graphify update .` så grafen
matcher arbeidstreet (AST-oppdatering, ingen LLM). Er dokumentasjon endret siden forrige
bygg, kjør `/graphify --update`. En foreldet graf er verre enn ingen graf, fordi agentene
tar feil med selvtillit. Ledger får linjen `Graf: oppdatert <dato/HEAD>` eller `Graf: ingen`.

**Oppslag før søk.** Før `grep`, `find`, `Glob` eller lesing fil for fil, spør grafen:

| Spørsmål | Kommando |
|---|---|
| Hva henger sammen med X? | `graphify query "<spørsmål>"` |
| Hvordan når X fram til Y? | `graphify query "<spørsmål>" --dfs` |
| Korteste vei mellom to begreper | `graphify path "A" "B"` |
| Alt som er koblet til én node (kallere, tester, dokumentasjon) | `graphify explain "X"` |

Grep og Read brukes etterpå, på filene grafen pekte ut. Bruk ordene grafen selv bruker
(symbolnavn, filnavn); grafen har ikke synonymer.

**Per rolle:**

- **Hovedagent:** plan og brief bygges fra grafen. `graphify query` per steg gir filene som skal
  endres og grensesnittene mot nabosteg; `graphify explain` på hvert symbol brief nevner gir
  kallere som må inn i «Filer: Endre». Berørte filer i brief kommer fra grafen, ikke fra
  hukommelsen.
- **Kodeagent:** før første endring, `graphify explain` på hvert symbol som endres, for å se
  kallere og tester som berøres. Kallere utenfor steget som må oppdateres føres i rapporten
  under AVVIK FRA PLAN, ikke endres i stillhet.
- **Testagent:** `graphify explain` på endrede symboler for å finne eksisterende testfiler og
  kallere kodeagenten ikke testet. Uavhengig dekning skal dekke de kallerne grafen viser.
- **Reviewer:** for hvert endret symbol i diffen, `graphify explain` for å bedømme rekkevidde:
  kallere som ikke er i diffen, tester som ikke er oppdatert, dokumentasjon som refererer
  symbolet. «Kaller X i fil Y er ikke oppdatert» er et Viktig funn.

**Kvittering:** hver rapport (`kode-rapport.md`, `test-rapport.md`, `review-<n>.md`) har linjen
`GRAF-OPPSLAG: <kommandoer kjørt>` etterfulgt av minst ett faktisk utdrag (2–5 linjer) fra
output. Da kan hovedagenten skille mellom feil i grafen, dårlig spørsmål og feil hos agenten.

**Obligatorisk, ikke valgfritt:** første handling for enhver agent er
`test -f graphify-out/graph.json && graphify query "<steget i én setning>"`. Sjekk filen, ikke
mappen. `GRAF-OPPSLAG: ingen graf` er bare gyldig hvis den kommandoen viser at filen mangler.
Hovedagenten **avviser** en rapport uten `GRAF-OPPSLAG` med output-utdrag, eller med «ingen
graf» mens `graphify-out/graph.json` finnes, og starter agenten på nytt med samme brief.

**Tillit:** kanter merket EXTRACTED er lest fra kilden. INFERRED og AMBIGUOUS er gjetning og
verifiseres i fil før de brukes som grunnlag. Grafen er innspill til vurdering, ikke bevis:
GRØNT kommer fortsatt bare fra `scripts/verify.sh`, spec-samsvar bare fra review.

**Praktisk:**
- Finnes symbolet i flere filer, svarer `explain` «Ambiguous» og lister node-id-ene. Kjør på nytt
  med full id (`backend_modules_x_service_addfoo`), ikke bare navnet.
- `query` kutter ved 2000 tokens. Bruk `--budget 4000` eller et smalere spørsmål med filnavn.
- Kallkanter i JS/TS er ofte INFERRED (`indirect_call`). Gir `explain` på en funksjon få kanter,
  spør heller `query` med filnavnet; import- og filrelasjoner er der grafen er sikrest.
- `graphify update .` reclustrer grafen og erstatter håndsatte fellesskapsnavn med filnavn.
  Oppslag (`query`, `explain`, `path`) er upåvirket. Trengs lesbar rapport, kjør
  `/graphify --cluster-only` etterpå.

**Mangler grafen:** hovedagenten bygger den med `/graphify .` før planlegging. Går ikke det,
føres `Graf: ingen` i ledger og agentene søker som før.

## 4. Første test skrives av kodeagenten

For hver ny atferd (nytt endepunkt, ny regel, ny gren, bugfiks) gjelder:

1. **RØD:** Skriv én minimal test som beskriver atferden. Kjør `scripts/verify.sh focus <fil>`.
   Testen skal **feile fordi funksjonen mangler**, ikke på grunn av skrivefeil. Passerer den
   med en gang, tester den eksisterende atferd; skriv den om.
2. **GRØNN:** Skriv den enkleste koden som får testen til å passere. Kjør `focus` igjen.
3. **RYDD:** Fjern duplisering, gi gode navn. Testen skal fortsatt passere.

Kodeagenten fører RØD- og GRØNN-bevis i `kode-rapport.md` (kommando, relevant output, hvorfor
feilen var forventet). Kode uten dette beviset regnes som uverifisert i review.

Testagenten skriver deretter **uavhengig dekning**: kanttilfeller, feilveier, tilgangsgrenser,
integrasjon mot ekte tjenester der det trengs. Testagenten skal ikke kopiere kodeagentens tester, og
skal sjekke at kodeagentens tester faktisk asserter på atferd, ikke på mocks. Reglene for
ærlige tester står i `Docs/teknikker/writing-good-tests.md` og gjelder begge.

Unntak som ikke krever første test: rene konfigurasjonsfiler, generert kode, dokumentasjon.
Alt annet er unntak bare hvis hovedagenten har skrevet det i brief-filen.

## 5. Steg-syklus

```
hovedagent: graphify update . (hvis graf finnes) → brief.md → spawn kodeagent
kodeagent:  kode + første tester, focus-kjøringer, kode-rapport.md, avslutt
hovedagent: spawn testagent
testagent:  uavhengige tester, scripts/verify.sh <scope>, test-rapport.md, avslutt
            RØDT → fiks-runde (se §7), ikke videre
hovedagent: scripts/diff-pakke.sh <steg> → spawn reviewer
reviewer:   review-<n>.md, avslutt
            Kritisk/Viktig funn eller spec ❌ → fiks-runde (se §7)
hovedagent: ledger, plan §0/§1, sluttrapport til Thomas
Thomas:     commit
```

Rekkefølgen er fast: test før review, fordi reviewer skal slippe å vurdere kode som ikke
kjører. Etter en fiks-runde kjøres testagent og reviewer på nytt (reviewer i avgrenset modus).

## 6. Review

Reviewer får tre stier: `brief.md`, `kode-rapport.md` og `diff-<n>.diff`, pluss de globale
kravene fra planen kopiert inn i spawn-prompten. Reviewer leser diffen som sin eneste kilde,
åpner filer utenfor diffen bare for å sjekke en konkret navngitt risiko, og endrer ingenting.

**Stol ikke på rapporten.** Kodeagentens rapport er påstander. Begrunnelser som «utelatt etter
YAGNI» nedgraderer aldri et funn. Reviewer kjører ikke testsuiten; testagentens resultatfil er
testbeviset. Mangler RØD/GRØNN-bevis i rapporten, er det et funn.

**Del 1, spec-samsvar** mot brief: Mangler (krav hoppet over eller påstått uten kode), Ekstra
(ting ingen ba om), Misforstått (riktig krav, feil løsning). Krav som ikke kan bedømmes fra
diffen alene merkes ⚠️ og går til hovedagenten.

**Del 2, kvalitet:** feilhåndtering, tilgangskontroll og validering på nye innganger, sikker
håndtering av input (parameteriserte queries, ingen injeksjon), tester som asserter på atferd,
filer som vokser uforholdsmessig, brudd på repoets regelfiler (se §11).

**Kalibrering:** Kritisk = feil som gir datalekkasje, datatap eller brudd på tilgangsgrenser. Viktig = steget
kan ikke stoles på før det er fikset (feil atferd, manglende krav, test som ikke asserter
noe, svelgede feil). Mindre = polering og «dekningen kunne vært bredere». Kun Kritisk og
Viktig utløser fiks-runde. Mindre føres i ledger og tas i sluttreview.

**Format for `review-<n>.md`:**

```
STEG: <P-steg> REVIEW: <n>
SPEC-SAMSVAR: ✅ | ❌ <liste med fil:linje> | ⚠️ <kan ikke bedømmes fra diff: liste>
STYRKER: <konkret>
KRITISK: <fil:linje, hva, hvorfor, hvordan fikse>
VIKTIG: ...
MINDRE: ...
GRAF-OPPSLAG: <kommandoer kjørt + 2–5 linjer output, eller «ingen graf» med bevis>
SEKVENSIELL: <hva det ble brukt til | ikke aktuelt | ikke tilgjengelig>
VURDERING: GODKJENT | MÅ FIKSES
```

**Avgrenset re-review** (etter fiks-runde) får forrige `review-<n>.md`, oppdatert
`kode-rapport.md` og en diff-pakke som bare dekker fiksen. Den gir dom per funn
(`ADRESSERT` / `IKKE ADRESSERT` med fil:linje), lister ny brekkasje i fiks-diffen, og
noterer ting utenfor fiksen som «utenfor scope» uten å utvide runden.

## 7. Fiks-runder og eskalering

En fiks-runde utløses av RØDT fra testagent, eller Kritisk/Viktig funn eller spec ❌ fra
reviewer. Én runde = én kodeagent-kjøring + testagent + avgrenset re-review.

- **Runde 1–3:** ny `kodeagent-<steg>` på sonnet med brief, `kode-rapport.md` og de åpne
  funnene ordrett. Kodeagenten leser rapporten for å se hva som er prøvd, fikser, kjører
  `focus` på dekkende tester, og **legger til** en fiks-rapport nederst i `kode-rapport.md`.
- **Runde 4–5:** ny kodeagent på **opus**, med samme filer og denne rammen: «En tidligere
  kodeagent har forsøkt dette steget N ganger; du eier det nå. Les rapportfilen.»
- **Etter runde 5:** hovedagenten stopper og avgjør hvert åpent funn selv:
  reviewer tar feil eller punktet er diskutabelt → parkér med begrunnelse;
  reelt men ingenting bygger på det → parkér som «reelt, utsatt»;
  reelt og bærende → avgjør minste endring som løser opp, før i ledger, ta med i neste brief.
  Hovedagenten stopper helt og spør Thomas bare når hver vei videre er gjetting.

Hovedagenten retter aldri funn selv. Hver runde føres i ledger:
`Steg <P>: runde <r>/5 (<x> adressert, <y> åpne: <funn i ett ord hver>)`.

Ved gjentatte RØDT med samme feil skal kodeagenten følge feilsøkingsregelen i §9 før neste
forsøk, ikke prøve en ny gjetning.

## 8. Rapportformater

**`kode-rapport.md`** (kodeagent → testagent, reviewer, hovedagent):

```
STEG: <P-steg> STATUS: FERDIG | FERDIG MED FORBEHOLD | BLOKKERT | TRENGER KONTEKST
KLART: <filer/funksjoner med kontrakt>
RØD/GRØNN-BEVIS: <per atferd: testfil, focus-kommando, feilende output, passerende output>
ENDREDE EKSISTERENDE TESTER: <liste, eller «ingen»>
AVVIK FRA PLAN: <liste, eller «ingen»>
GRAF-OPPSLAG: <kommandoer kjørt + 2–5 linjer output, eller «ingen graf» med bevis>
SEKVENSIELL: <hva det ble brukt til | ikke aktuelt | ikke tilgjengelig>
FORBEHOLD: <ting du er usikker på>
SPØRSMÅL: <liste, eller «ingen»>
--- fiks-runde <r> ---
ENDRET: <hva>  DEKKENDE TESTER: <filer>  KOMMANDO + OUTPUT: <...>
```

Bruk BLOKKERT når oppgaven krever arkitekturvalg brief ikke dekker, eller du leser fil etter
fil uten å komme videre. Dårlig arbeid er verre enn ingen arbeid; eskalering straffes ikke.

**`test-rapport.md`** (testagent → hovedagent, reviewer):

```
STEG: <P-steg> RESULTAT: GRØNT | RØDT
RESULTATFIL: .verify/<scope>-<hash>.md
<oppsummeringsblokken fra filen>
NYE TESTER: <filer og antall>
VURDERING AV KODEAGENTENS TESTER: <asserter de på atferd? mangler?>
SVAKHETER (ikke blokkerende): <liste>
MÅ TESTES MANUELT: <liste>
GRAF-OPPSLAG: <kommandoer kjørt + 2–5 linjer output, eller «ingen graf» med bevis>
SEKVENSIELL: <hva det ble brukt til | ikke aktuelt | ikke tilgjengelig>
```

**`ledger.md`** (hovedagent), første linje `# Ledger – steg <P> – plan <fil>`. Deretter én
linje per hendelse: agent startet, rapport mottatt, runde, parkert funn, avgjørelse
(`Avgjørelse: <hva> – <hvorfor> – <hva det koster om det er feil>`). Etter komprimering er
ledger og `git status` sannheten, ikke hukommelsen.

## 9. Prosessregler som gjelder alle agenter

**Før du sier at noe virker:** kjør kommandoen som beviser det i samme melding, les hele
output og exit-koden, og sitér det. «Bør virke», «ser riktig ut» og «agenten sa OK» er ikke
bevis. Regelen gjelder også for
agentrapporter: «agenten sa ferdig» er en påstand til diffen og resultatfilen er lest.

**Oppslag før søk:** finnes `graphify-out/graph.json`, spør grafen (§3b) før grep, find og
lesing fil for fil. Grafen sier hvor du skal lese; fila er det du stoler på.

**Feilsøking:** ingen fiks før rotårsak. Les feilmeldingen helt, reproduser, sjekk hva som
nylig er endret, spor dataflyten bakover til kilden. Én hypotese, én minimal endring, verifiser.
Etter tre mislykkede fiks: stopp og still spørsmål ved arkitekturen i rapporten, ikke prøv en
fjerde. Teknikker: `Docs/teknikker/root-cause-tracing.md` (spor feilen bakover til kilden),
`Docs/teknikker/defense-in-depth.md` (validering i flere lag etter at rotårsaken er funnet),
`Docs/teknikker/condition-based-waiting.md` (vent på betingelse, aldri på vilkårlig timeout).

**Strukturert resonnering (sequential thinking):** er MCP-verktøyet
`mcp__sequential-thinking__sequentialthinking` tilgjengelig, bruker agenten det (via ToolSearch
`select:mcp__sequential-thinking__sequentialthinking`) i disse tilfellene:
- kodeagent: før et arkitektur- eller designvalg brief ikke avgjør, og før neste forsøk når
  samme feil har kommet to ganger;
- reviewer: før et funn klassifiseres som Kritisk;
- hovedagent: før avgjørelser etter runde 5 (§7).
Rapporten får linjen `SEKVENSIELL: <hva det ble brukt til>` eller `SEKVENSIELL: ikke aktuelt`.
Mangler verktøyet, skriv `SEKVENSIELL: ikke tilgjengelig` og resonner skriftlig i rapporten.

**Mottak av review:** funn verifiseres teknisk før de fikses, og pushes tilbake med begrunnelse
i rapporten hvis de er feil. Ikke «du har rett» uten å ha sjekket, og ikke stille implementering
av noe du mener er galt.

## 10. Ferdig-kriterium for et steg

1. Testagenten har levert GRØNT med gyldig resultatfil for siste runde.
2. Reviewer har levert GODKJENT, eller alle åpne funn er parkert med begrunnelse etter runde 5.
3. Kodeagentens sluttrapport er lest; avvik og spørsmål er behandlet. Kallere grafen viste
   utenfor diffen er enten oppdatert eller ført som avgjørelse i ledger.
4. Plan-dokumentets §4-sjekkliste for steget er avkrysset.
5. Hovedagenten har oppdatert §0/§1 og sendt sluttrapport til Thomas med: resultatfil,
   review-vurdering, parkerte funn, og **alle avgjørelser fra ledger** med hva de koster om de
   er feil. En avgjørelse som ikke når Thomas er tatt i det skjulte.
6. Thomas committer. Hash føres inn i §0.1. Deretter kan `.agentteam/<steg>/` slettes.

## 11. Faste regler

- Følg repoets regelfiler: <fyll inn, f.eks. `Docs/AI_WORKFLOW.md`, `Docs/ARCHITECTURE.md`>.
- Dokumentasjon i samme endring som koden. Migrasjon for enhver skjemaendring.
- Kode og kommentarer på norsk.
- Ingen commit, push, deploy eller EAS-bygg fra agenter.
- Ingen agent starter egne subagenter. Review kommer fra hovedagenten, aldri fra den som skrev koden.
- Beslutninger lagres i AgentMemory (`project: <repo>`) av hovedagenten. AgentMemory-signaler
  brukes ikke lenger til koordinering.
