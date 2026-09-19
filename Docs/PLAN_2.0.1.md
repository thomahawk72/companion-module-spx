# Companion-modul for SPX Solo 1.4.1, versjon 2.0.1 – implementeringsplan

**Mål:** Gjøre `spx-graphics-controller` brukbar mot SPX Solo 1.4.1 igjen, med fungerende
Play/Continue/Stop på et element valgt ved `itemID`, korrekt feilrapportering og
tilkoblingsstatus i Companion.

**Arkitektur:** Fork av Bitfocus' modul med samme modul-ID (`spx-graphics-controller`), bumpet
til 2.0.1, slik at Companion ser den som en oppgradering og eksisterende knapper og tilkobling
på Moses fortsetter å virke. All HTTP-trafikk samles i én liten klient (`src/spx-client.js`)
med `await`, timeout, apikey og feillogging til Companion-loggen. Handlingene som er sperret i
Solo (501) erstattes av sammensatte handlinger som gjør `rundown/focusByID/<id>` og deretter
`item/play|continue|stop` **sekvensielt i én handling**. Alternativ B (socket.io rett til
rendereren) er bevisst utenfor 2.0.1.

**Spec:** `BRIEF_companion-spx-modul.md` (Thomas' brief, 2026-09-18)

## Globale krav

- Modul-ID er `spx-graphics-controller`. Den endres ikke. `legacyIds: ["spx-gc"]` beholdes.
- **`companion/manifest.json` redigeres ikke for versjon.** `version` og `runtime.apiVersion`
  står som `0.0.0` i kilden med vilje: `companion-module-build` injiserer dem ved bygg, fra
  `package.json` og fra installert `@companion-module/base`. Verifisert i P0 — bygget ga
  `version: 2.0.1`, `apiVersion: 1.14.1`, artefakt `spx-graphics-controller-2.0.1.tgz`.
  Versjonen settes altså **kun** i `package.json`.
- Runtime i manifestet er `"type": "node18"`, `"api": "nodejs-ipc"`. Endres ikke i 2.0.1.
- Avhengigheter låses til `@companion-module/base` `~1.14.0` og `@companion-module/tools`
  `^2.8.0`. **Ikke** oppgrader til tools 3.x: den krever `@companion-module/base` ^2.0.0, som
  er en egen migrasjon med egen risiko mot Companion 4.2.6 på Moses. Se § Avgjørelser.
  (Målt i P0: tools 2.8.0 krever `@companion-module/base` `^1.12.0 || ^2.0.0`, så `~1.4.0`
  fra 2.0.0 er ikke installerbart med npm. 1.14.1 er siste i base 1.x og samme
  API-generasjon — `InstanceBase`, `Regex`, `runEntrypoint` — så det er ingen v2-migrasjon.)
- **Ingen eksisterende `actionId` endres eller fjernes.** Companion lagrer knapper på
  `actionId`. Fjernes en ID, blir knappen på Moses stum uten feilmelding. Nye handlinger får
  nye ID-er; gamle beholdes.
- Ingen nye runtime-avhengigheter. `fetch` er global i node18+. `package.json` skal ha tom
  `dependencies` bortsett fra `@companion-module/base`. `yarn`-avhengigheten i dagens
  `package.json` (`"yarn": "^1.22.19"`) fjernes — den er en feil.
- Alle nettverkskall bruker `await` og har timeout via `AbortSignal.timeout(this.timeoutMs)`.
  Ingen `fetch` uten `await` noe sted i modulen.
- Ingen `console.log` eller `console.warn` i modulkode. All logging går gjennom
  `this.log('debug'|'info'|'warn'|'error', ...)`.
- Standard host er `127.0.0.1`, standard port er `'5656'`, standard `apikey` er `''`.
- Ingen `upgrade script` skriver om brukerens eksisterende `host`/`port`/`apikey`. Endret
  standardport gjelder kun nye tilkoblinger.
- Kodestil: tabs for innrykk, ingen semikolon-slutt der upstream ikke har det. `npx prettier`
  med `@companion-module/tools/.prettierrc.json` er fasit; `scripts/verify.sh` kjører den.
- Tester kjøres med node sin innebygde runner (`node --test`). Ingen jest, ingen vitest.
- SPX sin egen kode endres ikke. Referansekopi av SPX 1.4.1 ligger i
  `<sti til din SPX-kildekopi>` og er kun til oppslag.
- Testmiljø: SPX Solo 1.4.1 på `http://127.0.0.1:5656`, kontroller-siden
  `/gc/MyFirstProject/MyFirstRundown` og `/renderer` åpne. Kjent `itemID` for test:
  `1773083297693` (NAME_LEFT, lag 3).

## 0. Status (hovedagent)

### 0.1 Commit-hash per steg

| Steg | Hash | Dato |
|---|---|---|
| P0 | `deb30e4` (formateringsbaseline) + `4fda336` | 2026-09-18 |
| P1 | `1a2f625` | 2026-09-19 |
| P2 | `1a2f625` | 2026-09-19 |
| P3 | `1a2f625` | 2026-09-19 |
| P4 | `1a2f625` | 2026-09-19 |
| P5 | `1a2f625` | 2026-09-19 |
| P6 | `1a2f625` | 2026-09-19 |

P1 til P6 er samlet i én commit, `1a2f625`, etter avtale med Thomas. Opprinnelig var planen
én commit per steg, men agentteam-protokollen ble lagt bort fra og med P5 fordi den var for
tung for et repo på denne størrelsen, og da falt behovet for rene per-steg-differ bort.

### 0.2 Åpne avgjørelser

1. **Standardport 5656 vs 5000.** SPX sin egen standardport er 5000; 5656 er Thomas' oppsett
   fordi AirPlay tar 5000 på macOS. Briefen krever 5656, og planen følger briefen. Skal
   modulen noen gang foreslås tilbake til Bitfocus, må standarden settes tilbake til 5000 i
   den pull requesten. Notert, ikke blokkerende.
2. **Tilbake til Bitfocus?** Ikke avgjort. Planen holder koden ren nok til at det er mulig
   (ingen PK-spesifikke navn, ingen hardkodede stier), men gjør ingen PR.
3. **`@companion-module/base` 2.x.** Utsatt. Egen oppgave etter at 2.0.1 er verifisert på
   Moses.
4. **Alternativ B (socket.io til renderer).** Utenfor 2.0.1. Egen fase, egen plan.

## 1. Fremdrift (hovedagent)

- **P0 ferdig** 2026-09-18, commits `deb30e4` + `4fda336`. Fire antakelser i planen rettet mot
  virkeligheten: base-versjon, manifest-versjonering, `node --test`-syntaks, scope-håndtering
  i `verify.sh`. Se stegets avhukede punkter.
- **P1 ferdig** 2026-09-18, uncommittet. `scripts/verify.sh all` GRØNT med 23 tester.
  Én fiks-runde: `res.text()` lå utenfor try/catch, så klientens «kaster aldri»-garanti holdt
  ikke. Rettet før steget ble lukket, fordi P2–P5 bygger på den garantien.
  Ett åpent Mindre-funn ført i ledger til sluttreview.
- **P2 ferdig** 2026-09-18, uncommittet. `scripts/verify.sh all` GRØNT med 40 tester.
  Tre fiks-runder, 69 tester. Første: kappløp i statuspollingen, løst ved å flytte logikken
  til `src/status-poller.js` med generasjonsteller og in-flight-vakt. Andre og tredje:
  `/api/v1/version` returnerer JSON, ikke en versjonsstreng, og statusmeldingen lekket
  `hostname` og `rootFolder` inn i Companion-UI-et. Begge funn kom fra å kjøre mot ekte SPX,
  ikke fra enhetstester. Se ledger.
- **P3 ferdig** 2026-09-18. Handlingene flyttet til `src/actions.js` og koblet på klienten.
  `spxError` lagt til i `SpxClient`, fordi SPX svarer HTTP 200 med `{error}` ved feil apikey.
  Fire døde malfiler slettet. Reviewer: GODKJENT.
- **P4 ferdig** 2026-09-18. De fem ID-baserte handlingene, med fokus + kommando serialisert i
  én handling. Verifisert mot ekte SPX med kontroller-siden åpen: `play_ID` satte NAME RIGHT
  på lufta, `stop_ID` animerte det ut. Det er problemet briefen beskrev, løst.
- **P5 og P6 ferdig** 2026-09-18, kjørt av hovedagenten uten agentteam etter avtale med Thomas
  — protokollen var for tung for et repo på denne størrelsen. `directplayout` og
  `invokeTemplateFunction` gjenopprettet og reparert, integrasjonstester mot ekte SPX,
  HELP.md, README, manuell testprotokoll og bygg. 103 enhetstester, 7 integrasjonstester.

## Filstruktur

Repoet ligger i `<repo>`,
klonet fra `https://github.com/bitfocus/companion-module-spx-graphics-controller.git` slik at
historikken er intakt, med egen branch `spx-solo-2.0.1`.

| Fil | Ansvar |
|---|---|
| `main.js` | Companion-instansen: `init`, `destroy`, `configUpdated`, `getConfigFields`, statuspolling. Ingen HTTP-detaljer, ingen handlingsdefinisjoner. |
| `src/spx-client.js` | **Ny.** All HTTP mot SPX: URL-bygging, apikey, timeout, `await`, tolkning av 501, feil til logg. Ingen Companion-avhengighet utenom en injisert `log`-funksjon. |
| `src/actions.js` | **Ny.** Alle handlingsdefinisjoner og callbacks. Erstatter dagens `actions.js` i rot. |
| `actions.js` (rot) | **Slettes.** Innholdet flyttes til `src/actions.js`. |
| `feedbacks.js` | **Slettes.** Ren mal-kode (`ChannelState`, «Hello world!»), aldri registrert fra `main.js`. |
| `presets.js` | **Slettes.** Companion 2-format, kommentert ut i `main.js`, dødt. |
| `variables.js` | **Slettes.** Tom funksjon uten effekt. |
| `upgrades.js` | Beholdes med tom liste og en kommentar om hvorfor 2.0.1 ikke legger til noe. |
| `companion/manifest.json` | Modulidentitet. Versjonsfeltene står som `0.0.0` og fylles av bygget. |
| `companion/HELP.md` | Skrives om: hva som virker i Solo, hva som krever Production/Broadcast. |
| `README.md` | Kort: hva forken er, hvorfor, hvordan bygge og installere. |
| `Docs/AGENT_TEAM_PROTOCOL.md` | Fra `agentteam`-bootstrap. |
| `Docs/MANUELL_TEST.md` | **Ny.** Manuell testprotokoll mot kjørende SPX og renderer. |
| `scripts/verify.sh`, `scripts/verify.conf` | Fra bootstrap, tilpasset dette repoet. |
| `src/__tests__/spx-client.unit.test.js` | Enhetstester for URL-bygging, apikey, 501, timeout, feillogging. |
| `src/__tests__/actions.unit.test.js` | Enhetstester for handlingsdefinisjoner og sekvensiell rekkefølge. |
| `src/__integration__/integration.spx.test.js` | Integrasjonstester mot SPX på 127.0.0.1:5656. Egen scope i `verify.sh`, utenfor `all`. |
| `src/status.js` | **Ny i P2.** Ren `evaluateStatus(res)`, ingen I/O. |
| `src/status-poller.js` | **Ny i P2 (fiks-runde).** `StatusPoller` med generasjonsteller og in-flight-vakt. Gjør kappløpet i statuspollingen testbart. |
| `src/__tests__/manifest.unit.test.js` | Vakthund på modul-ID, `legacyIds` og runtime. Laget i P0. |
| `CLAUDE.md` | Repoets faste rammer + agentteam-avsnittet. |
| `.prettierignore` | Holder `Docs/` og genererte mapper utenfor lint. |

---

### P0: Repo, verktøykjede og verifikasjon ✅ FERDIG

**Filer:**
- Lag: `<repo>/` (git-klon)
- Lag: `Docs/AGENT_TEAM_PROTOCOL.md`, `scripts/verify.sh`, `scripts/verify.conf`
- Endre: `package.json`
- Endre: `.gitignore`

**Grensesnitt:**
- Bruker: ingenting.
- Leverer: `scripts/verify.sh all` og `scripts/verify.sh focus <testfil>` fungerer og skriver
  resultatfil. Scopene heter `lint`, `unit`, `build`, `integration`.

- [x] **1. Klon og branch**

```bash
cd <din kodemappe>
git clone https://github.com/bitfocus/companion-module-spx-graphics-controller.git \
  companion-module-spx-graphics-controller
cd companion-module-spx-graphics-controller
git checkout -b spx-solo-2.0.1
mv <repo>/Docs/PLAN_2.0.1.md \
   /tmp/PLAN_2.0.1.md 2>/dev/null || true
mkdir -p Docs && mv /tmp/PLAN_2.0.1.md Docs/PLAN_2.0.1.md 2>/dev/null || true
```

Klonen legges i samme mappe som planen allerede ligger i. Er mappen ikke tom, klon til
`../tmp-clone` og flytt `.git` og filene inn manuelt slik at `Docs/PLAN_2.0.1.md` overlever.

- [x] **2. Rydd `package.json`**

```json
{
	"name": "spx-graphics-controller",
	"version": "2.0.1",
	"main": "./main.js",
	"type": "commonjs",
	"scripts": {
		"format": "prettier -w .",
		"lint": "prettier --check .",
		"test": "node --test src/__tests__/*.unit.test.js",
		"test:integration": "node --test src/__tests__/integration.spx.test.js",
		"build": "companion-module-build"
	},
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "git+https://github.com/bitfocus/companion-module-spx-graphics-controller.git"
	},
	"dependencies": {
		"@companion-module/base": "~1.14.0"
	},
	"devDependencies": {
		"@companion-module/tools": "^2.8.0"
	},
	"prettier": "@companion-module/tools/.prettierrc.json"
}
```

Merk: `"name"` rettes fra skrivefeilen `spx-grapics-controller`. Det er trygt — Companion
leser identiteten fra `companion/manifest.json`, ikke fra `package.json`.

- [x] **3. Bootstrap agentteam**

```bash
~/.claude/skills/agentteam/scripts/bootstrap.sh
```

Legg deretter `~/.claude/skills/agentteam/CLAUDE_AVSNITT.md` inn i repoets `CLAUDE.md`.

- [x] **4. `scripts/verify.conf`**

`bootstrap.sh` legger inn en mal med et annet format enn først antatt: `verify.sh` leser
`SCOPES` og kaller `verify_<scope>`-funksjoner, og `all` kjører **alle** scopes i `SCOPES`.
Integrasjonstesten må derfor holdes utenfor listen. `verify.sh` setter `$SCOPE` før
`verify.conf` sources, så listen kan byttes i konfigen uten å endre `verify.sh`:

```bash
SCOPES="lint unit build"
[ "${SCOPE:-all}" = integration ] && SCOPES="integration"

verify_lint() { run "prettier --check" "$ROOT" npx prettier --check . ; }
verify_unit() { run "unit tests" "$ROOT" node --test "src/__tests__/*.unit.test.js" ; }
verify_build() { run "companion-module-build" "$ROOT" npx companion-module-build ; }

verify_integration() {
  run "SPX svarer på 127.0.0.1:5656" "$ROOT" \
    curl -sf -m 5 -o /dev/null http://127.0.0.1:5656/api/v1/version
  run "integration tests" "$ROOT" node --test "src/__integration__/*.spx.test.js"
}

focus_cmd() {
  local abs="$1"
  case "$abs" in
    "$ROOT/src/"*) run "focus $(basename "$abs")" "$ROOT" node --test "$abs" ;;
    *) return 1 ;;
  esac
}
```

`verify.sh` kaller node uten skall, så glob-mønsteret sendes i hermetegn og ekspanderes av
node selv. Det krever Node 20+ på utviklermaskinen. `node --test <mappe>` ble prøvd først og
feiler på Node 24 med `MODULE_NOT_FOUND`; glob virker.

- [x] **5. Verifiser verktøykjeden**

Kjørt: `npm install && scripts/verify.sh all`
Resultat: `lint`, `unit` og `build` alle GRØNT, og `scripts/verify.sh focus` virker.

Underveis, og rettet:
- `npm install` feilet på `@companion-module/base` `~1.4.0` mot tools 2.8.0. Løst ved
  `~1.14.0`, se Globale krav.
- `npx prettier --check .` feilet på ni filer fra upstream, som aldri er formatert. Kjørt
  `npx prettier -w .` én gang som formateringsbaseline. Det gir støy i diffen mot upstream,
  og bør holdes som egen commit.
- `unit` feilet fordi `src/__tests__/` var tom. Laget
  `src/__tests__/manifest.unit.test.js`, som vokter modul-ID, `legacyIds` og runtime — de
  invariantene som knekker alle eksisterende knapper i Companion hvis de endres.
- `companion-module-build` virker på Node 24.3.0. `fnm`/Node 18 er ikke nødvendig.
  tools 2.8.0 varsler `EBADENGINE` (vil ha 18.18 eller 22.18), men bygget går gjennom.

- [x] **6. `.gitignore`**

`bootstrap.sh` la til `.verify/`, `.agentteam/` og `graphify-out/`, men upstreams `.gitignore`
manglet avsluttende linjeskift, så siste linje `/pkg` og `.verify/` smeltet sammen til
`/pkg.verify/`. Fila er skrevet om i sin helhet:

```
node_modules/
/pkg
pkg/
*.tgz
pkg.tgz
.DS_Store
companion-module-spx.code-workspace
.verify/
.agentteam/
graphify-out/
```

`package-lock.json` var ignorert av upstream, som brukte yarn. Den spores nå, slik at bygget
som legges på Moses er reproduserbart. `yarn.lock` er slettet.

`.prettierignore` er lagt til, slik at `Docs/` (plan, protokoll, teknikker) ikke
formateres av prettier.

- [x] **7. Dokumentasjon**

`README.md` skrevet om: hva forken er, krav (Node 20+ for tester), bygg og installasjon med
de faktiske kommandoene, konfigurasjonstabell og bruk av `verify.sh`.
`CLAUDE.md` laget med repoets faste rammer og agentteam-avsnittet fra skillen.

---

### P1: Konfigurasjon og HTTP-klient ✅ FERDIG

**Filer:**
- Lag: `src/spx-client.js`
- Lag: `src/__tests__/spx-client.unit.test.js`
- Endre: `main.js` (`getConfigFields`, `init`, `configUpdated`)

**Grensesnitt:**
- Bruker: ingenting fra tidligere steg.
- Leverer:
  - `class SpxClient` fra `src/spx-client.js`, konstruktør
    `new SpxClient({ host, port, apikey, timeoutMs, log })` der `log` er
    `(level, message) => void`.
  - `client.buildUrl(path, query = {})` → `string`. `path` er uten ledende skråstrek og uten
    `/api/v1/`, f.eks. `'item/play'`.
  - `async client.get(path, query = {})` → `{ ok, status, body, url }` der `body` er tekst.
    Kaster aldri; nettverksfeil gir `{ ok: false, status: 0, body: '<feilmelding>', url }`.
  - `async client.post(path, bodyObject)` → samme returtype.
  - `SpxClient.NOT_IN_SOLO = 501`.
- Senere steg bruker kun disse navnene.

- [ ] **1. Skriv den feilende testen**

`src/__tests__/spx-client.unit.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { SpxClient } = require('../spx-client')

function makeClient(overrides = {}) {
	const logged = []
	const client = new SpxClient({
		host: '127.0.0.1',
		port: '5656',
		apikey: '',
		timeoutMs: 5000,
		log: (level, message) => logged.push([level, message]),
		...overrides,
	})
	return { client, logged }
}

test('buildUrl setter sammen host, port og sti uten apikey', () => {
	const { client } = makeClient()
	assert.strictEqual(client.buildUrl('item/play'), 'http://127.0.0.1:5656/api/v1/item/play')
})

test('buildUrl legger på apikey når den er satt', () => {
	const { client } = makeClient({ apikey: 'hemmelig' })
	assert.strictEqual(
		client.buildUrl('item/play'),
		'http://127.0.0.1:5656/api/v1/item/play?apikey=hemmelig',
	)
})

test('buildUrl URL-koder query-verdier', () => {
	const { client } = makeClient()
	assert.strictEqual(
		client.buildUrl('rundown/load', { file: 'My Project/My Rundown' }),
		'http://127.0.0.1:5656/api/v1/rundown/load?file=My+Project%2FMy+Rundown',
	)
})

test('get returnerer ok:false og logger error ved nettverksfeil', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => {
			throw new Error('ECONNREFUSED')
		},
	})
	const res = await client.get('item/play')
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 0)
	assert.match(res.body, /ECONNREFUSED/)
	assert.ok(logged.some(([level]) => level === 'error'))
})

test('get logger warn med forklarende tekst ved 501 fra Solo', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => ({
			ok: false,
			status: 501,
			text: async () => '{"status":501,"message":"Not Implemented"}',
		}),
	})
	const res = await client.get('item/play/123')
	assert.strictEqual(res.status, 501)
	const warn = logged.find(([level]) => level === 'warn')
	assert.ok(warn, 'forventet en warn-linje')
	assert.match(warn[1], /SPX Solo/)
})

test('get sender AbortSignal med timeout', async () => {
	let sawSignal = false
	const { client } = makeClient({
		fetchImpl: async (_url, init) => {
			sawSignal = init && init.signal instanceof AbortSignal
			return { ok: true, status: 200, text: async () => 'OK' }
		},
	})
	await client.get('version')
	assert.strictEqual(sawSignal, true)
})
```

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus src/__tests__/spx-client.unit.test.js`
Forventet: FEIL med «Cannot find module '../spx-client'».

- [ ] **3. Minimal implementasjon**

`src/spx-client.js`:

```js
const NOT_IN_SOLO = 501

class SpxClient {
	constructor({ host, port, apikey, timeoutMs, log, fetchImpl }) {
		this.host = host
		this.port = String(port)
		this.apikey = apikey || ''
		this.timeoutMs = timeoutMs || 5000
		this.log = log || (() => {})
		this.fetchImpl = fetchImpl || ((url, init) => fetch(url, init))
	}

	buildUrl(path, query = {}) {
		const params = new URLSearchParams(query)
		if (this.apikey) {
			params.set('apikey', this.apikey)
		}
		const qs = params.toString()
		const base = `http://${this.host}:${this.port}/api/v1/${path}`
		return qs ? `${base}?${qs}` : base
	}

	async request(path, { method = 'GET', query = {}, body = undefined } = {}) {
		const url = this.buildUrl(path, query)
		const init = { method, signal: AbortSignal.timeout(this.timeoutMs) }
		if (body !== undefined) {
			init.body = JSON.stringify(body)
			init.headers = { 'Content-Type': 'application/json' }
		}
		this.log('debug', `${method} ${url}`)
		let res
		try {
			res = await this.fetchImpl(url, init)
		} catch (err) {
			const message = err && err.message ? err.message : String(err)
			this.log('error', `SPX request failed: ${method} ${url} — ${message}`)
			return { ok: false, status: 0, body: message, url }
		}
		const text = await res.text()
		if (res.status === NOT_IN_SOLO) {
			this.log(
				'warn',
				`SPX returned 501 for ${path}. This endpoint is not available in SPX Solo ` +
					`and requires SPX Production or Broadcast. Use the "by ID" actions instead.`,
			)
		} else if (!res.ok) {
			this.log('warn', `SPX returned ${res.status} for ${path}: ${text}`)
		} else {
			this.log('debug', `SPX ${res.status}: ${text}`)
		}
		return { ok: res.ok, status: res.status, body: text, url }
	}

	async get(path, query = {}) {
		return this.request(path, { method: 'GET', query })
	}

	async post(path, body) {
		return this.request(path, { method: 'POST', body })
	}
}

SpxClient.NOT_IN_SOLO = NOT_IN_SOLO

module.exports = { SpxClient, NOT_IN_SOLO }
```

- [ ] **4. Kjør og se at den passerer**

Kjør: `scripts/verify.sh focus src/__tests__/spx-client.unit.test.js`
Forventet: PASS, 6 tester.

- [ ] **5. Konfigurasjonsfelt i `main.js`**

Erstatt hele `getConfigFields()` i `main.js`:

```js
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Controls SPX Graphics Controller over its HTTP API. ' +
					'Several endpoints are only available with an SPX Production or ' +
					'Broadcast license; the "by ID" actions work around this on SPX Solo.',
			},
			{
				type: 'textinput',
				label: 'Target IP',
				id: 'host',
				width: 6,
				regex: Regex.IP,
				default: '127.0.0.1',
				required: true,
			},
			{
				type: 'textinput',
				label: 'Target port',
				id: 'port',
				width: 6,
				regex: Regex.PORT,
				default: '5656',
				required: true,
			},
			{
				type: 'textinput',
				label: 'API key (leave empty if SPX has no apikey set)',
				id: 'apikey',
				width: 12,
				default: '',
			},
			{
				type: 'number',
				label: 'Request timeout (ms)',
				id: 'timeout',
				width: 6,
				min: 500,
				max: 30000,
				default: 5000,
			},
		]
	}
