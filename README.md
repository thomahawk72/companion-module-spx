# companion-module-spx-graphics-controller

Companion module for the [SPX Graphics Controller](https://www.spxgc.com/).
See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE).

This is a fork of
[bitfocus/companion-module-spx-graphics-controller](https://github.com/bitfocus/companion-module-spx-graphics-controller)
adapted to **SPX Solo 1.4.1**, where a number of API endpoints answer
`501 Not Implemented` because they require an SPX Production or Broadcast license.
The work in progress is documented in [Docs/PLAN_2.0.1.md](./Docs/PLAN_2.0.1.md).

## Requirements

- Node 20 or newer to run the test suite. The module's own runtime is `node18`,
  as declared in `companion/manifest.json`, and tests never run inside Companion.
- Companion 4.x.

## Build and install

```bash
npm install
npm run build          # or: npx companion-module-build
```

The build writes a `.tgz` into `pkg/`. Install it in Companion via
**Settings → Modules → Import**, or, with developer mode enabled, point
`dev_modules_path` at a directory holding an unpacked copy of this repository.

Verified on Node 24.3.0 on macOS. `@companion-module/tools` declares support for
Node 18.18 and 22.18 and prints an `EBADENGINE` warning on Node 24; the build
itself succeeds.

## Configuration

| Field           | Default     | Notes                                                                                      |
| --------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Target IP       | `127.0.0.1` |                                                                                            |
| Target port     | `5656`      | SPX's own default is `5000`. `5656` is used here because AirPlay occupies `5000` on macOS. |
| API key         | empty       | Must match `apikey` in SPX's `config.json`. Leave empty if SPX has none.                   |
| Request timeout | `5000` ms   |                                                                                            |

## What 2.0.1 changes

SPX 1.4.0 replaced a number of API endpoints with `501 Not Implemented` on SPX Solo, which
left several of this module's actions dead. 2.0.1 keeps every `actionId` from 2.0.0, so
existing buttons survive the upgrade, and:

- **Play / Continue / Stop item by ID work again.** `item/play/:id` is blocked on Solo, so
  these actions now call `rundown/focusByID/<id>` and then the plain command, sequentially,
  inside a single action. Ordering is guaranteed because both HTTP routes end in one
  `io.emit` on the SPX server, socket.io preserves order per connection, and the controller's
  `focusRow()` is synchronous. Splitting the two calls across two Companion actions does not
  guarantee ordering and occasionally puts the wrong graphic to air.
- **New action: Focus item by ID.**
- **Errors reach the Companion log.** 2.0.0 sent network failures to `console.log`, where
  nobody saw them.
- **SPX errors hidden in 200 responses are detected.** SPX answers HTTP 200 with
  `{"error": ...}` when the API key is wrong, so HTTP status alone is not proof a command ran.
- **Real connection status.** The module polls `/api/v1/version` every 10 seconds instead of
  reporting OK once at startup and never updating.
- **API key field added**, and the default port is 5656.
- **Repaired two broken actions.** "Direct playout" sent a JSON string instead of an object;
  "Invoke template function" read undefined free variables and threw regardless of licence.
- **Removed dead template code**: `feedbacks.js`, `presets.js` and `variables.js` were
  unused scaffolding.

## Verification

All checks run through `scripts/verify.sh`, which takes a lock and writes a result
file with the git hash into `.verify/`.

```bash
scripts/verify.sh all                    # prettier, unit tests, module build
scripts/verify.sh integration            # requires a running SPX on 127.0.0.1:5656
scripts/verify.sh focus src/__tests__/manifest.unit.test.js
```

The `integration` scope is deliberately excluded from `all`: it needs SPX Solo
running with its controller page open, which only a human sets up.
