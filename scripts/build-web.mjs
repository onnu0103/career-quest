// web/career-quest.html（Claudeのアーティファクトのまま）から、
// iPhoneアプリに入れる src/webHtml.js を作る。
//
//   node scripts/build-web.mjs
//
// やっていること
//   1. Firebase（app / auth / firestore の compat版）と設定、web/bridge.js を <head> に入れる
//   2. アプリ本体に、iPhoneアプリ用の小さな書き換えをする（PATCHES）
//   3. 1つの文字列として src/webHtml.js に書き出す
//
// アーティファクトを更新したら、web/career-quest.html を差し替えてこれを実行し直す。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const args = new Set(process.argv.slice(2));
const outArg = process.argv.find((a) => a.startsWith('--out='));
const emuArg = process.argv.find((a) => a.startsWith('--emulator='));

let html = read('web/career-quest.html');

/* ---------- 2. 書き換え ---------- */
// [説明, 探す文字列, 置き換える文字列]。探す文字列は、ちょうど1か所にないとエラーにする。
const PATCHES = [
  [
    '入力欄を押したときに画面が拡大されないようにする',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">',
  ],
  [
    'Firebaseの保存エラーを、わかる言葉で伝える',
    "  if (c === 'resource_exhausted') return '操作が多すぎます。少し待ってからもう一度お試しください。';",
    "  if (c === 'resource_exhausted' || c === 'resource-exhausted') return '操作が多すぎます。少し待ってからもう一度お試しください。';\n" +
      "  if (c === 'permission-denied') return '保存できませんでした。アプリを開き直して、もう一度お試しください。';",
  ],
  [
    'アカウント削除のとき、ログインの情報も消す',
    "      await db.doc('players/' + uid).delete();\n",
    "      await db.doc('players/' + uid).delete();\n" +
      "      try { if (S.user && S.user.deleteAccount) await S.user.deleteAccount(); } catch(e){}\n",
  ],
  [
    '達成を報告したら、iPhoneを軽く振動させる',
    '    celebrate(q, levelOf(agg.total).L > beforeL ? levelOf(agg.total).L : 0);',
    "    celebrate(q, levelOf(agg.total).L > beforeL ? levelOf(agg.total).L : 0);\n" +
      "    try { if (window.cqHaptic) window.cqHaptic('success'); } catch(e){}",
  ],
  [
    'マイページに「毎日のリマインド」欄を入れる',
    "  h += '<section><h2 class=\"sec-h sub\">アカウント</h2><div class=\"form\">' +",
    "  if (window.cqReminderHtml) h += window.cqReminderHtml();\n" +
      "  h += '<section><h2 class=\"sec-h sub\">アカウント</h2><div class=\"form\">' +",
  ],
  [
    'マイページの「アカウント」に、自分のユーザーIDを出す（お問い合わせとオーナー登録に使う）',
    "    '<button type=\"button\" class=\"btn-danger\" data-act=\"del-account\"'",
    "    (window.cqIdHtml ? window.cqIdHtml(S.mode === 'online' ? S.uid : '') : '') +\n" +
      "    '<button type=\"button\" class=\"btn-danger\" data-act=\"del-account\"'",
  ],
  [
    'Claudeで共有するとき向けの説明を、アプリでは出さない',
    "  if (S.isOwner) h += '<div class=\"notice\"><h3>オーナーの方へ</h3>",
    "  if (S.isOwner && !window.CQ_APP) h += '<div class=\"notice\"><h3>オーナーの方へ</h3>",
  ],
  [
    'アプリは端末ごとのログインなので、「どの端末からでも続きができます」を正しい説明に直す',
    'データはみんなと共有され、どの端末からでも続きができます。',
    'データはみんなと共有されます。ログインはこのiPhoneごとなので、アプリを削除したり機種を変えたりすると、前の記録には戻れません。',
  ],
  [
    '「このブラウザ」を「この端末」に',
    'データはこのブラウザだけに保存されます。',
    'データはこの端末だけに保存されます。',
  ],
  [
    'プライバシーポリシーに、委託先（Firebase）を書く',
    'データの保存とログインのために、クラウドサービスの事業者に取り扱いを委託します。',
    'データの保存とログインのために、米国のGoogle LLCが提供するクラウドサービス「Firebase」に取り扱いを委託します。情報は日本国外のサーバーで取り扱われることがあります。',
  ],
  [
    'プライバシーポリシーに、通知のことを書く',
    '広告や、利用状況を分析するための外部ツールも使っていません。</p>',
    '広告や、利用状況を分析するための外部ツールも使っていません。毎日のリマインド通知は、端末の中だけで設定し、運営者には送られません。</p>',
  ],
  [
    '橋渡し（bridge.js）から、通知を出す関数を使えるようにする',
    '/* ---------- 起動 ---------- */\ntry {',
    'window.cqApp = {toast: toast};\n\n/* ---------- 起動 ---------- */\ntry {',
  ],
];