```

To feil rettes samtidig: `this.REGEX_IP` og `this.REGEX_PORT` finnes ikke på instansen i
`@companion-module/base` 1.x, det skal være `Regex.IP` og `Regex.PORT` fra importen øverst i
`main.js` (den er allerede der, men ubrukt). Og `type: 'text'` er ikke et gyldig felttype-navn
i base 1.4 — det skal være `static-text`.

- [ ] **6. Klient bygges i `init` og `configUpdated`**

I `main.js`, legg til metoden og kall den begge steder:

```js
	buildClient() {
		this.client = new SpxClient({
			host: this.config.host,
			port: this.config.port,
			apikey: this.config.apikey,
			timeoutMs: this.config.timeout,
			log: (level, message) => this.log(level, message),
		})
	}
```

`async init(config)` setter `this.config = config`, kaller `this.buildClient()` og deretter
`this.initActions()`. `async configUpdated(config)` setter `this.config = config` og kaller
`this.buildClient()`.

- [ ] **7. Dokumentasjon**

`README.md`: seksjon «Configuration» som forklarer at porten er 5656 i PK sitt oppsett og 5000
i SPX sin egen standardinstallasjon, og at `apikey` må stå tomt hvis SPX ikke har satt en.

---

### P2: Tilkoblingsstatus ✅ FERDIG

**Filer:**
- Endre: `main.js`
- Lag: `src/__tests__/status.unit.test.js`

**Grensesnitt:**
- Bruker: `SpxClient` fra P1, `client.get('version')`.
- Leverer: `async this.pollStatus()` på instansen, og `this.statusTimer` som ryddes i
  `destroy()`.

- [ ] **1. Skriv den feilende testen**

`src/__tests__/status.unit.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { evaluateStatus } = require('../status')

