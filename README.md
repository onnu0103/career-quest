# キャリアクエスト（iPhoneアプリ）

Claudeのアーティファクトで作った「キャリアクエスト」を、App Storeで配信するためのiPhoneアプリです。
Expo（React Native）で作っていて、Macがなくても [Expo Launch](https://launch.expo.dev) からビルドと提出ができます。

## しくみ

```
アーティファクトのHTML（web/career-quest.html）
        │  scripts/build-web.mjs で、Firebase と iPhone用の橋渡し（web/bridge.js）を入れる
        ▼
src/webHtml.js（1つの文字列）
        │  App.js の WebView で表示する
        ▼
iPhoneアプリ
```

- **ランキング・実績書・通報・ご要望**：アーティファクトでは Claude の共有データベースを使っていました。アプリでは同じ形のまま **Firebase（匿名ログイン＋Firestore）** に置き換えています（`web/bridge.js`）。
- **iPhoneならではの機能**：毎日のリマインド通知（マイページで時刻を選ぶ）、達成を報告したときの振動。
- **通信できないとき／Firebaseが未設定のとき**：アプリ本体が「この端末のみ」のモードで動きます。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `web/career-quest.html` | アーティファクトのHTML（そのままのコピー） |
| `web/bridge.js` | Firebase と iPhone の機能を、アプリ本体から使えるようにする |
| `scripts/build-web.mjs` | 上の2つと Firebase を1つにまとめて `src/webHtml.js` を作る |
| `src/webHtml.js` | 自動で作られるファイル（直接書き換えない） |
| `firebase-config.json` | Firebase の設定値（Firebaseの画面の `firebaseConfig`）。未設定なら `null` |
| `firebase/firestore.rules` | Firestore のセキュリティルール |
| `App.js` | WebView・通知・振動 |
| `app.json` | アプリ名・アイコン・バンドルIDなど |

## はじめの設定（Firebase）

1. Firebaseでプロジェクトを作り、Authentication の「匿名」を有効にし、Firestore Database を作る（東京・本番環境モード）。
2. プロジェクトの設定 →「マイアプリ」でウェブアプリを登録し、`firebaseConfig` の中身を `firebase-config.json` に書く。
3. `npm run build:web` で `src/webHtml.js` を作り直す。
4. `firebase/firestore.rules` の中身を、Firebaseの「Firestore Database」→「ルール」に貼って公開する。

### オーナー（通報の確認・ご要望への返事ができる人）になる

1. アプリを開き、マイページの「アカウント」に出る自分のユーザーIDをコピーする。
2. Firebaseの「Firestore Database」で、コレクション `admins` を作り、ドキュメントIDを **自分のユーザーID** にしたドキュメントを1つ作る（フィールドは `role: "owner"` など何でもよい）。
3. アプリを開き直すと、マイページに「運営者メニュー」が出ます。

匿名ログインなので、アプリを削除するとIDが変わります。そのときは新しいIDで `admins` を作り直してください。

## 公開のしかた（Macなし）

1. Safariで [launch.expo.dev](https://launch.expo.dev) を開き、このリポジトリのURLを入れる。
2. Expo と Apple のアカウントでサインインし、「Launch」を押す。
3. TestFlight で確認してから、App Store Connect で審査に提出する。

## アーティファクトを更新したとき

1. 新しいHTMLを `web/career-quest.html` に上書きする。
2. `npm run build:web` を実行する。書き換えの目印が見つからないときはエラーで止まるので、`scripts/build-web.mjs` の `PATCHES` を直す。
3. コミットして、Expo Launch でビルドし直す。
