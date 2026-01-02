import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private firebaseApp: admin.app.App | null = null;
  private expo: Expo;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
    this.expo = new Expo();
  }

  /**
   * 토큰이 Expo Push Token인지 확인
   */
  private isExpoPushToken(token: string): boolean {
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      Expo.isExpoPushToken(token)
    );
  }

  /**
   * Firebase Admin 초기화
   */
  private initializeFirebase() {
    try {
      // 방법 1: 파일 경로로 읽기 (우선)
      const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      
      if (serviceAccountPath) {
        const fs = require('fs');
        const path = require('path');
        const serviceAccountFile = path.resolve(process.cwd(), serviceAccountPath);
        
        if (fs.existsSync(serviceAccountFile)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, 'utf8'));
          
          if (!this.firebaseApp) {
            this.firebaseApp = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
            this.logger.log('Firebase Admin initialized successfully from file');
            return;
          }
        } else {
          this.logger.warn(`Firebase service account file not found: ${serviceAccountFile}`);
        }
      }
      
      // 방법 2: 환경 변수에서 JSON 문자열로 읽기 (대체)
      const serviceAccountKey = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_KEY');
      
      if (!serviceAccountKey) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH is not set. Push notifications will be disabled.');
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountKey);
      
      if (!this.firebaseApp) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log('Firebase Admin initialized successfully from environment variable');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin:', error);
    }
  }

  /**
   * 단일 푸시 알림 전송
   */
  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    // Expo Push Token인 경우
    if (this.isExpoPushToken(token)) {
      return this.sendExpoPushNotification(token, title, body, data);
    }

    // FCM Token인 경우
    if (!this.firebaseApp) {
      this.logger.warn('Firebase Admin is not initialized. Cannot send push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);
      
      // 유효하지 않은 토큰인 경우 로그만 남기고 false 반환
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Invalid FCM token: ${token}`);
      }
      
      return false;
    }
  }

  /**
   * Expo Push Notification 전송
   */
  private async sendExpoPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      // 토큰이 유효한지 확인
      if (!Expo.isExpoPushToken(token)) {
        this.logger.warn(`Invalid Expo push token: ${token}`);
        return false;
      }

      const message: ExpoPushMessage = {
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        badge: 1,
      };

      const tickets = await this.expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'ok') {
        this.logger.log(`Expo push notification sent successfully: ${ticket.id}`);
        return true;
      } else {
        // 에러 상세 정보 로깅
        const errorInfo = ticket as any;
        this.logger.error(
          `Expo push notification failed: status=${ticket.status}, message=${errorInfo.message || 'Unknown error'}`,
          JSON.stringify(ticket, null, 2),
        );
        
        // FCM 서버 키 관련 에러인 경우 경고만 남기고 계속 진행
        if (errorInfo.message && errorInfo.message.includes('FCM server key')) {
          this.logger.warn(
            'FCM server key is not configured. Expo Push Notification may not work for Android devices. ' +
            'Please configure FCM server key in Expo dashboard or use Firebase Admin SDK for FCM tokens.',
          );
        }
        
        return false;
      }
    } catch (error: any) {
      this.logger.error(`Failed to send Expo push notification: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 다중 푸시 알림 전송
   */
  async sendMulticastPushNotification(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase Admin is not initialized. Cannot send push notifications.');
      return { successCount: 0, failureCount: fcmTokens.length };
    }

    if (fcmTokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title,
          body,
        },
        data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      this.logger.log(
        `Multicast push notification sent: ${response.successCount} success, ${response.failureCount} failure`,
      );

      // 실패한 토큰들 로깅
      if (response.failureCount > 0) {
        response.responses.forEach((resp: admin.messaging.SendResponse, idx: number) => {
          if (!resp.success) {
            this.logger.warn(`Failed to send to token ${fcmTokens[idx]}: ${resp.error?.message}`);
          }
        });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send multicast push notification: ${error.message}`, error.stack);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
  }
}