test('200 fra version gir Ok', () => {
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body: '1.4.1' }), {
		status: 'ok',
		message: 'SPX 1.4.1',
	})
})

test('nettverksfeil gir ConnectionFailure med feilteksten', () => {
	assert.deepStrictEqual(
		evaluateStatus({ ok: false, status: 0, body: 'ECONNREFUSED' }),
		{ status: 'connection_failure', message: 'ECONNREFUSED' },
	)
})

test('401 gir BadConfig med hint om apikey', () => {
	const res = evaluateStatus({ ok: false, status: 401, body: 'Unauthorized' })
	assert.strictEqual(res.status, 'bad_config')
	assert.match(res.message, /API key/)
})

test('annen HTTP-feil gir UnknownWarning', () => {
	const res = evaluateStatus({ ok: false, status: 500, body: 'boom' })
	assert.strictEqual(res.status, 'unknown_warning')
	assert.match(res.message, /500/)
})
```

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus src/__tests__/status.unit.test.js`
Forventet: FEIL med «Cannot find module '../status'».

- [ ] **3. Minimal implementasjon**

`src/status.js`:

```js
function evaluateStatus(res) {
	if (res.ok) {
		return { status: 'ok', message: `SPX ${String(res.body).trim()}` }
	}
	if (res.status === 0) {
		return { status: 'connection_failure', message: res.body }
	}
	if (res.status === 401 || res.status === 403) {
		return {
			status: 'bad_config',
			message: 'SPX rejected the request. Check the API key in the module config.',
		}
	}
	return { status: 'unknown_warning', message: `SPX responded ${res.status}: ${res.body}` }
}

module.exports = { evaluateStatus }
```

