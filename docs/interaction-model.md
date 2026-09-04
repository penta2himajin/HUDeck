# HUDeck interaction model (SoT)

**Status:** active source of truth for app × body interaction.  
**Audience:** humans and coding agents.  
**When chat history conflicts with this file, this file wins** until a later commit revises it.

## Product one-liner

Ambient-tech control deck for Even G2: head-gesture capable, confirmation-gated capture, glanceable status. Capabilities (record/transcribe, suggesting, chat) hang off this shell.

## Two axes

Display is derived. Do not invent combined super-states for every pair.

```text
App
  mode:        idle | recording | chat | settings
  confirm:     inactive | pending(tier)
  suggesting:  on | off
  lookUpThresholdDeg: 15 | 20

Body / environment
  pose:        neutral | lookUp
  (gestures are events, not states)
```

```text
view = f(mode, confirm, suggesting, pose, lookUpThresholdDeg)
```

## Confirm display tiers

Weak → strong: **minimal < compact < detail**.

| Tier | When | HUD |
|---|---|---|
| minimal | Confirm interrupts an existing lookUp deck (context-preserving) | `REC?` (tunable) |
| compact | `idle` + `neutral` while pending | Short confirm line |
| detail | Pending + user looks up to inspect | Reason / actions |

### Confirm rules

- **Show priority over pose:** pending confirm is visible at `neutral` (compact), not gated on lookUp.
- **No hard context steal:** do not destroy `chat` or replace an active lookUp deck with a full-screen confirm; use **minimal** on the deck instead.
- **Accept (common):** `neutral` + nod (phone) accepts at any pending tier without opening detail. While lookUp, **tap / tilt-F** accepts (and nod dogfood ≡ tap).
- **Dismiss via pose:** **detail → neutral** dismisses (inspected, then declined). While lookUp pending, **dbl / tilt-B** also dismisses.
- **minimal → neutral:** does **not** dismiss; demotes to **compact**.
- **Timeout:** compact/minimal with no action → dismiss (default **12s**).
- **Cooldown after explicit dismiss:** **3 min**. After timeout dismiss: **90s**.
- **While `mode=chat`:** do not raise confirm (defer/drop). Nod must not collide with chat.
- **While `mode=settings`:** do not raise confirm (defer/drop).
- **While `mode=recording`:** no new confirm.

## Mode × pose views

| mode | pose | view |
|---|---|---|
| idle (no confirm) | neutral | Fully quiet: no brand text, no deck frame (capture surface only) |
| idle (no confirm) | lookUp | Glance deck (see chrome below) |
| idle + confirm compact | neutral | Compact confirm |
| idle + confirm minimal | lookUp | Deck remains; `REC?` in header right slot |
| idle + confirm detail | lookUp | Confirm detail |
| recording | neutral | `REC●` indicator only (no brand frame) |
| recording | lookUp | Elapsed / transcript / stop / mark (`REC●` in title) |
| chat | lookUp | Chat UI |
| chat | neutral | Minimized; session continues; tiny `C` indicator (tunable) |
| settings | lookUp | Look-up threshold picker (15° / 20°) |
| settings | neutral | Minimized; tiny `S` indicator |

### Idle lookUp glance deck (chrome)

Sparse menu; brand is lookUp-only. No suggest-armed line on the deck.

```text
HUDeck        | 15:37 |        REC●
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ Record
> Chat
> Settings
```

- Header: `HUDeck` left, `| hh:mm |` with the **`:` on the content midline**, optional right slot (`REC●` / `REC?`).
- Full-width rule on the next line, then menu rows — all consecutive in one body stream (title band collapsed) so there is no blank between rule and `▶ Record`.
- Rule fills with firmware-present `━` only (do not top up with missing glyphs like `▬` — those make Hub shorter than the phone preview).
- Phone preview draws the rule as a bar of `getTextWidth(rule)` (not the full content box).
- No Hub container border/frame on the glance deck or recording lookUp — chrome is text only.
- **Settings** opens a settings mode (lookUp) for head-gesture config — see below.

### Settings (look-up threshold)

Entered from idle lookUp (phone **設定** tile or later deck focus). Same minimize rules as chat: lookDown keeps the mode with a tiny `S`; exit only via explicit close.

```text
Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Look-up
▶ 15°
> 20°
```

