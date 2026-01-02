import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usersApi } from '../api/users';

/**
 * 알림 핸들러 설정
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * FCM 토큰 등록 및 권한 요청
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // 권한 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushNotification] Permission not granted');
      return null;
    }

    // FCM 토큰 가져오기
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a702cc5c-f513-4ca5-8da2-522eb92ec8fa', // app.config.js의 EAS projectId
    });

    const fcmToken = tokenData.data;

    if (!fcmToken) {
      console.warn('[PushNotification] Failed to get FCM token');
      return null;
    }

    console.log('[PushNotification] FCM token obtained:', fcmToken.substring(0, 20) + '...');

    // 백엔드에 FCM 토큰 저장
    try {
      await usersApi.updateSettings({
        fcm_token: fcmToken,
      });
      console.log('[PushNotification] FCM token saved to backend');
    } catch (error: any) {
      console.error('[PushNotification] Failed to save FCM token to backend:', error?.message);
      // 토큰 저장 실패해도 계속 진행 (나중에 재시도 가능)
    }

    // Android 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ff6b00',
        sound: 'default',
      });
    }

    return fcmToken;
  } catch (error: any) {
    console.error('[PushNotification] Registration error:', error?.message);
    return null;
  }
}

/**
 * 알림 리스너 설정
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void,
): () => void {
  // 포그라운드 알림 수신 리스너
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[PushNotification] Notification received:', notification.request.identifier);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // 알림 탭 리스너
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('[PushNotification] Notification tapped:', response.notification.request.identifier);
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  // 정리 함수 반환
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

