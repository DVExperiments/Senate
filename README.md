# The Pixel Senate

A deadpan senate of 48 pixels that debates, votes, filibusters and holds elections forever, with nobody steering. Part of the Pixel Universe; follows the Pixel Universe Shared Conventions.

Live at `https://dvexperiments.github.io/Senate/`. The test bench is at `/Senate/test.html`.

## Files

| File | What it does |
| --- | --- |
| `universe.js` | The whole simulation. No DOM code; any site can load it. |
| `test.html` | Self-checks, drama report, election history, a moment inspector and an event log. |
| `index.html` | Placeholder home page with live status until the chamber view is built. |

## Design

**Chamber.** 48 senators, three for each of 16 districts named after the Glacial pixels. Terms are 18 months and staggered, so one seat per district (16 in total) is contested at each election. Elections fall on the last Saturday of May and November, with results at 11:00 UTC.

**Founding.** All 48 seats are elected on Saturday 28 November 2026. At the first sitting on 3 December 2026 (Glacial's first anniversary) senators draw lots for 6, 12 or 18-month first terms.

**Parties.** Each sits on two axes, so every pair agrees on something and alliances shift bill by bill.

| Party | Environment | Aesthetics |
| --- | --- | --- |
| Brightness Party | Industrial (-0.6) | Change (+0.4) |
| Verdant Party | Green (+0.7) | Change (+0.35) |
| Legacy Mode | Mildly green (+0.1) | Tradition (-0.8) |

Independents (usually one or two) each have a pet policy and trade their vote for it.

**Elections** use preferential voting (instant runoff). Results depend on party support, how well each candidate fits the district, incumbency and noise. Parties announce preference deals 14 days before each election, and some incumbents announce retirement 21 days before.

**Public mood** drifts over weeks and months, voters tire of whichever party is largest, and air-quality concern pushes support towards Verdant. Air-quality concern is a **stub** until the Ecosystem exists; it will then read yesterday's smog (a declared era change).

**Daily rhythm (UTC).** 00:00 new laws take effect. 09:00 news (scandals, retirements, defections on the 15th). 09:30 Monday leadership challenges. 10:00 Monday poll. 19:00 sitting opens. 19:20 committee reports. 19:30 introductions. 22:00 votes, six minutes apart. No sitting on the 1st (Grand Prix day) or on election days.

**Bills** go through introduction, committee (2 to 5 days, where some die or are amended), then a vote. Emergency bills skip committee when air-quality concern is high. On Thursdays a member's bill is drawn from the tin. A tie fails: the Presiding Officer, Neutral Grey, always votes for the status quo.

**Votes.** Senators follow their party unless they disagree strongly and are disloyal enough to rebel; rebels become less loyal and may later defect. Before a vote that would fail, a persuadable bloc may switch in exchange for an amendment (Legacy Mode usually demands that some earlier change be undone). A strongly opposed senator may filibuster for up to about 13 hours; 30 supporters can end it after two.

**By-elections** fill seats vacated by resignation or ill health, four Saturdays later, unless the seat is due for election within 70 days.

## Laws and guardrails

| Key | Effect | Default |
| --- | --- | --- |
| `style.bg`, `style.surface`, `style.link`, `style.screen` | Shift `{h, s, l}` applied to Glacial's light and dark palettes | `{0, 0, 0}` |
| `style.display`, `style.body` | Typeface from an approved list | Bricolage Grotesque, IBM Plex Sans |
| `names.crawl`, `names.gp`, `names.trophy` | Names of the races and trophy | Daily Crawl, Grand Prix, Grand Prix Trophy |
| `commentary.tone` | Commentary style | measured |
| `policy.*` | Environmental policy for the future city (coal plants, solar, wind, parks, wildlife zones, emissions cap, traffic limits, construction budget) | See `universe.js` |

Shifts are capped at 30° hue, 25% saturation and 6% lightness. `styleVars()` also scales a shift back until text and links keep at least 4.5:1 contrast.

## Put it on GitHub Pages

1. On GitHub, create a new **public** repository under `DVExperiments` named exactly `Senate`.
2. Upload `universe.js`, `test.html`, `index.html` and `README.md` to the root of the repository (Add file, Upload files, then Commit).
3. Open **Settings**, then **Pages**. Under Build and deployment, set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then Save.
4. Wait a minute or two, then open `https://dvexperiments.github.io/Senate/test.html`.

## Test it

On the test bench, check that:

1. **All self-checks say Pass.** The generator comparison only runs when Glacial's scripts load, which they will on the live site.
2. **The drama report is mostly in range.** Amber rows are not bugs, just measures outside the target. Try 25 years to see long-run behaviour.
3. **The inspector looks sensible** at a few moments: the founding night (28 Nov 2026 12:00), the first sitting (3 Dec 2026 19:30), the first election (29 May 2027 12:00) and a few years out.
4. **Your browser's developer console shows no errors** (F12, Console tab).

To test locally instead, run `python3 -m http.server` in the folder and open `http://localhost:8000/test.html`. Opening the file directly also works.

## Using it from another site

```html
<script src="https://dvexperiments.github.io/Senate/universe.js"></script>
<script>
  const senate = window.PixelUniverse && PixelUniverse.senate;
  if (senate) {
    const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const vars = senate.styleVars(Date.now(), scheme);
    for (const k in vars) document.documentElement.style.setProperty(k, vars[k]);
  }
</script>
```

| Function | Returns |
| --- | --- |
| `stateAt(time)` | Seats, senators, leaders, support, laws in effect, bills, filibuster, next election |
| `eventsBetween(from, to)` | Events in the shared format |
| `lawsAt(time)` | Every law key resolved, defaults included |
| `styleVars(time, scheme)` | CSS variable values for `light` or `dark`, guardrails applied |
| `billsBetween(from, to)`, `electionsBetween(from, to)` | Finished bills (with every senator's vote) and full election results, including preference rounds |
| `create()` | A fresh, independent instance (used for testing) |

All times are milliseconds since the Unix epoch, UTC.

## Before launch (28 November 2026)

- Tune freely until then; nothing has happened yet.
- Decide district names (currently the sixteen Glacial pixels).
- Set `VERSION` to `1.0.0` the day before the founding election. After that, any change that alters past results needs a new era.
