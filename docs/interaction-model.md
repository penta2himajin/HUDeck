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
  mode:        idle | recording | chat
  confirm:     inactive | pending(tier)
  suggesting:  on | off

Body / environment
  pose:        neutral | lookUp
  (gestures are events, not states)
```

```text
view = f(mode, confirm, suggesting, pose)
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
- **Accept (common):** `neutral` + nod accepts at any pending tier without opening detail. Nod while pending in lookUp also accepts.
- **Dismiss via pose:** **detail → neutral** dismisses (inspected, then declined).
- **minimal → neutral:** does **not** dismiss; demotes to **compact**.
- **Timeout:** compact/minimal with no action → dismiss (default **12s**).
- **Cooldown after explicit dismiss:** **3 min**. After timeout dismiss: **90s**.
- **While `mode=chat`:** do not raise confirm (defer/drop). Nod must not collide with chat.
- **While `mode=recording`:** no new confirm.

## Mode × pose views

| mode | pose | view |
|---|---|---|
| idle (no confirm) | neutral | Fully quiet: no brand text, no deck frame (capture surface only) |
| idle (no confirm) | lookUp | Glance deck with **HUDeck** title (brand is lookUp-only) |
| idle + confirm compact | neutral | Compact confirm |
| idle + confirm minimal | lookUp | Deck remains; `REC?` affordance |
| idle + confirm detail | lookUp | Confirm detail |
| recording | neutral | Recording indicator only |
| recording | lookUp | Elapsed / transcript / stop / mark |
| chat | lookUp | Chat UI |
| chat | neutral | Minimized; session continues; tiny `C` indicator (tunable) |

## Look-up sensing (IMU)

- Pose `lookUp` / `neutral` is driven by gravity-normalized accel pitch (Even Hub `imuData`).
- Pitch: `atan2(x, z)` in degrees; **positive = look up** (head back / +x), rest ≈ +z.
- Switchable enter thresholds: **20°** (default) and **30°** (persisted in localStorage).
- Hysteresis: leave `lookUp` when pitch &lt; threshold − **5°**.
- After the first IMU sample, **temple click does not toggle pose** (avoids blank flicker vs continuous pitch).
- Phone buttons remain manual overrides for deskless dogfood.
- Simulator has no IMU: use `?mockImu=1` or phone `mock↑` / `mock→` buttons; temple toggle stays available until IMU is seen.
- **Appear/disappear is instantaneous** (deck present ↔ blank). No brightness ramp — Hub has no true fade API worth the complexity here.

## Chat

- Enter **only** from the lookUp glance deck (active).
- Look down = **minimize**, not exit.
- Exit = explicit close only (no idle timeout).
- Revisit auto-end later if continuous sessions feel unnecessary.

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