I `main.js`:

```js
	async pollStatus() {
		const res = await this.client.get('version')
		const verdict = evaluateStatus(res)
		const map = {
			ok: InstanceStatus.Ok,
			connection_failure: InstanceStatus.ConnectionFailure,
			bad_config: InstanceStatus.BadConfig,
			unknown_warning: InstanceStatus.UnknownWarning,
		}
		this.updateStatus(map[verdict.status], verdict.message)
	}

	startStatusPolling() {
		this.stopStatusPolling()
		this.pollStatus()
		this.statusTimer = setInterval(() => this.pollStatus(), 10000)
	}

	stopStatusPolling() {
		if (this.statusTimer) {
			clearInterval(this.statusTimer)
			this.statusTimer = undefined
		}
	}
```

`init` setter `this.updateStatus(InstanceStatus.Connecting)` før `startStatusPolling()`.
`destroy()` kaller `this.stopStatusPolling()`. `configUpdated` kaller `startStatusPolling()`
etter `buildClient()`.

- [ ] **4. Kjør og se at den passerer**

Kjør: `scripts/verify.sh focus src/__tests__/status.unit.test.js`
Forventet: PASS, 4 tester.

- [ ] **5. Dokumentasjon**

`companion/HELP.md`: én linje om at modulen poller `/api/v1/version` hvert 10. sekund og setter
tilkoblingsstatus deretter.

---

### P3: Handlingene som virker i SPX Solo ✅ FERDIG

**Filer:**
- Lag: `src/actions.js`
- Slett: `actions.js`, `feedbacks.js`, `presets.js`, `variables.js`
- Endre: `main.js` (importer fra `./src/actions`, fjern import av slettede filer)
- Lag: `src/__tests__/actions.unit.test.js`

