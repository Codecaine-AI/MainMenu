# Motion & Easing Guide

Reference for the easing curves used (and considered) across this site's menu
system — what each one feels like, the actual numbers, and when to reach for
which. The menu's transitions are all configurable in
`Assets/Scenes/menu/scene.json`, so this doc is the map for tuning them.

## How to read the waves

Each chart is an easing curve rendered as a wave: one row per time step, and
the bar length is how far the element has traveled by that moment. The `|` is
the destination (100%). Bars past the `|` are overshoot.

A curve that fills up fast at the top and coasts into the `|` is an
**ease-out** — that early burst + long settle is what reads as "smooth" in UI
motion. A curve that starts lazy and slams into the `|` at the end is an
**ease-in** — right for exits, wrong for entrances.

---

## linear

```
t=0.00                                                 |
t=0.07 ***                                             |
t=0.14 *******                                         |
t=0.21 **********                                      |
t=0.29 **************                                  |
t=0.36 *****************                               |
t=0.43 *********************                           |
t=0.50 ************************                        |
t=0.57 ***************************                     |
t=0.64 *******************************                 |
t=0.71 **********************************              |
t=0.79 **************************************          |
t=0.86 *****************************************       |
t=0.93 *********************************************   |
t=1.00 ************************************************|
```

Constant velocity. Feels mechanical — which is sometimes exactly right.
Progress bars, marquees, scanlines, and the side-panel **sweep pill** in this
site all use linear, because the GameCube-era original animates at fixed
pixels-per-frame and easing it would break the arcade feel. Never use it for
UI elements arriving or leaving; it reads as robotic there.

## easeOutExpo — `cubic-bezier(0.16, 1, 0.3, 1)`

```
t=0.00                                                 |
t=0.07 ******************                              |
t=0.14 ******************************                  |
t=0.21 *************************************           |
t=0.29 *****************************************       |
t=0.36 ********************************************    |
t=0.43 **********************************************  |
t=0.50 *********************************************** |
t=0.57 *********************************************** |
t=0.64 ************************************************|
t=0.71 ************************************************|
t=0.79 ************************************************|
t=0.86 ************************************************|
t=0.93 ************************************************|
t=1.00 ************************************************|
```

Explosive launch — 60% of the travel happens in the first ~15% of the time —
then a long, buttery glide into place. The "premium app" curve. Because the
visible motion front-loads, it tolerates long durations (400–700ms) without
feeling slow. **This is the site's default** (`menu-motion-easing`), driving
the forward/back orbit and selection transitions.

## easeOutQuint — `cubic-bezier(0.22, 1, 0.36, 1)`

```
t=0.00                                                 |
t=0.07 **************                                  |
t=0.14 **************************                      |
t=0.21 **********************************              |
t=0.29 ***************************************         |
t=0.36 *******************************************     |
t=0.43 *********************************************   |
t=0.50 **********************************************  |
t=0.57 *********************************************** |
t=0.64 *********************************************** |
t=0.71 ************************************************|
t=0.79 ************************************************|
t=0.86 ************************************************|
t=0.93 ************************************************|
t=1.00 ************************************************|
```

Same silhouette as easeOutExpo with ~15% softer launch. The pick when expo
feels too aggressive on large elements. If the menu orbit ever reads as
"jumpy" at short durations, swap this into `menu-motion-easing` before
touching anything else.

## easeOutBack — `cubic-bezier(0.34, 1.56, 0.64, 1)`

```
t=0.00                                                 |
t=0.07 **************                                  |
t=0.14 **************************                      |
t=0.21 ***********************************             |
t=0.29 ******************************************      |
t=0.36 *********************************************** |
t=0.43 ************************************************|***
t=0.50 ************************************************|****
t=0.57 ************************************************|*****
t=0.64 ************************************************|****
t=0.71 ************************************************|***
t=0.79 ************************************************|**
t=0.86 ************************************************|*
t=0.93 ************************************************|
t=1.00 ************************************************|
```

Overshoots the target ~8–10% and settles back. Playful, alive, tactile —
great for small things popping in: markers, badges, toggles, the selection
ring. Terrible for big panels (a full menu overshooting looks broken, not
bouncy). Keep it on elements smaller than ~15% of the screen.

## Apple system ease — `cubic-bezier(0.25, 0.1, 0.25, 1)`

```
t=0.00                                                 |
t=0.07 ***                                             |
t=0.14 ********                                        |
t=0.21 ****************                                |
t=0.29 ***********************                         |
t=0.36 ******************************                  |
t=0.43 ***********************************             |
t=0.50 ***************************************         |
t=0.57 ******************************************      |
t=0.64 ********************************************    |
t=0.71 *********************************************   |
t=0.79 *********************************************** |
t=0.86 *********************************************** |
t=0.93 ************************************************|
t=1.00 ************************************************|
```

