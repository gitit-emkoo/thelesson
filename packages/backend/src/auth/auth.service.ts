import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

interface VerificationCode {
  phone: string;
  code: string;
  expiresAt: Date;
}

interface TemporaryToken {
  phone: string;
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private verificationCodes: Map<string, VerificationCode> = new Map();
  private temporaryTokens: Map<string, TemporaryToken> = new Map();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 인증번호 요청
   * SMS로 6자리 인증번호 전송
   */
  async requestCode(phone: string): Promise<{ message: string }> {
    // 전화번호 형식 검증
    if (!this.isValidPhoneNumber(phone)) {
      throw new BadRequestException('올바른 전화번호 형식이 아닙니다.');
    }

    // 6자리 랜덤 코드 생성
    const code = this.generateVerificationCode();

    // 코드 저장 (5분 유효)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    this.verificationCodes.set(phone, {
      phone,
      code,
      expiresAt,
    });

    // TODO: 실제 SMS 전송 서비스 연동
    // 현재는 개발 환경에서만 콘솔에 출력
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
    if (isDevelopment) {
      console.log(`[개발] 인증번호 전송 - 전화번호: ${phone}, 코드: ${code}`);
    }

    // TODO: 실제 SMS 전송 (예: AWS SNS, 알리고, 카카오톡 등)
    // await this.sendSMS(phone, `thelesson 인증번호: ${code}`);

    return {
      message: '인증번호가 전송되었습니다.',
    };
  }

  /**
   * 인증번호 검증 및 로그인/회원가입 분기
   * - 이미 가입한 사용자: 정식 accessToken 발급 (로그인)
   * - 신규 사용자: temporaryToken 발급 (회원가입)
   */
  async verifyCode(
    phone: string,
    code: string,
  ): Promise<{ accessToken?: string; user?: any; temporaryToken?: string; isNewUser: boolean }> {
    // 전화번호 형식 검증
    if (!this.isValidPhoneNumber(phone)) {
      throw new BadRequestException('올바른 전화번호 형식이 아닙니다.');
    }

    // 코드 확인
    const storedCode = this.verificationCodes.get(phone);

    if (!storedCode) {
      throw new UnauthorizedException('인증번호를 요청해주세요.');
    }

    if (storedCode.code !== code) {
      throw new UnauthorizedException('인증번호가 일치하지 않습니다.');
    }

    if (new Date() > storedCode.expiresAt) {
      this.verificationCodes.delete(phone);
      throw new UnauthorizedException('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    // 코드 사용 완료 후 삭제
    this.verificationCodes.delete(phone);

    // 전화번호 정규화 (하이픈 제거하여 저장된 형식과 일치시키기)
    const normalizedPhone = this.normalizePhone(phone);
    
    // 사용자 조회 (정규화된 형식으로 조회)
    // 데이터베이스에 저장된 형식과 일치시키기 위해 정규화된 형식으로 조회
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: normalizedPhone },
          { phone: `010-${normalizedPhone.slice(3, 7)}-${normalizedPhone.slice(7)}` },
        ],
      },
    });

    console.log('[AuthService] verifyCode - user lookup', {
      phone,
      normalizedPhone,
      userFound: !!existingUser,
      userId: existingUser?.id,
      storedPhone: existingUser?.phone,
    });

    if (existingUser) {
      // 이미 가입한 사용자: 정식 accessToken 발급 (로그인)
      const payload = { sub: existingUser.id, phone: existingUser.phone };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name,
          org_code: existingUser.org_code,
        },
        isNewUser: false,
      };
    } else {
      // 신규 사용자: temporaryToken 발급 (회원가입)
      const sessionId = randomUUID();
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 300); // 5분

      const temporaryTokenData: TemporaryToken = {
        phone,
        sessionId,
        expiresAt,
      };

      this.temporaryTokens.set(sessionId, temporaryTokenData);

      // temporaryToken을 JWT로 인코딩 (검증용)
      const tokenPayload = {
        phone,
        sessionId,
        expiresIn: 300,
      };
      const temporaryToken = this.jwtService.sign(tokenPayload, { expiresIn: '5m' });

      return {
        temporaryToken,
        isNewUser: true,
      };
    }
  }

  /**
   * temporaryToken 검증
   */
  private async validateTemporaryToken(token: string): Promise<TemporaryToken> {
    try {
      console.log('[AuthService] validateTemporaryToken', { tokenLength: token?.length, tokenPrefix: token?.substring(0, 20) });
      const decoded = this.jwtService.verify(token) as { phone: string; sessionId: string; expiresIn: number };
      console.log('[AuthService] token decoded', { phone: decoded.phone, sessionId: decoded.sessionId });
      
      // sessionId로 저장된 토큰 확인
      const storedToken = this.temporaryTokens.get(decoded.sessionId);
      console.log('[AuthService] storedToken found', { found: !!storedToken, totalTokens: this.temporaryTokens.size });
      
      if (!storedToken) {
        throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');
      }

      if (new Date() > storedToken.expiresAt) {
        this.temporaryTokens.delete(decoded.sessionId);
        throw new UnauthorizedException('인증 토큰이 만료되었습니다. 다시 인증해주세요.');
      }

      // 전화번호 일치 확인
      if (decoded.phone !== storedToken.phone) {
        throw new UnauthorizedException('인증 토큰 정보가 일치하지 않습니다.');
      }

      return storedToken;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');
      }
      throw error;
    }
  }

  /**
   * 회원가입 완료 및 정식 accessToken 발급
   */
  async completeSignup(
    temporaryToken: string,
    name: string,
    orgCode: string,
    settings?: Record<string, any>,
  ): Promise<{ accessToken: string; user: any }> {
    console.log('[AuthService] completeSignup called', {
      hasToken: !!temporaryToken,
      tokenLength: temporaryToken?.length,
      name,
      orgCode,
    });

    // temporaryToken 검증
    const tokenData = await this.validateTemporaryToken(temporaryToken);
    console.log('[AuthService] temporaryToken validated', { phone: tokenData.phone, sessionId: tokenData.sessionId });

    // 전화번호 정규화
    const normalizedPhone = this.normalizePhone(tokenData.phone);

    // 이미 가입된 사용자인지 확인 (정규화된 형식으로 조회)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: tokenData.phone },
          { phone: normalizedPhone },
          { phone: `010-${normalizedPhone.slice(3, 7)}-${normalizedPhone.slice(7)}` },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('이미 가입된 전화번호입니다.');
    }

    // Settings 기본값 적용
    const finalSettings = this.applyDefaultSettings(settings || {});

    // 신규 사용자 생성
    const user = await this.prisma.user.create({
      data: {
        phone: normalizedPhone,
        name,
        org_code: orgCode,
        settings: finalSettings,
      },
    });

    // temporaryToken 사용 완료 후 삭제 (1회성)
    this.temporaryTokens.delete(tokenData.sessionId);

    // 정식 JWT 토큰 생성
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        org_code: user.org_code,
      },
    };
  }

  /**
   * Settings 기본값 적용
   */
  private applyDefaultSettings(settings: Record<string, any>): Record<string, any> {
    const defaultSettings: Record<string, any> = {
      default_lesson_type: 'monthly',
      default_billing_type: 'postpaid',
      default_absence_policy: 'deduct_next',
      default_send_target: 'guardian_only',
    };

    // settings가 빈 객체이거나 필수 필드가 없으면 기본값 적용
    if (!settings || Object.keys(settings).length === 0) {
      return defaultSettings;
    }

    // 각 필드가 없으면 기본값 적용
    return {
      ...defaultSettings,
      ...settings,
      default_lesson_type: settings.default_lesson_type || defaultSettings.default_lesson_type,
      default_billing_type: settings.default_billing_type || defaultSettings.default_billing_type,
      default_absence_policy: settings.default_absence_policy || defaultSettings.default_absence_policy,
      default_send_target: settings.default_send_target || defaultSettings.default_send_target,
    };
  }

  /**
   * 6자리 랜덤 인증번호 생성
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 전화번호 정규화 (하이픈 제거)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/-/g, '');
  }

  /**
   * 전화번호 형식 검증
   */
  private isValidPhoneNumber(phone: string): boolean {
    // 한국 전화번호 형식: 010-1234-5678 또는 01012345678
    const phoneRegex = /^010-?\d{4}-?\d{4}$/;
    return phoneRegex.test(phone);
  }
}
