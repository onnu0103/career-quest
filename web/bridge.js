/*
 * キャリアクエスト（iPhoneアプリ版）の橋渡し
 *
 * 1. Claudeのアーティファクトが持っている window.claude.use('db' / 'user') を、
 *    Firebase（匿名ログイン＋Firestore）で同じ形に作り直す。
 *    アプリ本体（career-quest.html）は、ほぼそのまま「オンライン」として動く。
 * 2. iPhoneの機能（毎日のリマインド通知・振動）を、アプリ本体から呼べるようにする。
 *
 * window.__CQ_FIREBASE__ はビルド時に firebase-config.json から埋め込まれる。
 * 設定が空（null）のときや、通信できないときは、アプリ本体が「この端末のみ」で動く。
 */
(function () {
  'use strict';
  var RN = window.ReactNativeWebView || null;
  window.CQ_APP = true;
  window.CQ_NATIVE = !!RN;

  function post(msg) {
    try { if (RN) RN.postMessage(JSON.stringify(msg)); } catch (e) {}
  }

  /* ---------- 1. Firebase ---------- */
  var CFG = window.__CQ_FIREBASE__ || null;
  var EMU = window.__CQ_EMULATOR__ || null; // テスト用（本番では使わない）
  var fb = window.firebase;
  var ready = Promise.resolve(null);
  var fs = null, auth = null;

  if (CFG && CFG.apiKey && CFG.projectId && fb && typeof fb.initializeApp === 'function') {
    try {
      fb.initializeApp(CFG);
      auth = fb.auth();
      fs = fb.firestore();
      if (EMU) {
        auth.useEmulator('http://' + EMU.auth);
        var h = EMU.firestore.split(':');
        fs.useEmulator(h[0], Number(h[1]));
      }
      ready = new Promise(function (resolve) {
        var done = false;
        function finish(u) { if (!done) { done = true; resolve(u || null); } }
        // 通信できないまま待ち続けないように、10秒で「この端末のみ」に切り替える
        setTimeout(function () { finish(auth.currentUser); }, 10000);
        auth.signInAnonymously()
          .then(function (cred) { finish(cred && cred.user); })
          .catch(function () { finish(auth.currentUser); });
      });
    } catch (e) {
      ready = Promise.resolve(null);
    }
  }

  var userCap = {
    id: function () {
      return ready.then(function (u) { if (!u) throw new Error('not signed in'); return u.uid; });
    },
    // オーナーは、Firestoreの admins/{自分のID} というドキュメントがある人
    isOwner: function () {
      return ready.then(function (u) {
        if (!u || !fs) return false;
        return fs.doc('admins/' + u.uid).get()
          .then(function (s) { return !!s.exists; })
          .catch(function () { return false; });
      });
    },
    can: function () { return true; },
    // アカウント削除のとき、ログインの情報も消す
    deleteAccount: function () {
      var u = auth && auth.currentUser;
      return u ? u.delete().catch(function () {}) : Promise.resolve();
    }
  };

  if (fs) {
    window.claude = {
      use: function (name) {
        if (name === 'db') return ready.then(function (u) { return u ? fs : null; });
        if (name === 'user') return ready.then(function (u) { return u ? userCap : null; });
        return Promise.resolve(null);
      }
    };
  }

  /* ---------- 2. iPhoneの機能 ---------- */
  window.cqHaptic = function (kind) { post({ type: 'haptic', kind: kind || 'success' }); };

  var REM_KEY = 'careerquest.reminder.v1';
  function getRem() {
    try {
      var j = JSON.parse(localStorage.getItem(REM_KEY) || 'null');
      if (j && typeof j.on === 'boolean' && j.h >= 0 && j.h < 24 && (j.m === 0 || j.m === 30)) return j;
    } catch (e) {}
    return { on: false, h: 21, m: 0 };
  }
  function setRem(r) { try { localStorage.setItem(REM_KEY, JSON.stringify(r)); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toast(msg) { try { if (window.cqApp && window.cqApp.toast) window.cqApp.toast(msg); } catch (e) {} }

  // マイページに入れる「毎日のリマインド」欄（iPhoneアプリのときだけ）
  window.cqReminderHtml = function () {
    if (!RN) return '';
    var r = getRem(), opts = '';
    for (var h = 5; h <= 23; h++) {
      [0, 30].forEach(function (m) {
        var sel = (h === r.h && m === r.m) ? ' selected' : '';
        opts += '<option value="' + h + ':' + m + '"' + sel + '>' + h + ':' + pad(m) + '</option>';
      });
    }
    return '<section><h2 class="sec-h sub">毎日のリマインド</h2><div class="form">' +
      '<label class="switch" for="cq-rem-on"><input type="checkbox" id="cq-rem-on"' + (r.on ? ' checked' : '') + '>' +
      '<span><b>毎日、任務の通知を受け取る</b><span class="muted small">決めた時刻に、今日の任務を思い出す通知が届きます</span></span></label>' +
      '<div class="field"><label for="cq-rem-time">通知する時刻</label>' +
      '<select class="txt" id="cq-rem-time"' + (r.on ? '' : ' disabled') + '>' + opts + '</select></div>' +
      '<p class="note">通知はこのiPhoneの中だけで設定され、運営者には送られません。</p></div></section>';
  };

  // マイページの「アカウント」に出す、自分のユーザーID
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  window.cqIdHtml = function (uid) {
    if (!uid) return '';
    return '<p class="small" style="margin:0">ユーザーID：<span style="font-family:var(--num);user-select:all;-webkit-user-select:all;word-break:break-all">' +
      escHtml(uid) + '</span> <button type="button" class="n-btn ghost" id="cq-copy-id" data-uid="' + escHtml(uid) + '">コピー</button></p>' +
      '<p class="note" style="margin:0">お問い合わせのときに伝えてください。</p>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#cq-copy-id');
    if (!b) return;
    var id = b.getAttribute('data-uid') || '';
    var done = function () { toast('ユーザーIDをコピーしました'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(done, function () { toast('ユーザーID：' + id); });
        return;
      }
    } catch (err) {}
    toast('ユーザーID：' + id);
  });

  function readRemForm() {
    var on = document.getElementById('cq-rem-on');
    var tm = document.getElementById('cq-rem-time');
    if (!on || !tm) return null;
    var v = String(tm.value || '21:0').split(':');
    return { on: !!on.checked, h: Number(v[0]) || 0, m: Number(v[1]) || 0 };
  }
  function syncRemForm(r) {
    var on = document.getElementById('cq-rem-on');
    var tm = document.getElementById('cq-rem-time');
    if (on) on.checked = r.on;
    if (tm) { tm.disabled = !r.on; tm.value = r.h + ':' + r.m; }
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || (t.id !== 'cq-rem-on' && t.id !== 'cq-rem-time')) return;
    var r = readRemForm(); if (!r) return;
    setRem(r); syncRemForm(r);
    post({ type: 'reminder', on: r.on, hour: r.h, minute: r.m, ask: true });
  });

  // iPhone側からの返事
  window.cqFromNative = function (msg) {
    if (!msg || msg.type !== 'reminder-result') return;
    if (msg.ok) {
      if (!msg.silent) toast(msg.on ? '毎日 ' + msg.hour + ':' + pad(msg.minute) + ' に通知します' : '毎日の通知をオフにしました');
      return;
    }
    var r = getRem(); r.on = false; setRem(r); syncRemForm(r);
    if (!msg.silent) {
      toast(msg.reason === 'denied'
        ? '通知が許可されていません。iPhoneの「設定」→「キャリアクエスト」→「通知」から許可してください。'
        : '通知を設定できませんでした。もう一度お試しください。');
    }
  };

  // 起動したら、保存してある設定で通知を予約し直す（許可の確認は出さない）
  if (RN) {
    var r0 = getRem();
    post({ type: 'reminder', on: r0.on, hour: r0.h, minute: r0.m, ask: false });
  }
})();
