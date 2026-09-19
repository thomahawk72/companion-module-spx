# CLAUDE.md

Companion-modul for SPX Graphics Controller. Dette repoet er en fork av
[bitfocus/companion-module-spx-graphics-controller](https://github.com/bitfocus/companion-module-spx-graphics-controller),
tilpasset SPX Solo 1.4.1, der en rekke API-endepunkter svarer 501 Not Implemented.

Gjeldende arbeid: versjon 2.0.1, se `Docs/PLAN_2.0.1.md`.

## Faste rammer

- Modul-ID er `spx-graphics-controller` og `legacyIds` inneholder `spx-gc`. Endres aldri.
- Ingen eksisterende `actionId` fjernes eller endres. Companion lagrer knapper på
  `actionId`; fjernes en ID, blir knappen stum uten feilmelding.
- Ingen `console.log`. All logging via `this.log(level, message)`.
- Ingen `fetch` uten `await`.
- SPX sin egen kode endres ikke. Referansekopi til oppslag:
  `<sti til din SPX-kildekopi>`.
- Testmiljø: SPX Solo 1.4.1 på `http://127.0.0.1:5656`.

## Agentteam

Bruk agentteam for utviklingsoppgaver når ikke annet er instruert. Protokollen ligger i
`Docs/AGENT_TEAM_PROTOCOL.md` og gjelder alle agenter; spawn-prompter skal peke dit og
være korte (rolle, agent-ID, sti til brief-fil).

- **Modell:** kode-, test- og reviewer-agenter startes med `model: "sonnet"`. Unntak per
  protokollen: fiks-runde 4–5 og sluttreview på `opus`.
- **Koordinering:** agentene snakker ikke med hverandre. Alt går via filer i
  `.agentteam/<steg>/` (brief, rapporter, diff-pakker) og hovedagenten, som kjører én agent
  om gangen: kodeagent → testagent → reviewer.
- **Verifisering:** kun `scripts/verify.sh`. Den låser mot samtidige kjøringer og skriver
  resultatfil med hash. Bare testagenten erklærer GRØNT, og bare med resultatfil.
  Hovedagenten leser filen, kjører ikke suiten selv. `verify.sh focus <testfil>` er
  kodeagentens verktøy for RØD/GRØNN.
- **Kunnskapsgraf:** finnes `graphify-out/graph.json`, kjører hovedagenten `graphify update .`
  før første spawn, og alle agenter spør grafen (`graphify query`, `explain`, `path`) før grep
  og lesing fil for fil. Hver rapport har linjen `GRAF-OPPSLAG:` med output-utdrag (rapport uten avvises) og `SEKVENSIELL:` (sequential thinking ved designvalg, gjentatte feil og Kritisk-funn). INFERRED-kanter
  verifiseres i fil. Protokollens §3b.
- **Kodeagent:** skriver første feilende test for hver ny atferd. Committer aldri.
- **Testagent:** uavhengig dekning. Endrer ikke produksjonskode.
- **Reviewer:** leser diffen mot brief, ikke rapporten. Kritisk/Viktig funn gir fiks-runde.
- Rene utforsknings- og søkeagenter kan bruke standardmodell.