- Switchable enter thresholds: **15°** and **20°** (default), persisted in localStorage.
- Changing the threshold updates pose sensing immediately (and re-evaluates current pitch).
- While `mode=settings`: do not raise confirm (same deferral as chat).
- Phone quick buttons `15°` / `20°` remain available outside settings for deskless dogfood.

## Look-up sensing (IMU)

- Pose `lookUp` / `neutral` is driven by gravity-normalized accel pitch (Even Hub `imuData`).
- Pitch: `atan2(x, z)` in degrees; **positive = look up** (head back / +x), rest ≈ +z.
- Roll: `atan2(y, z)` in degrees; **positive = tilt-R** (+y), **negative = tilt-L** (−y). Phone debug shows both `pitch` and `roll`.
- Threshold lives in app state (`lookUpThresholdDeg`); Settings UI and phone quick buttons both write it.
- Hysteresis: leave `lookUp` when pitch &lt; threshold − **10°** (15° enter keeps the deck through ~5°; 20° enter through ~10°).
- After the first IMU sample, **temple click does not toggle pose** (avoids blank flicker vs continuous pitch). While lookUp, temple maps to the same controls as head tilt (below).
- Phone buttons remain manual overrides for deskless dogfood.
- Simulator has no IMU: use `?mockImu=1` or phone `mock↑` / `mock→` buttons; temple toggle stays available until IMU is seen.
- **Appear/disappear is instantaneous** (deck present ↔ blank). No brightness ramp — Hub has no true fade API worth the complexity here.

## Head-tilt controls (lookUp baseline)

Aligned with `even-head-tilt-control`. Fixed bindings (not user-editable yet):

| Control | Gesture | Detection vs lookUp baseline |
|---|---|---|
| `tap` | `nod` | Pitch dip ≥ **−5°** then return to lookUp (oscillate; not a tilt-F hold) |
| `dbl` | `tilt-B` | Hold further back (+x) |
| `swipe-up` | `tilt-L` | Hold roll −y |
| `swipe-down` | `tilt-R` | Hold roll +y |

- **Base pose must be `lookUp`.** Flat neutral does not arm tilt controls. On enter lookUp, gravity is snapped as the gesture baseline; leaving lookUp disarms.
- Hold enter threshold **0.20** (accel offset), dwell **100ms** before emitting dbl / swipe-*.
- **Exit band is wide (threshold − 10°)** so nod dips and roll holds do not blank the deck.
- **Dev debug-ws:** Vite serves `ws://…/__debug_ws`; phone streams IMU / tilt / control JSON to `/tmp/hudeck-debug.log` (override with `HUDECK_DEBUG_LOG`). Tail while dogfooding: `tail -f /tmp/hudeck-debug.log`. Production builds disable the client.
- Temple while lookUp: `CLICK`→tap, `DOUBLE_CLICK`→dbl, `SCROLL_TOP`→swipe-up, `SCROLL_BOTTOM`→swipe-down.
- Deck: swipe moves `menuIndex`; tap activates (Record / Chat / Settings); dbl is reserved for dismiss in nested modes / pending confirm.
- Settings: swipe cycles 15°/20°; tap or dbl closes.
- Pending confirm while lookUp: tap accepts, dbl dismisses.

## Chat

- Enter **only** from the lookUp glance deck (active).
- Look down = **minimize**, not exit.
- Exit = explicit close only (no idle timeout).
- Revisit auto-end later if continuous sessions feel unnecessary.

## Settings

- Enter **only** from idle lookUp (no pending confirm), like chat.
- Look down = **minimize** (`S` indicator), not exit.
- Exit = explicit close only.
- Owns look-up threshold selection; does not own pose/confirm policy beyond that.

## Suggesting

- Orthogonal **layer**, not a top-level mode.
- **ON** when recording starts (auto), or when user sets suggest-armed (default armed flag **OFF** until recording).
- Not always-on from conversation detect alone.
- **OFF** during `chat`; respect ambient mute when added.
- Hint body mainly on **lookUp**; keep neutral quiet.

## Timers (initial, tunable)

| Item | Default |
|---|---|
| Confirm no-op timeout | 12s |
| Cooldown after dismiss (pose/explicit) | 3 min |
| Cooldown after timeout | 90s |
| Chat idle auto-end | none |
| Recording max duration | none (show elapsed on lookUp) |

## Non-goals (v1 shell)

- Always-on auto-record without confirm
- Hard confirm interrupt of chat
- Post-recording automatic transition into chat
- Multi-widget generic dashboard clutter on glance-up
