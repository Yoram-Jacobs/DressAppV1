/**
 * apps/mobile/App.tsx
 *
 * DressApp — WebView wrapper.
 * Opens https://dressapp.co/home in a full-screen WebView.
 * All auth, navigation, and features are handled by the web app.
 */

import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Platform, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_URL = 'https://dressapp.co/home';

export default function App() {
  const webViewRef = React.useRef<WebView>(null);

  // Handle Android back button — go back in WebView history
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true; // prevent app exit
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures
        // Allow camera/mic for future features
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        // Share cookies between WebView and native
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  webview: {
    flex: 1,
  },
});