The CSS `ease` default. Mild ease-in, mild ease-out. Safe everywhere,
memorable nowhere. Fine for hover states and small color shifts; too timid to
give a signature feel to hero motion.

## Material standard — `cubic-bezier(0.4, 0, 0.2, 1)`

```
t=0.00                                                 |
t=0.07 *                                               |
t=0.14 ***                                             |
t=0.21 ********                                        |
t=0.29 ****************                                |
t=0.36 *************************                       |
t=0.43 ********************************                |
t=0.50 *************************************           |
t=0.57 *****************************************       |
t=0.64 ********************************************    |
t=0.71 *********************************************   |
t=0.79 *********************************************** |
t=0.86 *********************************************** |
t=0.93 ************************************************|
t=1.00 ************************************************|
```

Google's workhorse: noticeable wind-up, brisk middle, clean landing. Correct
for elements that move from one on-screen position to another (both endpoints
visible), where a pure ease-out would look like teleport-then-drift. Keep
durations short (150–300ms) — this curve drags if stretched.

## easeIn (exit) — `cubic-bezier(0.4, 0, 1, 1)`

```
t=0.00                                                 |
t=0.07                                                 |
t=0.14 **                                              |
t=0.21 ****                                            |
t=0.29 ******                                          |
t=0.36 *********                                       |
t=0.43 ************                                    |
t=0.50 ****************                                |
t=0.57 *******************                             |
t=0.64 ************************                        |
t=0.71 ****************************                    |
t=0.79 *********************************               |
t=0.86 *************************************           |
t=0.93 *******************************************     |
t=1.00 ************************************************|
```

The mirror image: hesitate, then accelerate away. Exit-only. Things leaving
the screen should gain speed as they go — a decelerating exit looks like the
element changed its mind. Pair with a shorter duration than the entrance
(exits at ~60–80% of entrance time), because nobody savors watching something
leave.

## Spring (underdamped, ζ ≈ 0.82)

```
t=0.00                                                 |
t=0.07 **********                                      |
t=0.14 *************************                       |
t=0.21 *************************************           |
t=0.29 ********************************************    |
t=0.36 *********************************************** |
t=0.43 ************************************************|
t=0.50 ************************************************|*
t=0.57 ************************************************|
t=0.64 ************************************************|
t=0.71 ************************************************|
t=0.79 ************************************************|
t=0.86 ************************************************|
t=0.93 ************************************************|
t=1.00 ************************************************|
```

The modern gold standard — iOS/visionOS motion is nearly all springs, not
beziers. Physics-defined (stiffness / damping / mass) rather than a fixed
curve, so interrupted animations retarget naturally. A damping ratio of
0.8–0.9 gives one tiny overshoot and an organic settle: livelier than
easeOutQuint, calmer than easeOutBack. In CSS, approximate with `linear()`:

```css
transition-timing-function: linear(
  0, 0.3 6%, 0.66 14%, 0.93 24%, 1.05 36%, 1.005 60%, 0.995 76%, 1
);
```

---

## Rules of thumb

1. **Entrances decelerate, exits accelerate.** Ease-out in, ease-in out. No
   exceptions worth making.
2. **Exits are faster.** 60–80% of the entrance duration.
3. **Match duration to curve.** Expo/quint families carry 400–700ms; mild
   curves (ease, Material) go stale past ~300ms.
4. **Overshoot scales inversely with size.** Small elements may bounce; large
   surfaces never should.
5. **Linear is for machines.** Constant-rate effects (sweeps, scans,
   progress) — and deliberately retro motion like this site's panel reveal.
6. **One signature curve per app.** Pick a hero curve (this site: easeOutExpo)
   and use it everywhere motion should feel branded; vary duration, not curve.

## What this site uses right now

| Motion | Curve | Duration | Config key |
|---|---|---|---|
| Forward/back orbit (in) | easeOutExpo `0.16, 1, 0.3, 1` | 420ms | `transition-ms`, `menu-motion-easing` |
| Forward/back fade out | `ease-in` | 240ms | `menu-fade-out-ms` |
| Forward/back fade in | `ease-out`, 170ms delay | 300ms | `menu-fade-in-ms`, `menu-fade-in-delay-ms` |
| Selection theme snap | easeOutExpo | 140ms | `theme-transition-ms` |
| Side-panel sweep pill | **linear** (authentic to source) | 110ms/line | `side-flash-line-ms` |
| Side-panel line stagger | — (bottom-up) | 45ms | `side-flash-stagger-ms` |
| Title prism flip | linear | 200ms | `title-prism-ms` |

All timing lives in `Assets/Scenes/menu/scene.json` on the `main-menu-system`
component — tuning the feel never requires touching component code.
