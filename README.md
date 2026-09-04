# HUDeck

Ambient-tech control deck for [Even Realities G2](https://www.evenrealities.com/) via [Even Hub](https://hub.evenrealities.com/). Head-gesture-friendly confirms, glance-up deck, recording indicator, and hooks for transcription / suggesting / chat.

Interaction rules (source of truth): [`docs/interaction-model.md`](./docs/interaction-model.md) · [日本語 README](./README.ja.md)

**Package ID:** `com.pentalab.hudeck`

## Setup

```bash
npm ci
git config core.hooksPath git-hooks
```

## Develop

```bash
npm run dev          # http://127.0.0.1:43127
npm run sim          # Hub Simulator + automation port 9898
```

Phone WebView buttons drive pose / detect / nod for deskless dogfood. Temple click in the simulator toggles lookUp ↔ neutral. On device, look-up is driven by IMU pitch (20°/30° switchable on the phone UI).

Deskless IMU mock:

```bash
npm run dev -- --open '/?mockImu=1'
# or phone buttons mock↑ / mock→ ; console: __hudeckInjectImu(x,y,z)
```

## Verify

```bash
npm run verify:deskless   # L0 (tsc + vitest) + L2a simulator smoke
```

Uses [`@penta2himajin/even-deskless`](https://github.com/penta2himajin/even-deskless). Ready marker: `[hudeck] ready`.

## Device sideload

```bash
npm run dev
npm run qr:tunnel    # Cloudflare tunnel + evenhub qr (via even-deskless)
```

## License

Apache License 2.0. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).
