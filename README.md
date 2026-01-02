# 더레슨 (The Lesson)

모노레포 구조의 React Native 앱 및 NestJS 백엔드 프로젝트입니다.

## 프로젝트 구조

```
thelesson/
├── packages/
│   ├── app/              # React Native + Expo 앱
│   └── backend/          # NestJS + Prisma 백엔드
├── docs/                 # 문서
├── scripts/              # 유틸리티 스크립트
├── package.json          # 모노레포 워크스페이스 설정
└── .gitignore
```

## 기술 스택

### 앱 (packages/app)
- **React Native** 0.76.5
- **React** 18.3.1
- **Expo SDK** 52
- **TypeScript** 5.7.3
- **styled-components** 6.1.13 (React Native용)
- **Zustand** 5.0.8 (상태 관리)
- **React Navigation** 7.0.0
- **react-native-google-mobile-ads** 15.0.0 (Google Ads)
- **expo-dev-client** 5.0.0 (개발 클라이언트)
- **expo-constants** 17.0.4 (환경변수)

### 백엔드 (packages/backend)
- **NestJS** 11.0.1
- **Prisma** 5.22.0
- **PostgreSQL** (Supabase 클라우드 데이터베이스)
- **TypeScript** 5.7.3
- **@nestjs/config** 4.0.2 (환경변수)
- **Vercel Serverless Functions** (배포)

## 설치 및 실행

### 전체 의존성 설치
```bash
npm install
```

### 앱 실행
```bash
npm run app:start        # 개발 클라이언트로 시작
npm run app:android      # Android 개발 클라이언트
npm run app:ios          # iOS 개발 클라이언트
```

### 백엔드 실행
```bash
npm run backend:start    # 개발 모드 (watch)
npm run backend:build    # 프로덕션 빌드
```

## 환경변수 설정

### 앱 (packages/app/.env)
```env
# 로컬 개발 시
API_URL=http://localhost:3000

# 프로덕션 배포 시 (Vercel 배포 후)
API_URL=https://thelesson.vercel.app

API_KEY=
# Google AdMob 테스트 ID (나중에 실제 앱 ID로 교체)
ANDROID_ADMOB_APP_ID=ca-app-pub-3940256099942544~3347511713
IOS_ADMOB_APP_ID=ca-app-pub-3940256099942544~1458002511
```

### 백엔드 (packages/backend/.env)
```env
# Supabase 연결 문자열 (Session Pooler 사용 권장)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1"

PORT=3000
NODE_ENV=development
JWT_SECRET=please-change-in-production-very-long-secret
JWT_EXPIRES_IN=2592000
FIREBASE_SERVICE_ACCOUNT_KEY=your-firebase-key-here
```

**중요 사항:**
- `[YOUR-PASSWORD]`: Supabase 비밀번호 (특수문자는 URL 인코딩 필요)
- `[PROJECT-REF]`: Supabase 프로젝트 참조 ID

## 개발 시작

### 1. Supabase 데이터베이스 설정

1. [Supabase 프로젝트 생성](https://supabase.com) (무료)
2. `packages/backend/.env` 파일에 Supabase `DATABASE_URL` 설정
3. Prisma 마이그레이션 실행:
   ```bash
   cd packages/backend
   npx prisma generate
   npx prisma migrate deploy
   ```

**자세한 설정 방법**: `docs/SUPABASE_SETUP.md` 참고

### 2. 백엔드 서버 실행

```bash
npm run backend:start
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 3. 앱 실행

```bash
npm run app:start
```

## 배포

### 백엔드 배포 (Vercel Serverless Functions)

백엔드는 Vercel Serverless Functions로 배포됩니다.

1. [Vercel](https://vercel.com)에 GitHub 저장소 연결
2. Root Directory: `packages/backend` 설정
3. 환경변수 설정 (Supabase `DATABASE_URL` 등)
4. 자동 배포 완료

**자세한 배포 가이드**: `docs/VERCEL_DEPLOYMENT.md` 참고

**배포 URL**: `https://thelesson.vercel.app`

### 앱 빌드 (APK)

```bash
cd packages/app
npm run build:android:preview
```

배포된 백엔드 URL을 사용하려면 `packages/app/eas.json`에서 `API_URL` 환경변수를 설정하세요.

## 주요 기능

- 📱 학생 관리
- 📝 계약서 관리
- ✅ 출결 관리
- 💰 청구서 및 정산
- 🔔 푸시 알림
- 📊 대시보드

## 문서

- `docs/SUPABASE_SETUP.md` - Supabase 데이터베이스 설정
- `docs/VERCEL_DEPLOYMENT.md` - Vercel 배포 가이드
- `docs/ARCHITECTURE_EXPLANATION.md` - 프로젝트 아키텍처 설명

## 라이선스

Private