**Grensesnitt:**
- Bruker: `SpxClient` fra P1 via `self.client`.
- Leverer: `getActionDefinitions(self)` fra `src/actions.js` → objekt med `actionId` som
  nøkler. `main.js` kaller `this.setActionDefinitions(getActionDefinitions(this))`.
- Handlings-ID-er i dette steget, uendret fra 2.0.0: `play`, `continue`, `stop`, `focusFirst`,
  `focusNext`, `focusPrevious`, `focusLast`, `stopAllLayers`, `openRundown`.

- [ ] **1. Skriv den feilende testen**

`src/__tests__/actions.unit.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { getActionDefinitions } = require('../actions')

function makeSelf() {
	const calls = []
	const self = {
		logged: [],
		log: (level, message) => self.logged.push([level, message]),
		client: {
			get: async (path, query = {}) => {
				calls.push({ path, query })
				return { ok: true, status: 200, body: 'OK' }
			},
		},
	}
	return { self, calls }
}

test('alle handlings-ID-ene fra 2.0.0 finnes fortsatt', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	for (const id of [
		'play',
		'play_ID',
		'continue',
		'continue_ID',
		'stop',
		'stop_ID',
		'focusFirst',
		'focusNext',
		'focusPrevious',
		'focusLast',
		'stopAllLayers',
		'openRundown',
		'controlRundownItem',
		'directplayout',
		'invokeTemplateFunction',
	]) {
		assert.ok(actions[id], `mangler actionId ${id}`)
	}
})

test('play kaller item/play', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play.callback({ actionId: 'play', options: {} })
	assert.deepStrictEqual(calls, [{ path: 'item/play', query: {} }])
})

test('stopAllLayers kaller rundown/stopAllLayers', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).stopAllLayers.callback({
		actionId: 'stopAllLayers',
		options: {},
	})
	assert.strictEqual(calls[0].path, 'rundown/stopAllLayers')
})

test('openRundown sender file som query, ikke som del av stien', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).openRundown.callback({
		actionId: 'openRundown',
		options: { rundown: 'MyFirstProject/MyFirstRundown' },
	})
	assert.deepStrictEqual(calls, [
		{ path: 'rundown/load', query: { file: 'MyFirstProject/MyFirstRundown' } },
	])
})

test('focus-handlingene treffer riktige endepunkt', async () => {
	const forventet = {
		focusFirst: 'rundown/focusFirst',
		focusNext: 'rundown/focusNext',
		focusPrevious: 'rundown/focusPrevious',
		focusLast: 'rundown/focusLast',
	}
	for (const [id, path] of Object.entries(forventet)) {
		const { self, calls } = makeSelf()
		await getActionDefinitions(self)[id].callback({ actionId: id, options: {} })
		assert.strictEqual(calls[0].path, path, `${id} traff feil endepunkt`)
	}
})
```

Testen for de 15 ID-ene passerer først etter P4. I dette steget skal den feile på
`play_ID`, `controlRundownItem`, `directplayout` og `invokeTemplateFunction` — det er
forventet, og `verify.sh unit` skal derfor ikke erklæres grønt før P4 er ferdig. Kjør bare
denne filen med `focus` i P3, og noter i resultatfilen hvilke tester som venter på P4.

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: FEIL med «Cannot find module '../actions'».

- [ ] **3. Minimal implementasjon**

`src/actions.js`:

```js
function simpleAction(self, name, path, description) {
	return {
		name,
		description,
		options: [],
		callback: async () => {
			await self.client.get(path)
		},
	}
}

function getActionDefinitions(self) {
	const actions = {}

	actions.play = simpleAction(self, 'Start focused item', 'item/play')
	actions.continue = simpleAction(self, 'Continue focused item', 'item/continue')
	actions.stop = simpleAction(self, 'Stop focused item', 'item/stop')
	actions.focusFirst = simpleAction(self, 'Focus on the first item', 'rundown/focusFirst')
	actions.focusNext = simpleAction(self, 'Focus on the next item', 'rundown/focusNext')
	actions.focusPrevious = simpleAction(
		self,
		'Focus on the previous item',
		'rundown/focusPrevious',
	)
	actions.focusLast = simpleAction(self, 'Focus on the last item', 'rundown/focusLast')
	actions.stopAllLayers = simpleAction(self, 'Stop all layers', 'rundown/stopAllLayers')

	actions.openRundown = {
		name: 'Open rundown',
		options: [
			{
				type: 'textinput',
				label: 'project/file',
				id: 'rundown',
				default: 'MyFirstProject/MyFirstRundown',
				useVariables: true,
			},
		],
		callback: async (action, context) => {
			const rundown = await context.parseVariablesInString(String(action.options.rundown ?? ''))
			await self.client.get('rundown/load', { file: rundown })
		},
	}

	return actions
}

module.exports = { getActionDefinitions }
```

`context.parseVariablesInString` finnes i `@companion-module/base` 1.4. Testen over kaller
callback uten `context`; legg derfor inn en `context`-mock i testen for `openRundown`:

```js
const context = { parseVariablesInString: async (s) => s }
```

og send den som andre argument. Rett testen tilsvarende før implementasjonen skrives.

Én feil i 2.0.0 rettes her: `rundown/load?file=${opt.rundown}` bygde URL-en med rå
strenginterpolasjon, så et prosjektnavn med mellomrom eller `&` ødela kallet. Nå går verdien
gjennom `URLSearchParams`.

- [ ] **4. Slett de døde filene og koble `main.js`**

```bash
git rm actions.js feedbacks.js presets.js variables.js
```

`main.js` mister `Object.assign(this, {...actions, ...feedbacks, ...variables})` i
konstruktøren og metodene `updateActions`, `updateFeedbacks`, `updateVariableDefinitions` (de
kaller udefinerte `UpdateActions`/`UpdateFeedbacks`/`UpdateVariableDefinitions` og ville kastet
`ReferenceError` om noen kalte dem). `init` kaller i stedet:

```js
		this.setActionDefinitions(getActionDefinitions(this))
```

- [ ] **5. Kjør og se at de passerer**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: testene `play`, `stopAllLayers`, `openRundown` og `focus`-testen PASSER. Testen
«alle handlings-ID-ene fra 2.0.0 finnes fortsatt» FEILER fortsatt, og gjør det til P4 er
ferdig.

- [ ] **6. Dokumentasjon**

`companion/HELP.md`: seksjon «Works on SPX Solo» med disse ni handlingene.

---

### P4: Handlinger for element valgt ved ID ✅ FERDIG

**Filer:**
- Endre: `src/actions.js`
- Endre: `src/__tests__/actions.unit.test.js`

**Grensesnitt:**
- Bruker: `getActionDefinitions(self)` og `self.client.get(path, query)` fra P3.
- Leverer: handlings-ID-ene `focusByID` (ny), og omskrevne `play_ID`, `continue_ID`,
  `stop_ID` som gjør to sekvensielle kall. `controlRundownItem` beholder sin ID og gjør
  `rundown/load` → `rundown/focusByID/<id>` → kommando.

**Hvorfor sekvensielt i én handling:** `rundown/focusByID/:id` og `item/play` er to separate
HTTP-kall som begge ender i `io.emit('SPXMessage2Controller', ...)` på SPX-serveren
(`routes/routes-api-v1.js:664` og `:600`). Socket.io leverer i rekkefølge på én tilkobling, og
`focusRow()` på kontroller-siden (`static/js/spx_gc.js:1213`) er synkron. Serialiseres kallene,
er rekkefølgen dermed garantert. Avfyres de parallelt, avgjør serveren rekkefølgen, og målingen
i briefen viste 4 av 5 riktige. To Companion-handlinger på samme knapp gir ingen slik garanti.
Derfor må begge kall ligge i **én** handling med `await` på det første.

