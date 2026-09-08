# VideoLecture2Notes

PowerPointやKeynoteなどのスライドを画面に投影した講演・講義動画を、**スライドごとの画像と、そのスライドで話された内容を読める記事**に変換するmacOSアプリです。

スライド範囲の検出、スライド切り替わりの検出、OCR、文字起こし、表記補正、記事本文の生成を、ローカルモデルやmacOS標準機能、OpenAI APIなどを組み合わせて行います。

現在はmacOS Apple Silicon（arm64）を対象にしています。Apple SpeechおよびApple Foundation Modelsを使う機能はmacOS 26以降が必要です。

## できること

- ローカル動画またはYouTube動画の読み込み
- スライド範囲・切り替わりの検出
- スライド画像のOCRと音声の文字起こし
- OCRを使った用語・固有名詞の表記補正
- スライドごとの記事本文の生成
- Markdown・HTML・TXTへのエクスポート
- ローカルモデル、macOS標準機能、OpenAI APIの選択

## 共通事項

### 動作環境

- Apple Silicon搭載Mac（現在の配布物はarm64版のみ）
- macOS 26以降（Apple Speech / Foundation Modelsを利用する場合）
- ローカルモデルを使う場合は、初回ダウンロード用のインターネット接続
- OpenAI APIを使う場合は、APIへ接続できるインターネット環境

### OpenAI APIの利用

OpenAIの機能を使う場合は、アプリ内に自分のOpenAI APIキーを入力します。キーはmacOS Keychainに保存され、リポジトリやGitHub Actionsには保存しません。OpenAI APIの利用料金は入力したAPIキーのアカウントに発生します。

OpenAIを選択した処理では、選択した音声・画像・文字起こし・本文データがOpenAI APIへ送信されます。ローカルモデルとApple標準モデルのデータ処理、送信先の詳細は[プライバシーとデータ取り扱い](./docs/プライバシー.md)を確認してください。

### モデルとダウンロード

ローカルモデルは初回利用時にHugging Faceからダウンロードされ、アプリのローカルデータ領域に保存されます。モデルファイルはこのリポジトリやDMGには含めていません。取得元、バージョン、ハッシュ、ライセンスは[Third-party notices](./THIRD_PARTY_NOTICES.md)にまとめています。

## 利用者向け

### DMGから使う

[Releases](https://github.com/SaitomTech/VideoLecture2Notes/releases)からDMGをダウンロードし、アプリを`Applications`へ移動して起動してください。

DMGからインストールして使う場合、Bun・Rust toolchain・Xcode Command Line Toolsは不要です。

Apple Developer Program未使用の未署名アプリのため、macOSに起動を止められる場合があります。信頼できるGitHub Releaseからダウンロードした場合に限り、ターミナルで次を実行してください。

```bash
xattr -dr com.apple.quarantine "/Applications/videolecture2notes.app"
open "/Applications/videolecture2notes.app"
```

アプリを`Applications`以外に置いた場合は、パスを実際の`.app`の場所に置き換えてください。Finderでアプリを右クリックして「開く」でも起動できる場合があります。

## 開発者向け

### 開発環境

- [Bun](https://bun.sh/)
- Rust toolchain
- Xcode Command Line Tools（Swiftのsidecarをビルドするため）

### 開発環境のセットアップ

```bash
bun install --frozen-lockfile
bun run setup
bun tauri dev
```

`bun run setup`またはビルド時に、macOS arm64用のsidecarを取得・ビルドします。初回は外部バイナリのダウンロードに時間がかかることがあります。

### ローカルビルド

```bash
bun run build
bunx tauri build --bundles dmg
```

生成物は`src-tauri/target/release/bundle/`以下に作成されます。現在の配布物はApple Silicon用DMGのみです。

## リリース

リリースは、バージョンを更新して`main`のコミットにタグを作成すると開始します。GitHub画面のタグ作成でも、コマンドラインからのタグpushでも構いません。

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

GitHub Actionsはタグのコミットが`main`の履歴に含まれているかを確認します。`develop`にしかない未マージのコミットを指定した場合はビルドを開始せず失敗します。

その後、DMGを先にビルドしてDraft Releaseへ添付し、ビルドが成功した場合だけReleaseを公開します。ビルド中や失敗時のDraft Releaseは、アプリ内の更新確認からは見えません。Release notesはGitHubの自動生成機能で作成されます。

アプリ内の更新確認はGitHub Releases APIを認証なしで参照するため、リポジトリとReleaseをPublicにする必要があります。現在はReleaseページを開くだけで、自動インストールは行いません。

## ライセンス

このプロジェクトのコードはMIT Licenseです。外部ライブラリ、sidecar、AIモデル、アイコンなどにはそれぞれのライセンスが適用されます。配布物には[Third-party notices](./THIRD_PARTY_NOTICES.md)と`LICENSE`を同梱しています。DMG内ではアプリの`Contents/Resources`に入り、アプリ上部の「ライセンス」からも表示できます。
