# Chrome Local Translator

**学習用リポジトリです。**
Gemini 無料版を使用

ローカルLLM（NLLB-200）を使って、選択したテキストをその場で日本語翻訳するChrome拡張機能。
翻訳結果は選択箇所の近くに吹き出しで表示され、どこかをクリックすると消える。
また、VOICEVOX導入は任意で、無くても動く。

## 使い方

1. Chrome拡張機能のデベロッパーモードをONにして、パッケージ化されていない拡張機能でフォルダを読み込む
2. `server.js`のあるフォルダで`node server.js`を実行してサーバーを起動しておく
3. VOICEVOXを起動しておく。
4. Chromeで翻訳したいテキストを選択
5. `Alt+W`を押す（または拡張機能アイコンをクリック）
6. 吹き出しで翻訳結果、VOICEVOXの音声と処理時間が表示される

## 構成

- `background.js` ... 拡張機能のメイン処理。テキスト取得→NLLB-200へAPIリクエスト→吹き出し表示→テキストをVOICEVOXAPIリクエスト→音声までを担う
- `manifest.json` ... 拡張機能の設定ファイル。権限やショートカットキーを定義
- `server.js` ... 翻訳サーバー。NLLB-200モデルをCPU推論で実行し、HTTPでリクエストを受け付ける。1分間アクセスがなければモデルを自動解放する

## 公開までの変更点

1. `content.js`をすべてのページに常駐させてアラートで結果表示する方式だったが、動作不安定、何より使い勝手が悪いため廃止。
`chrome.scripting.executeScript`で必要な時だけスクリプトを注入し、吹き出しUIを直接生成する方式に変更した。常駐スクリプトがなくなりパーミッションもシンプルになった。
また`Alt+W`のショートカットを追加した。
2. VOICEVOXを採用
3. LM Studio依存を廃止。`@xenova/transformers`+NLLB-200-distilled-600MによるNode.jsローカルサーバー構成に変更。
VRAM不使用・CPU推論のみで動作するようになった。

## 使用技術

- Chrome Extensions API（Manifest V3）
- @xenova/transformers によるNLLB-200-distilled-600MのCPU推論
- Node.js HTTPサーバー（localhost:57832）

## 現在の状態

以下は未対応

- 長文の翻訳が通らない（トークン制限とメモリ負荷。チャンキング未実装）
- サーバーの自動起動なし（`node server.js` を手動で実行する必要がある）
- VOICEVOXの起動が不安定(おそらくセキュリティ絡み)

## サーバーのセットアップ

```bash
cd server
npm install
npm start
```

### `npm install` が sharp のビルドで失敗する場合（Linux / WSL）

`@xenova/transformers` はネイティブアドオンの `sharp` に依存し、通常は
ビルド済みバイナリが取得されるためコンパイルは不要、失敗すると
Cコンパイラが無い環境では以下で止まる模様

```
make: cc: No such file or directory
gyp ERR! stack Error: `make` failed with exit code: 2
```

対処（Debian / Ubuntu）:

```bash
sudo apt install -y build-essential
```

`build-essential` が `cc` / `g++` / `make` を入れる

`libvips-dev` は必須ではないが、入っている場合は sharp はシステムの libvips に
リンクするため、その後に削除すると動かなくなる。

なお総合環境依存の対処であり、 sharp は翻訳処理では使われない。

## 注意

`Xenova/nllb-200-distilled-600M` を使用している
- モデル: https://huggingface.co/Xenova/nllb-200-distilled-600M
- ライセンス: CC-BY-NC-4.0 https://spdx.org/licenses/CC-BY-NC-4.0

## クレジット
音声合成: VOICEVOX  https://voicevox.hiroshiba.jp/term/
音声: VOICEVOX:春日部つむぎ  https://tsumugi-official.studio.site/rule