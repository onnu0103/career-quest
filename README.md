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
| `docs/index.html` | サポート・利用規約・プライバシーポリシーの公開ページ（GitHub Pagesで公開し、App Store Connectに登録する） |
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

## 公開のしかた（Macなし・iPhoneだけ）

App Store Connect に入れる文章（概要・キーワード・年齢区分・プライバシーの回答・審査メモ）は、Claudeのドキュメント「キャリアクエスト App Store掲載情報の下書き」にまとめてあります。

### 1. 準備

- [Apple Developer Program](https://developer.apple.com/programs/enroll/) に登録する（有料・年会費。登録した名前が App Store の販売元として表示される）。
- [Expo](https://expo.dev/signup) のアカウントを作る（無料）。
- 上の「はじめの設定（Firebase）」が済んでいることを確かめる。とくに **匿名ログインの有効化** と **ルールの公開**。

### 2. サポートページを公開する（GitHub Pages）

App Store Connect には、ログインなしで誰でも開ける「サポートURL」と「プライバシーポリシーURL」が必要です。

1. Safariでこのリポジトリを開き、「Settings」→「Pages」を開く（スマホ表示で見つからないときは、アドレスバー左の「ぁあ」→「デスクトップ用Webサイトを表示」）。
2. 「Build and deployment」の Source を **Deploy from a branch**、Branch を **main** と **/docs** にして「Save」。
3. 数分後、Safariのプライベートブラウズで次のURLが開けることを確かめる。

| App Store Connect の項目 | 入れるURL |
| --- | --- |
| サポートURL | https://onnu0103.github.io/career-quest/ |
| プライバシーポリシーURL | https://onnu0103.github.io/career-quest/#privacy |

### 3. ビルドして TestFlight で確かめる

1. Safariで [launch.expo.dev](https://launch.expo.dev) を開き、このリポジトリのURL（`https://github.com/onnu0103/career-quest`）を入れる。
2. Expo と Apple のアカウントでサインインし、「Launch」を押す。証明書・App Store Connect へのアプリ登録・ビルド・提出まで自動で進み、終わると TestFlight の招待が届く。
3. TestFlight からインストールして、次を確かめる。
   - 画面右上の丸が **緑**（みんなと共有）になっている。灰色（この端末のみ）なら、Firebaseの匿名ログインが有効になっているか確認する。
   - 登録（18歳以上・同意）→ 目標を立てる → 達成を報告する、まで保存できる。「保存できませんでした」と出るなら、Firestoreのルールが公開されているか確認する。
   - マイページの「毎日のリマインド」をオンにすると、通知の許可を聞かれ、その時刻に通知が届く。
   - 「オーナーになる」の手順で自分を `admins` に登録し、マイページに「運営者メニュー」が出る。
   - 最後に「アカウントを削除する」が最後まで進む（そのあと新しいIDで登録し直し、`admins` も作り直す）。

### 4. 審査に提出する

1. [App Store Connect](https://appstoreconnect.apple.com)（Safariで開ける）で、掲載情報の下書きどおりに、概要・キーワード・サポートURL・プライバシーポリシーURL・年齢区分・Appのプライバシー・審査メモを入れる。
2. スクリーンショット（6.9インチ、1320×2868）を入れる。
3. TestFlight で確かめたビルドを選び、「審査用に追加」→「審査へ提出」。
4. 公開後は、通報（マイページ「通報の確認」）とご要望（「運営者メニュー」）に早めに対応する。審査でも、通報に対応する体制があることが求められています。

## アーティファクトを更新したとき

1. 新しいHTMLを `web/career-quest.html` に上書きする。
2. `npm run build:web` を実行する。書き換えの目印が見つからないときはエラーで止まるので、`scripts/build-web.mjs` の `PATCHES` を直す。
3. 利用規約やプライバシーポリシーの文章が変わったときは、`docs/index.html` も同じ内容に直す（アプリ内の文章と公開ページがずれないように）。
4. コミットして、Expo Launch でビルドし直す。