- [ ] **1. Skriv den feilende testen**

Legg til i `src/__tests__/actions.unit.test.js`:

```js
test('play_ID fokuserer først, spiller etterpå, i den rekkefølgen', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play_ID.callback(
		{ actionId: 'play_ID', options: { id: '1773083297693' } },
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(calls, [
		{ path: 'rundown/focusByID/1773083297693', query: {} },
		{ path: 'item/play', query: {} },
	])
})

test('continue_ID og stop_ID bruker samme mønster', async () => {
	for (const [id, andreKall] of [
		['continue_ID', 'item/continue'],
		['stop_ID', 'item/stop'],
	]) {
		const { self, calls } = makeSelf()
		await getActionDefinitions(self)[id].callback(
			{ actionId: id, options: { id: '42' } },
			{ parseVariablesInString: async (s) => s },
		)
		assert.deepStrictEqual(calls, [
			{ path: 'rundown/focusByID/42', query: {} },
			{ path: andreKall, query: {} },
		])
	}
})

test('play_ID avbryter og logger error hvis fokus-kallet feiler', async () => {
	const { self } = makeSelf()
	const calls = []
	self.client.get = async (path) => {
		calls.push(path)
		return path.startsWith('rundown/focusByID')
			? { ok: false, status: 0, body: 'ECONNREFUSED' }
			: { ok: true, status: 200, body: 'OK' }
	}
	await getActionDefinitions(self).play_ID.callback(
		{ actionId: 'play_ID', options: { id: '42' } },
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(calls, ['rundown/focusByID/42'], 'skulle ikke ha sendt play-kallet')
	assert.ok(self.logged.some(([level]) => level === 'error'))
})

test('focusByID finnes som egen handling', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).focusByID.callback(
		{ actionId: 'focusByID', options: { id: '99' } },
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(calls, [{ path: 'rundown/focusByID/99', query: {} }])
})

test('play_ID URL-koder ID-en', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play_ID.callback(
		{ actionId: 'play_ID', options: { id: 'a b/c' } },
		{ parseVariablesInString: async (s) => s },
	)
	assert.strictEqual(calls[0].path, 'rundown/focusByID/a%20b%2Fc')
})

test('controlRundownItem laster rundown, fokuserer og kommanderer i rekkefølge', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).controlRundownItem.callback(
		{
			actionId: 'controlRundownItem',
			options: { file: 'MyFirstProject/MyFirstRundown', id: '42', command: 'stop' },
		},
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(calls, [
		{ path: 'rundown/load', query: { file: 'MyFirstProject/MyFirstRundown' } },
		{ path: 'rundown/focusByID/42', query: {} },
		{ path: 'item/stop', query: {} },
	])
})
```

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: FEIL med «Cannot read properties of undefined (reading 'callback')» for `play_ID`
og `focusByID`.

- [ ] **3. Minimal implementasjon**

Legg til i `src/actions.js`, før `return actions`:

```js
const ID_OPTION = {
	type: 'textinput',
	label: 'Item ID (the itemID/epoch of the rundown item)',
	id: 'id',
	default: '0123456789',
	useVariables: true,
}

async function focusThen(self, context, rawId, commandPath, label) {
	const id = await context.parseVariablesInString(String(rawId ?? ''))
	if (!id.trim()) {
		self.log('error', `${label}: no item ID given`)
		return
	}
	const focus = await self.client.get(`rundown/focusByID/${encodeURIComponent(id.trim())}`)
	if (!focus.ok) {
		self.log('error', `${label}: focusByID failed (${focus.status}), not sending the command`)
		return
	}
	await self.client.get(commandPath)
}
```

og handlingene:

```js
	actions.focusByID = {
		name: 'Focus item by ID',
		description: 'Moves the rundown focus to the item with the given itemID.',
		options: [ID_OPTION],
		callback: async (action, context) => {
			const id = await context.parseVariablesInString(String(action.options.id ?? ''))
			if (!id.trim()) {
				self.log('error', 'Focus item by ID: no item ID given')
				return
			}
			await self.client.get(`rundown/focusByID/${encodeURIComponent(id.trim())}`)
		},
	}

	actions.play_ID = {
		name: 'Start item by ID',
		description:
			'Focuses the item by ID and then starts it. Two sequential API calls, ' +
			'because item/play/:id is not available in SPX Solo. ' +
			'Requires the SPX controller page to be open on the rundown containing the item.',
		options: [ID_OPTION],
		callback: async (action, context) =>
			focusThen(self, context, action.options.id, 'item/play', 'Start item by ID'),
	}

	actions.continue_ID = {
		name: 'Continue item by ID',
		description:
			'Focuses the item by ID and then continues it. Two sequential API calls, ' +
			'because item/continue/:id is not available in SPX Solo.',
		options: [ID_OPTION],
		callback: async (action, context) =>
			focusThen(self, context, action.options.id, 'item/continue', 'Continue item by ID'),
	}

	actions.stop_ID = {
		name: 'Stop item by ID',
		description:
			'Focuses the item by ID and then stops it. Two sequential API calls, ' +
			'because item/stop/:id is not available in SPX Solo.',
		options: [ID_OPTION],
		callback: async (action, context) =>
			focusThen(self, context, action.options.id, 'item/stop', 'Stop item by ID'),
	}

	actions.controlRundownItem = {
		name: 'Play/Stop/Continue an item from a known rundown',
		description:
			'Opens the rundown, focuses the item by ID and sends the command. ' +
			'Three sequential API calls, because controlRundownItemByID is not ' +
			'available in SPX Solo. Opening a rundown reloads the controller page, ' +
			'so allow time for it before the next button press.',
		options: [
			{
				type: 'textinput',
				label: 'Project/file',
				id: 'file',
				default: 'MyFirstProject/MyFirstRundown',
				useVariables: true,
			},
			ID_OPTION,
			{
				type: 'dropdown',
				label: 'Action',
				id: 'command',
				choices: [
					{ id: 'play', label: 'Play' },
					{ id: 'stop', label: 'Stop' },
					{ id: 'continue', label: 'Continue' },
				],
				default: 'play',
			},
		],
		callback: async (action, context) => {
			const file = await context.parseVariablesInString(String(action.options.file ?? ''))
			const load = await self.client.get('rundown/load', { file })
			if (!load.ok) {
				self.log('error', `Control rundown item: rundown/load failed (${load.status})`)
				return
			}
			const command = `item/${action.options.command}`
			await focusThen(self, context, action.options.id, command, 'Control rundown item')
		},
	}
```

- [ ] **4. Kjør og se at de passerer**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: alle tester PASSER bortsett fra «alle handlings-ID-ene fra 2.0.0 finnes fortsatt»,
som fortsatt mangler `directplayout` og `invokeTemplateFunction` — de kommer i P5.

- [ ] **5. Dokumentasjon**

`companion/HELP.md`: seksjon «Playback by item ID» som forklarer hvor `itemID` finnes
(`DATAROOT/<prosjekt>/data/<rundown>.json`, feltet `itemID`), og at kontroller-siden må stå
åpen på riktig rundown.

---

### P5: Endepunkter som er sperret i Solo ✅ FERDIG

**Filer:**
- Endre: `src/actions.js`
- Endre: `src/__tests__/actions.unit.test.js`
- Endre: `upgrades.js`

**Grensesnitt:**
- Bruker: `self.client.get` og `self.client.post` fra P1.
- Leverer: handlings-ID-ene `directplayout` og `invokeTemplateFunction`, begge merket
  «Production/Broadcast» i navnet.

