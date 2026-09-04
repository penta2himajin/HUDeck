# HUDeck

> Source: README.md @ working tree

[Even Realities G2](https://www.evenrealities.com/) / [Even Hub](https://hub.evenrealities.com/) 向けの ambient-tech コントロールデッキ。確認付き録音導線、見上げデッキ、録画インジケータ、および文字起こし／サジェスト／チャットのための殻を提供します。

操作モデルの正本: [`docs/interaction-model.md`](./docs/interaction-model.md) · [English README](./README.md)

**Package ID:** `com.pentalab.hudeck`

## セットアップ

```bash
npm ci
git config core.hooksPath git-hooks
```

## 開発

```bash
npm run dev          # http://127.0.0.1:43127
npm run sim
```

実機では IMU ピッチで lookUp（20°/30° 切替）。シミュは `?mockImu=1` または Phone の `mock↑` / `mock→`。

## 検証

```bash
npm run verify:deskless
```

Ready marker: `[hudeck] ready`（[`even-deskless`](https://github.com/penta2himajin/even-deskless)）。

## ライセンス

Apache License 2.0 — [`LICENSE`](./LICENSE) / [`NOTICE`](./NOTICE)。
