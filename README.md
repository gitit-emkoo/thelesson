# 김쌤 프로젝트

모노레포 구조의 React Native 앱 및 NestJS 백엔드 프로젝트입니다.

## 프로젝트 구조

```
kimssam/
├── packages/
│   ├── app/              # React Native + Expo 앱
│   └── backend/          # NestJS + Prisma 백엔드
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
- **PostgreSQL** 15.x / 16.x (Supabase 사용)
- **TypeScript** 5.7.3
- **@nestjs/config** 4.0.2 (환경변수)

## 설치 및 실행

### 전체 의존성 설치
```bash
npm install
```

### 앱 실행
```bash
npm run app:start        # 개발 클라이언트로 시작 (--dev-client)
npm run app:android      # Android 개발 클라이언트
npm run app:ios          # iOS 개발 클라이언트
npm run build:android    # Android 개발 빌드 (EAS)
npm run build:ios        # iOS 개발 빌드 (EAS)
```

### 백엔드 실행
```bash
npm run backend:start    # 개발 모드 (watch)
npm run backend:build    # 프로덕션 빌드
```

## 환경변수 설정

### 앱 (packages/app/.env)
```env
API_URL=http://localhost:3000
API_KEY=
# Google AdMob 테스트 ID (나중에 실제 앱 ID로 교체)
ANDROID_ADMOB_APP_ID=ca-app-pub-3940256099942544~3347511713
IOS_ADMOB_APP_ID=ca-app-pub-3940256099942544~1458002511
```

### 백엔드 (packages/backend/.env)
```env
# Supabase 연결 문자열 (로컬 PostgreSQL 대신 사용)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
# 또는 로컬 PostgreSQL 사용 시:
# DATABASE_URL="postgresql://user:password@localhost:5432/kimssam?schema=public"

PORT=3000
NODE_ENV=development
JWT_SECRET=please-change-in-production-very-long-secret
JWT_EXPIRES_IN=2592000
FIREBASE_SERVICE_ACCOUNT_KEY=your-firebase-key-here
```

**Supabase 설정 방법**: `docs/SUPABASE_SETUP.md` 참고

## 개발 시작

### Supabase 사용 (권장)

1. [Supabase 프로젝트 생성](https://supabase.com) (무료)
2. `packages/backend/.env` 파일에 Supabase `DATABASE_URL` 설정
3. Prisma 마이그레이션 실행: `cd packages/backend && npx prisma migrate deploy`
4. 백엔드 서버 시작: `npm run backend:start`
5. 앱 실행: `npm run app:start`

**자세한 설정 방법**: `docs/SUPABASE_SETUP.md` 참고

### 로컬 PostgreSQL 사용

1. 환경변수 파일 생성 및 설정
2. PostgreSQL 데이터베이스 생성 및 연결
3. Prisma 마이그레이션 실행: `cd packages/backend && npx prisma migrate dev`
4. 백엔드 서버 시작: `npm run backend:start`
5. 앱 실행: `npm run app:start`

