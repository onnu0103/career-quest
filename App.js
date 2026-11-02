import { useCallback, useEffect, useRef } from 'react';
import { Linking, StyleSheet, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import WEB_HTML from './src/webHtml';

// アプリ本体（キャリアクエストのHTML）は、アプリの中に入っている。
// この住所は、端末の中で動かすための名前で、実際には通信しない。
const BASE_URL = 'https://app.careerquest.local/';
const REMINDER_ID = 'cq-daily-reminder';

SplashScreen.preventAutoHideAsync().catch(() => {});

// アプリを開いているときに通知が来ても、バナーで見せる
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const REMINDER_MESSAGES = [
  '今日の任務は進んでいますか？達成したら報告しましょう。',
  '小さな一歩も実績になります。今日の任務をチェックしましょう。',
  '今日のDaily任務、まだ間に合います。',
];

// 毎日のリマインド通知を予約する（オフなら取り消す）
async function scheduleReminder({ on, hour, minute, ask }) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!on) return { ok: true, on: false };

  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask && perm.canAskAgain) {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (!perm.granted) return { ok: false, reason: 'denied' };

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'キャリアクエスト',
      body: REMINDER_MESSAGES[new Date().getDate() % REMINDER_MESSAGES.length],
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return { ok: true, on: true, hour, minute };
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export default function App() {
  const webRef = useRef(null);
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#11141b' : '#f2f3ee';

  // iPhone側 → アプリ本体
  const sendToWeb = useCallback((msg) => {
    const js = `window.cqFromNative && window.cqFromNative(${JSON.stringify(msg)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  // アプリ本体 → iPhone側
  const onMessage = useCallback(
    async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'haptic') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return;
      }

      if (msg.type === 'reminder') {
        const hour = Number(msg.hour);
        const minute = Number(msg.minute);
        if (!isInt(hour, 0, 23) || !isInt(minute, 0, 59)) return;
        const ask = msg.ask === true;
        try {
          const res = await scheduleReminder({ on: msg.on === true, hour, minute, ask });
          sendToWeb({ type: 'reminder-result', silent: !ask, ...res });
        } catch {
          sendToWeb({ type: 'reminder-result', silent: !ask, ok: false, reason: 'error' });
        }
      }
    },
    [sendToWeb]
  );

  // アプリの外へのリンク（メールなど）は、メールアプリやSafariで開く
  const onShouldStartLoadWithRequest = useCallback((req) => {
    const url = req.url || '';
    if (req.isTopFrame === false) return true;
    if (url.startsWith(BASE_URL) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) {
      return true;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  useEffect(() => {
    // 万一読み込みが遅くても、起動画面が出たままにならないように
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <WebView
        ref={webRef}
        source={{ html: WEB_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        onContentProcessDidTerminate={() => webRef.current?.reload()}
        style={[styles.web, { backgroundColor: bg }]}
        containerStyle={{ backgroundColor: bg }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardDisplayRequiresUserAction={false}
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        domStorageEnabled
        cacheEnabled
        bounces
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
});