for (const [label, find, replace] of PATCHES) {
  const n = html.split(find).length - 1;
  if (n !== 1) {
    console.error(`書き換えできません（${n}か所見つかりました）：${label}`);
    process.exit(1);
  }
  html = html.replace(find, () => replace);
}

/* ---------- 1. Firebaseと橋渡しを入れる ---------- */
let cfg = null;
if (existsSync(join(root, 'firebase-config.json'))) {
  cfg = JSON.parse(read('firebase-config.json'));
}
let emulator = null;
if (emuArg) {
  // テスト用：--emulator=127.0.0.1:9099,127.0.0.1:8080
  const [authHost, fsHost] = emuArg.slice('--emulator='.length).split(',');
  emulator = { auth: authHost, firestore: fsHost };
  cfg = cfg && cfg.apiKey ? cfg : { apiKey: 'demo-key', projectId: 'demo-career-quest', authDomain: 'demo-career-quest.firebaseapp.com' };
}

const fbDir = join(root, 'node_modules/firebase');
const sdk = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']
  .map((f) => readFileSync(join(fbDir, f), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, ''));
const bridge = read('web/bridge.js');

const safe = (js) => js.replace(/<\/(script)/gi, '<\\/$1');
// テスト用：--no-sdk のときは Firebase を入れず、テスト側が用意した偽物の window.firebase を使う
const noSdk = args.has('--no-sdk');
if (noSdk) cfg = { apiKey: 'test-key', projectId: 'test-career-quest' };
const head =
  (noSdk ? '' :
    '<script>' + safe(sdk[0]) + '</script>\n' +
    '<script>' + safe(sdk[1]) + '</script>\n' +
    '<script>' + safe(sdk[2]) + '</script>\n') +
  '<script>window.__CQ_FIREBASE__ = ' + JSON.stringify(cfg) + ';' +
  (emulator ? 'window.__CQ_EMULATOR__ = ' + JSON.stringify(emulator) + ';' : '') + '</script>\n' +
  '<script>' + safe(bridge) + '</script>\n';

const marker = '<script>\n(function(){\n\'use strict\';';
if (html.split(marker).length !== 2) {
  console.error('アプリ本体の <script> が見つかりません');
  process.exit(1);
}
html = html.replace(marker, () => head + marker);

/* ---------- 3. 書き出す ---------- */
if (outArg) {
  // テスト用に、そのままのHTMLとして書き出す
  writeFileSync(outArg.slice('--out='.length), html);
} else {
  const js =
    '// このファイルは scripts/build-web.mjs が作ります。直接書き換えないでください。\n' +
    'export default ' + JSON.stringify(html) + ';\n';
  writeFileSync(join(root, 'src/webHtml.js'), js);
}
console.log(
  `できました（${(html.length / 1024).toFixed(0)} KB、Firebase：${cfg && cfg.apiKey ? '設定あり' : '未設定 → この端末のみで動きます'}${emulator ? '、エミュレータ' : ''}）`
);
if (args.has('--check')) process.exit(0);