`directplayout` og `invokeTemplateFunction` gir 501 på Solo, men er gyldige på Production og
Broadcast. De beholdes fordi ID-ene ikke kan fjernes uten å knekke eksisterende knapper, og
fordi de to i dag er direkte ødelagte i koden: `invokeTemplateFunction` leser
`playserver`, `playchannel`, `playlayer`, `webplayout`, `customfunction` og `params` som frie
variabler i stedet for fra `opt`, og kaster `ReferenceError` uansett lisens.
`directplayout` sender `JSON.stringify(opt.body)` av en streng, altså en JSON-streng i
anførselstegn, ikke et objekt.

- [ ] **1. Skriv den feilende testen**

Legg til i `src/__tests__/actions.unit.test.js`:

```js
test('invokeTemplateFunction leser alle felter fra options', async () => {
	const { self } = makeSelf()
	const seen = []
	self.client.get = async (path, query) => {
		seen.push({ path, query })
		return { ok: true, status: 200, body: 'OK' }
	}
	await getActionDefinitions(self).invokeTemplateFunction.callback(
		{
			actionId: 'invokeTemplateFunction',
			options: {
				playserver: 'OVERLAY',
				playchannel: '1',
				playlayer: '19',
				webplayout: '19',
				relpath: 'pk/Sangtekst/template/sangtekst.html',
				customFunction: 'myFn',
				params: 'Hello World',
			},
		},
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(seen[0], {
		path: 'invokeTemplateFunction',
		query: {
			playserver: 'OVERLAY',
			playchannel: '1',
			playlayer: '19',
			webplayout: '19',
			relpath: 'pk/Sangtekst/template/sangtekst.html',
			function: 'myFn',
			params: 'Hello World',
		},
	})
})

test('directplayout sender parset JSON som objekt, ikke som streng', async () => {
	const { self } = makeSelf()
	let sendtBody
	self.client.post = async (_path, body) => {
		sendtBody = body
		return { ok: true, status: 200, body: 'OK' }
	}
	await getActionDefinitions(self).directplayout.callback(
		{
			actionId: 'directplayout',
			options: { body: '{"casparServer":"OVERLAY","command":"play"}' },
		},
		{ parseVariablesInString: async (s) => s },
	)
	assert.deepStrictEqual(sendtBody, { casparServer: 'OVERLAY', command: 'play' })
})

test('directplayout logger error og sender ingenting ved ugyldig JSON', async () => {
	const { self } = makeSelf()
	let kalt = false
	self.client.post = async () => {
		kalt = true
		return { ok: true, status: 200, body: 'OK' }
	}
	await getActionDefinitions(self).directplayout.callback(
		{ actionId: 'directplayout', options: { body: 'ikke json' } },
		{ parseVariablesInString: async (s) => s },
	)
	assert.strictEqual(kalt, false)
	assert.ok(self.logged.some(([level]) => level === 'error'))
})
```

- [ ] **2. Kjør og se at den feiler**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: FEIL med «Cannot read properties of undefined (reading 'callback')» for
`invokeTemplateFunction`.

- [ ] **3. Minimal implementasjon**

Legg til i `src/actions.js`:

```js
	actions.directplayout = {
		name: 'Direct playout (requires SPX Production/Broadcast)',
		description:
			'Not available in SPX Solo; SPX answers 501. Kept for licensed installations.',
		options: [
			{
				type: 'textinput',
				label: 'JSON body',
				id: 'body',
				default:
					'{"casparServer":"OVERLAY","casparChannel":"1","casparLayer":"20",' +
					'"webplayoutLayer":"20","relativeTemplatePath":' +
					'"vendor/pack/templatefile.html","command":"play"}',
				useVariables: true,
			},
		],
		callback: async (action, context) => {
			const raw = await context.parseVariablesInString(String(action.options.body ?? ''))
			let parsed
			try {
				parsed = JSON.parse(raw)
			} catch (err) {
				self.log('error', `Direct playout: JSON body is not valid JSON — ${err.message}`)
				return
			}
			await self.client.post('directplayout', parsed)
		},
	}

	actions.invokeTemplateFunction = {
		name: 'Invoke template function (requires SPX Production/Broadcast)',
		description:
			'Not available in SPX Solo; SPX answers 501. Kept for licensed installations.',
		options: [
			{ type: 'textinput', label: 'playserver', id: 'playserver', default: 'OVERLAY' },
			{ type: 'textinput', label: 'playchannel', id: 'playchannel', default: '1' },
			{ type: 'textinput', label: 'playlayer', id: 'playlayer', default: '19' },
			{ type: 'textinput', label: 'webplayout', id: 'webplayout', default: '19' },
			{
				type: 'textinput',
				label: 'relpath',
				id: 'relpath',
				default: 'vendor/pack/templatefile.html',
			},
			{
				type: 'textinput',
				label: 'customFunction',
				id: 'customFunction',
				default: 'myCustomTemplateFunction',
				useVariables: true,
			},
			{ type: 'textinput', label: 'params', id: 'params', default: '', useVariables: true },
		],
		callback: async (action, context) => {
			const o = action.options
			await self.client.get('invokeTemplateFunction', {
				playserver: o.playserver,
				playchannel: o.playchannel,
				playlayer: o.playlayer,
				webplayout: o.webplayout,
				relpath: o.relpath,
				function: await context.parseVariablesInString(String(o.customFunction ?? '')),
				params: await context.parseVariablesInString(String(o.params ?? '')),
			})
		},
	}
```

Feltet heter `function` i SPX sitt API, men `customFunction` som options-ID, slik 2.0.0 hadde
det. ID-en beholdes for at eksisterende knapper skal virke.

- [ ] **4. Kjør og se at de passerer**

Kjør: `scripts/verify.sh focus src/__tests__/actions.unit.test.js`
Forventet: PASS på alle tester i filen, inkludert «alle handlings-ID-ene fra 2.0.0 finnes
fortsatt».

Kjør deretter: `scripts/verify.sh all`
Forventet: `lint`, `unit` og `build` alle PASS.

- [ ] **5. `upgrades.js`**

```js
module.exports = [
	/*
	 * No upgrade scripts in 2.0.1.
	 *
	 * The default port changed from 5000 to 5656, but existing connections are
	 * deliberately left untouched: rewriting a working host/port would break
	 * installations that run SPX on its own default port. Set the port by hand
	 * in the connection config after upgrading, if needed.
	 *
	 * Remember that once an upgrade script has been added it cannot be removed.
	 */
]
```

- [ ] **6. Dokumentasjon**

`companion/HELP.md`: seksjon «Requires SPX Production or Broadcast» med disse to handlingene og
en forklaring av 501-svaret.

---

### P6: Integrasjonstest, dokumentasjon og pakking ✅ FERDIG

**Filer:**
- Lag: `src/__integration__/integration.spx.test.js`
- Lag: `Docs/MANUELL_TEST.md`
- Endre: `companion/HELP.md`, `README.md`

**Grensesnitt:**
- Bruker: `SpxClient` fra P1.
- Leverer: en `.tgz` bygget med `companion-module-build`, versjon 2.0.1.

- [ ] **1. Skriv integrasjonstesten**

