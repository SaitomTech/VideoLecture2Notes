# Video Notes Agent Guide

実装前に、以下のドキュメントを確認してください。

- [初期構想](./docs/初期構想.md) — プロダクトの目的・仕様・開発フェーズ
- [設計ガイド](./docs/設計ガイド.md) — フォルダ構造・責務境界・実装ルール

変更後は、次のコマンドで確認します。

```bash
bun run fmt         # プロジェクト全体をOxfmtで整形
bun run fmt:check   # 整形チェックのみ
bun run setup       # 不足しているffmpeg/ffprobe/whisper/llama sidecarを取得
bun run build
bun run lint
```

コード変更後は、対象ファイルを絞る場合は`vp fmt <変更したファイル>`、複数ファイルを変更した場合は`bun run fmt`で整形します。コード変更時は、実装と整形を同じ作業として扱ってください。

Tauriアプリを起動するときは`bun tauri dev`を使います。`bun run dev`と`bun run build`にはsidecarの存在確認・取得が前処理として含まれています。
