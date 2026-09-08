# Video Lecture to Notes

講義・講演動画から、文字起こし、スライド検出、OCR、記事本文の生成までをmacOS上で行うTauriアプリです。

現在はmacOS Apple Silicon（arm64）を対象にしています。Apple SpeechおよびApple Foundation Modelsを使う機能はmacOS 26以降が必要です。

## できること

- 動画を読み込み、音声をスライド単位に分割
- YouTubeの公開動画URLから動画をプロジェクトへ読み込み
- Whisper系モデルによるローカル文字起こし
- Apple Vision、ローカルモデル、OpenAI APIによるOCR
- Apple Foundation Models、ローカルLLM、OpenAI APIによる本文生成
- Markdown・HTML・TXTへのエクスポート
- プロジェクトのローカル保存と再開

## 使い方

画面ごとの操作、OpenAIを使わない設定、モデルの選び方、データの保存先は[使い方](./docs/使い方.md)を確認してください。

## 動作環境

- Apple Silicon搭載Mac
- macOS 26以降（Apple Speech / Foundation Modelsを利用する場合）
- [Bun](https://bun.sh/)
- Rust toolchain
- Xcode Command Line Tools（Swiftのsidecarをビルドするため）

## 開発環境のセットアップ

```bash
bun install --frozen-lockfile
bun run setup
bun tauri dev
```

`bun run setup`またはビルド時に、macOS arm64用のsidecarを取得・ビルドします。初回は外部バイナリのダウンロードに時間がかかることがあります。

## ローカルビルド

```bash
bun run build
bunx tauri build --bundles dmg
```

生成物は`src-tauri/target/release/bundle/`以下に作成されます。現在の配布物はApple Silicon用DMGのみです。

## macOSで「アプリが壊れているため開けません」と表示される場合

自分でビルドしたもの、または信頼できるGitHub Releaseからダウンロードしたものに限り、ターミナルでダウンロード時の隔離属性を外して起動できます。

```bash
xattr -dr com.apple.quarantine "/Applications/videolecture2notes.app"
open "/Applications/videolecture2notes.app"
```

アプリを`Applications`以外に置いている場合は、パスを実際の`.app`の場所に置き換えてください。Finderでアプリを右クリックして「開く」を選ぶ方法でも起動できる場合があります。この対応はAppleのコード署名やnotarizationの代わりにはなりません。

## OpenAI APIの利用

OpenAIの機能を使う場合は、アプリ内に自分のOpenAI APIキーを入力します。キーはmacOS Keychainに保存され、リポジトリやGitHub Actionsには保存しません。OpenAI APIの利用料金は入力したAPIキーのアカウントに発生します。

OpenAIを選択した処理では、選択した音声・画像・文字起こし・本文データがOpenAI APIへ送信されます。ローカルモデルとApple標準モデルのデータ処理、送信先の詳細は[プライバシーとデータ取り扱い](./docs/プライバシー.md)を確認してください。

## モデルとダウンロード

ローカルモデルは初回利用時にHugging Faceからダウンロードされ、アプリのローカルデータ領域に保存されます。モデルファイルはこのリポジトリには含めていません。取得元、ハッシュ、ライセンスの確認事項は[第三者ライセンスとNOTICE](./docs/第三者ライセンス.md)にまとめています。

## リリース

リリースは、GitHub画面でタグとReleaseを作成すると、GitHub ActionsがDMGをビルドしてReleaseへ添付します。

アプリ内の更新確認はGitHub Releases APIを認証なしで参照するため、リポジトリとReleaseをPublicにする必要があります。現在はReleaseページを開くだけで、自動インストールは行いません。

## ライセンス

このプロジェクトのコードはMIT Licenseです。外部ライブラリ、sidecar、AIモデル、アイコンなどはそれぞれのライセンスが適用されます。配布時は[第三者ライセンスとNOTICE](./docs/第三者ライセンス.md)の確認事項に従ってください。