`src/__integration__/integration.spx.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert')
const { SpxClient } = require('../spx-client')

const client = new SpxClient({
	host: process.env.SPX_HOST || '127.0.0.1',
	port: process.env.SPX_PORT || '5656',
	apikey: process.env.SPX_APIKEY || '',
	timeoutMs: 5000,
	log: () => {},
})

test('SPX svarer på version', async () => {
	const res = await client.get('version')
	assert.strictEqual(res.status, 200, `SPX svarte ikke 200 på /api/v1/version (${res.body})`)
})

test('endepunktene modulen bruker er åpne i Solo', async () => {
	for (const path of [
		'item/play',
		'item/continue',
		'item/stop',
		'rundown/focusFirst',
		'rundown/focusNext',
		'rundown/focusPrevious',
		'rundown/focusLast',
		'rundown/focusByID/1773083297693',
		'rundown/stopAllLayers',
	]) {
		const res = await client.get(path)
		assert.strictEqual(res.status, 200, `${path} svarte ${res.status}`)
	}
})

test('endepunktene modulen unngår er fortsatt sperret i Solo', async () => {
	for (const path of [
		'item/play/1773083297693',
		'item/continue/1773083297693',
		'item/stop/1773083297693',
		'controlRundownItemByID',
	]) {
		const res = await client.get(path)
		assert.strictEqual(res.status, 501, `${path} svarte ${res.status}, ikke 501`)
	}
})
```

Den siste testen er en vaktbikkje: begynner et av endepunktene å svare 200 i en framtidig
SPX-versjon, feiler testen og forteller at de sammensatte handlingene kan forenkles.

- [ ] **2. Kjør og se resultatet**

Kjør: `scripts/verify.sh integration`
Forventet: PASS, med SPX Solo 1.4.1 kjørende på `127.0.0.1:5656` og kontroller-siden åpen på
`/gc/MyFirstProject/MyFirstRundown`.

Feiler den første testen med `ECONNREFUSED`, er SPX ikke startet. Start med
`cd <din SPX-installasjon> && node server.js`.

- [ ] **3. Manuell testprotokoll**

`Docs/MANUELL_TEST.md`:

```markdown
# Manuell test av spx-graphics-controller 2.0.1

## Forutsetninger
- SPX Solo 1.4.1 kjører: `cd <din SPX-installasjon> && node server.js` (port 5656)
- Kontroller-siden er åpen: http://127.0.0.1:5656/gc/MyFirstProject/MyFirstRundown
- Renderer er åpen: http://127.0.0.1:5656/renderer
- Companion 4.2.6 kjører, tilkoblingen `spx` peker på 127.0.0.1:5656, apikey tom

## T1 Tilkoblingsstatus
1. Sett porten til 5999 i tilkoblingens config. Lagre.
2. Forventet: status blir «Connection Failure» innen 10 sekunder, og Companion-loggen får en
   `error`-linje med `ECONNREFUSED`.
3. Sett porten tilbake til 5656. Forventet: status blir «OK» med teksten `SPX 1.4.1`.

## T2 Start item by ID
1. Lag en knapp med handlingen «Start item by ID», ID `1773083297693`.
2. Fokuser et annet element i kontroller-siden, for eksempel det første i rundownen.
3. Trykk knappen.
4. Forventet: NAME_LEFT spilles på lag 3, og fokus i kontroller-siden flytter seg til det
   elementet. Sjekk i renderer-konsollen:
   `document.getElementById('layer3').contentWindow.document.querySelector('#gfx').style.opacity`
   skal være `1`.
5. Gjenta 5 ganger med ulikt utgangsfokus. Alle 5 skal spille riktig element.

## T3 Stop item by ID
1. Handlingen «Stop item by ID» med samme ID.
2. Forventet: `#gfx`-opacity går til `0`, elementet animeres ut.

## T4 Feil ID
1. «Start item by ID» med ID `000`.
2. Forventet: SPX svarer 200, men kontroller-konsollen viser at elementet ikke finnes. Ingen
   grafikk spiller. Companion-loggen skal ikke være stille — noter faktisk oppførsel her, den
   avgjør om modulen bør slå opp ID-en før den sender.

## T5 Handlinger som gir 501
1. Handlingen «Direct playout» med standardverdiene.
2. Forventet: ingen krasj, og Companion-loggen får en `warn`-linje som nevner SPX Solo og
   Production/Broadcast.

## T6 Eksisterende knapper overlever oppgraderingen
1. Noter hvilke handlinger knappene på Moses bruker før oppgradering.
2. Etter installasjon av 2.0.1: åpne hver knapp og bekreft at handlingen fortsatt er koblet,
   ikke vist som «Unknown action».
```

- [ ] **4. Bygg**

`companion/manifest.json` røres ikke. Versjonen står allerede som `2.0.1` i `package.json`
fra P0, og bygget injiserer den.

```bash
npx companion-module-build
python3 -c "import json;d=json.load(open('pkg/companion/manifest.json'));print(d['version'],d['runtime']['apiVersion'])"
```

Forventet: `2.0.1 1.14.1`, og artefakten `spx-graphics-controller-2.0.1.tgz` i repo-roten med
utpakket kopi i `pkg/`. Installer i Companion via Settings → Modules → Import, eller legg
utpakket kopi i `~/companion-modules/` siden `dev_modules_path` peker dit og
`enable_developer` er på.

- [ ] **5. Kjør hele verifikasjonen**

Kjør: `scripts/verify.sh all && scripts/verify.sh integration`
Forventet: alle scopes PASS. Resultatfilen er grunnlaget for GRØNT.

- [ ] **6. Dokumentasjon**

`README.md` ferdigstilles: hva forken er, hvorfor 501-endepunktene er omgått, hvordan bygge,
hvordan installere, og hvilke tester som finnes. `companion/HELP.md` ferdigstilles med de tre
seksjonene fra P3, P4 og P5 samt en tabell over hvilke handlinger som virker på hvilken
SPX-utgave.

---

## Selvgjennomgang

**Dekning mot briefen:**

| Krav i briefen | Steg |
|---|---|
| Nye handlinger: Focus item by ID | P4 |
| Play/Continue/Stop item by ID, fokus + kommando sekvensielt i én handling | P4 |
| Behold handlingene som virker i Solo | P3 |
| Merk eller fjern de som gir 501 | P5 (merket i navnet, ID-er beholdt) |
| Konfigurasjonsfelt for apikey | P1 |
| Standardport 5656 | P1 |
| Feil til Companion-loggen via `this.log('error', ...)` | P1 |
| `updateStatus` basert på `/api/v1/version` | P2 |
| `await` på fetch | P1 (global regel), P4 (rekkefølgen) |
| Pakkes med `@companion-module/tools` | P0, P6 |
| Versjon 2.0.1, runtime node18, api nodejs-ipc | Globale krav, P6 |
| Alternativ B som egne handlinger | **Bevisst utelatt.** Egen fase, jf. åpne avgjørelser 4. |
| SPX sin kode endres ikke | Globale krav |

**Plassholdere:** ingen «TBD», «TODO», «håndter kanttilfeller» eller «som i steg N» i stegene.
Hvert kodesteg har kjørbar kode.

**Typekonsistens:** `SpxClient`, `buildUrl`, `get`, `post`, `evaluateStatus`,
`getActionDefinitions`, `focusThen`, `ID_OPTION` brukes med samme navn og signatur i alle steg
der de nevnes. Returtypen `{ ok, status, body, url }` er den samme i P1, P2, P3, P4, P5 og P6.

**Rekkevidde:** `actions.js`, `feedbacks.js`, `presets.js` og `variables.js` i rot er alle
kallere eller kalte fra `main.js`. Alle fire håndteres i P3, sammen med `main.js` selv. Ingen
annen fil i repoet importerer dem.

**Kjent svakhet, notert bevisst:** ingen av handlingene kan vite om `itemID` finnes i den
åpne rundownen. SPX svarer 200 på `rundown/focusByID/<ukjent id>`, og kontroller-siden logger
bare en advarsel i nettleserkonsollen. T4 i den manuelle testprotokollen måler hva som faktisk
skjer; viser den seg å være et reelt problem i drift, er en ID-validering mot
`DATAROOT`-filene en egen oppgave, og den krever `rundown/get`, som er 501 i Solo.
