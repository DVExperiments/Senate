# The Pixel Senate

A deadpan senate of 48 pixels that debates, votes, filibusters and holds elections forever, with nobody steering. Part of the Pixel Universe; follows the Pixel Universe Shared Conventions.

Live at `https://dvexperiments.github.io/Senate/`. The test bench is at `/Senate/test.html`.

## Files

| File | What it does |
| --- | --- |
| `universe.js` | The whole simulation. No DOM code; any site can load it after the Weather Bureau's `universe.js`. |
| `index.html` | The site: chamber, senators, bills, elections, laws, parties, records. |
| `css/senate.css` | Styles, built on Glacial's. |
| `js/model.js` | Reads the simulation and derives careers, voting records, allies and records. |
| `js/floor.js` | What is happening on the floor at any moment, and the chamber animation. |
| `js/views.js` | Every page. |
| `js/app.js` | Routing, the live loop, and applying the Senate's own laws to the site. |
| `test.html` | Self-checks, drama report, election history, a moment inspector and an event log. |

## The chamber view

The racing is slow; the politics is fast. During sittings (19:00 to 23:30 UTC) the chamber is live: a new senator takes the floor every 20 seconds, and divisions are counted in about 90 seconds, with each vote flying to the Ayes or Noes. Outside sitting hours the chamber replays the last sitting at 90× speed. Speakers and speeches are seeded by time, so every visitor sees the same senator speaking at the same moment; the fidgeting, whispering and heckling flickers are decoration only.

The site obeys the Senate's laws: colours, typefaces and names change at 00:00 UTC when a law takes effect.

**Time travel for testing.** Add `?at=` to any address to watch the Senate from that moment (UTC), for example `index.html?at=2027-01-04T21:20` for a live debate, `?at=2027-01-04T22:00:50` for a division, or `?at=2027-07-02T21:50` for a shutdown vote. Links keep the parameter while you browse.

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

**Daily rhythm (UTC).** 00:00 new laws take effect (and on 1 July, a shutdown begins if there is no budget). 09:00 news (scandals, inquiries, retirements, defections on the 15th, shutdown days, dissolutions). 09:30 Monday leadership challenges. 10:00 Monday poll. 11:00 election results. 19:00 sitting opens. 19:15 budget presented (June). 19:20 committee reports. 19:30 introductions. 21:30 ethics votes. 21:50 budget vote. 22:00 ordinary votes, six minutes apart. No sitting on the 1st (Grand Prix day), on election days, or while the Senate is dissolved.

**Bills** go through introduction, committee (2 to 5 days, where some die or are amended), then a vote. Emergency bills skip committee when air-quality concern is high. On Thursdays a member's bill is drawn from the tin. A tie fails: the Presiding Officer, Neutral Grey, always votes for the status quo.

**Votes.** Senators follow their party unless they disagree strongly and are disloyal enough to rebel; rebels become less loyal and may later defect. Before a vote that would fail, a persuadable bloc may switch in exchange for an amendment (Legacy Mode usually demands that some earlier change be undone). A strongly opposed senator may filibuster for up to about 13 hours; 30 supporters can end it after two.

**By-elections** fill seats vacated by resignation, ill health or expulsion, four Saturdays later, unless the seat is due for election within 70 days.

**Term limits and lame ducks.** A senator may win at most four terms. Term-limited senators announce their farewell 21 days before their final election. Senators in their last term, or retiring, are lame ducks: party loyalty has half its usual hold, so they rebel more often.

**The budget.** Each year the Majority Leader presents an Appropriations Bill from 2 June, carrying the largest party's priority policy. It is voted on 16, 20, 24, 28 and 30 June. Opposition parties start out reluctant; each defeat softens the bill and builds pressure, and side deals are rare.

**Shutdowns.** If no budget has passed by 1 July, the Senate shuts down: it meets only for daily budget votes (and ethics votes), the chamber lights dim, support falls (most for the largest party), and pressure builds a little each day. Most shutdowns last a few days; occasionally one drags on for weeks.

**Ethics inquiries.** About 60% of serious scandals become inquiries: a complaint, an inquiry opened, a day of testimony, then a report that clears the senator or recommends censure (simple majority) or expulsion (32 votes, two-thirds of the chamber). Senators sometimes resign before testifying or after being censured. Expulsion is rare.

**Dissolution and snap elections.** If the Senate deadlocks, with a shutdown reaching 7 days or three tied votes within six weeks, the Presiding Officer may dissolve it. All bills lapse, there are no sittings, and all 48 seats are contested at a snap election four Saturdays later. Senators then draw lots again for staggered terms. A dissolution cannot happen within 30 days after an election, within 60 days before one, or within two years of the last dissolution.

**Weather.** The Senate reads the Weather Bureau's climate layer, a root of the universe, which must load before `universe.js`. If it can't be reached, the Senate refuses to run (`ready()` returns false) rather than compute a different history. Storms, gales of 100 km/h or more, and snow at 18:30 call off that day's sitting (about eight a year, mostly storms). Rain or strong wind at a vote keeps more senators away. After a named storm clears, the largest party brings an emergency recovery bill raising the construction budget, which usually passes. Rain in the day before an election lowers turnout. And until the Ecosystem exists, smog complaints follow still, cold days, judged on yesterday's weather.

**Names.** When a generated name is already taken, the newcomer gets a numeral (Hex Halftone II).

## Pixel City Society

The Senate reads Pixel City Society (City's `society.js`), a hard dependency: `ready()` is false without it, and every page that loads the Senate must also load City's `universe.js` and `census.js`, the Exchange and `society.js`, in that order. From the May 2027 general election, each candidate's draw in a district is multiplied by Society's swing for their party there, from the district's leanings a fortnight before polling day. When a colour craze is running in the city, senators draft more colour bills, and those shift hue towards the craze (the bill's change records it as `craze`). Neither adds a draw from the Senate's random streams, so nothing before Society began is changed.

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
<script src="https://dvexperiments.github.io/Weather/universe.js"></script>
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
| `stateAt(time)` | Seats, senators (with lame-duck flags), leaders, support, laws in effect, bills, filibuster, budget, shutdown, dissolution, inquiries, next election |
| `eventsBetween(from, to)` | Events in the shared format |
| `lawsAt(time)` | Every law key resolved, defaults included |
| `styleVars(time, scheme)` | CSS variable values for `light` or `dark`, guardrails applied |
| `billsBetween(from, to)`, `electionsBetween(from, to)` | Finished bills (with every senator's vote) and full election results, including preference rounds |
| `policyBetween(from, to)` | Environmental policy levels each time they changed (read by Pixel City) |
| `districtProfiles` | Each district's name, environmental and aesthetic leaning, and size |
| `create()` | A fresh, independent instance (used for testing) |

All times are milliseconds since the Unix epoch, UTC.

## Before launch (28 November 2026)

- Tune freely until then; nothing has happened yet.
- Decide district names (currently the sixteen Glacial pixels).
- Set `VERSION` to `1.0.0` the day before the founding election. After that, any change that alters past results needs a new era.

From the May 2027 general election, a sitting senator's advantage at home is multiplied by Society's `incumbentFactor` for the district: more for a district that has grown and is happy, less for one that pixels are leaving (Society's migration).
