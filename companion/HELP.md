SPX is an open source graphics controller that runs graphics using HTML and JavaScript
templates. In addition to the web renderer it also interfaces with CasparCG.

- [spxgc.com](https://www.spxgc.com/)
- [github.com/TuomoKu/SPX-GC](https://github.com/TuomoKu/SPX-GC)

## Configuration

| Field           | Default     | Notes                                                                    |
| --------------- | ----------- | ------------------------------------------------------------------------ |
| Target IP       | `127.0.0.1` |                                                                          |
| Target port     | `5656`      | SPX's own default is `5000`.                                             |
| API key         | empty       | Must match `apikey` in SPX's `config.json`. Leave empty if SPX has none. |
| Request timeout | `5000` ms   |                                                                          |

The module polls `/api/v1/version` every 10 seconds and sets the connection status from the
result, so the status dot reflects whether SPX is actually reachable.

**Note on the API key:** SPX answers HTTP 200 with an error in the response body when the key
is wrong, rather than 401. This module detects that and logs it as an error, so check the
Companion log if a button appears to do nothing. Be aware that `/api/v1/version` requires no
key at all, so the connection status can read OK while every action is being rejected.

## Which actions work on which SPX edition

SPX 1.4.0 tied "SPX Solo" to the Solo/Production/Broadcast product family and replaced a
number of API endpoints with `501 Not Implemented`. This module works around that where
possible.

### Works on SPX Solo

Rundown navigation:

- Focus on the first item
- Focus on the next item
- Focus on the previous item
- Focus on the last item
- **Focus item by ID** — new in 2.0.1
- Open rundown (project/file)
- Stop all layers (animates graphics out, does not clear layers)

Playback of the focused item:

- Start focused item
- Continue focused item
- Stop focused item

### Playback by item ID

- Start item by ID
- Continue item by ID
- Stop item by ID
- Play/Stop/Continue an item from a known rundown

`item/play/:id` and friends answer 501 on SPX Solo, so each of these actions makes **two
sequential API calls**: `rundown/focusByID/<id>` first, then the plain command. Both calls
live in a single action on purpose — splitting them across two actions on the same button
does not guarantee ordering, and the wrong graphic would occasionally go to air.

Two things are required:

1. **The SPX controller page must be open** on the rundown containing the item. These actions
   drive the controller, not the renderer directly.
2. **The item must exist in that rundown.** SPX answers 200 even for an unknown ID and only
   logs a warning in the browser console, so a wrong ID gives a silent no-op.

The item ID is the `itemID` field in `DATAROOT/<project>/data/<rundown>.json`. It is an epoch
timestamp, for example `1773083297693`.

### Requires SPX Production or Broadcast

- Direct playout
- Invoke template function

Both answer `501 Not Implemented` on SPX Solo. They are kept so that buttons using them keep
working on licensed installations, and both were repaired in 2.0.1: "Direct playout" used to
send a JSON string rather than an object, and "Invoke template function" read undefined free
variables and threw regardless of licence.
