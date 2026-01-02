// dotenv를 선택적으로 로드 (없어도 동작하도록)
try {
  require('dotenv/config');
} catch (e) {
  // dotenv가 없으면 무시 (환경변수는 이미 설정되어 있을 수 있음)
}

export default ({ config }) => ({
  ...config,
  expo: {
    name: 'thelesson',
    slug: 'thelesson',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false, // 기준선 테스트: New Architecture 비활성화
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.thelesson.kwcc',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      useCleartextTraffic: true, // STEP 2: 로컬 API 테스트를 위한 HTTP 허용
      networkSecurityConfig: './android/network_security_config.xml',
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      // STEP 3: 완전 최소 네이티브 - Kotlin 버전만 강제 (빌드 성공을 위해 필수)
      './app.plugin.js', // 최소한의 Kotlin 1.9.25 설정만 적용
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#ff6b00',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'a702cc5c-f513-4ca5-8da2-522eb92ec8fa',
      },
      API_URL: process.env.API_URL || 'http://localhost:3000',
      API_KEY: process.env.API_KEY || '',
      // Google AdMob 테스트 ID (나중에 실제 앱 ID로 교체)
      ANDROID_ADMOB_APP_ID: process.env.ANDROID_ADMOB_APP_ID || 'ca-app-pub-3940256099942544~3347511713',
      IOS_ADMOB_APP_ID: process.env.IOS_ADMOB_APP_ID || 'ca-app-pub-3940256099942544~1458002511',
    },
  },
});

