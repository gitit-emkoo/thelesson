import React, { useState, useCallback, useEffect } from 'react';
import { Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Modal, TouchableOpacity } from 'react-native';
import { useNavigation, NativeStackNavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styled from 'styled-components/native';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/useStore';
import { AuthStackParamList } from '../navigation/AppNavigator';

const logoImage = require('../../assets/login3.png');

type PhoneAuthNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'PhoneAuth'>;

export default function PhoneAuthScreen() {
  const navigation = useNavigation<PhoneAuthNavigationProp>();
  const login = useAuthStore((state) => state.login);
  const apiBaseUrl = useAuthStore((state) => state.apiBaseUrl);
  const setApiBaseUrl = useAuthStore((state) => state.setApiBaseUrl);
  const storedAccessToken = useAuthStore((state) => state.accessToken);
  
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [hasPreviousLogin, setHasPreviousLogin] = useState(false);
  const [showApiUrlInput, setShowApiUrlInput] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const saveAccessToken = useAuthStore((state) => state.setAccessToken);

  // 디바이스에 이전 로그인 기록이 있는지 확인
  useEffect(() => {
    const checkPreviousLogin = async () => {
      try {
        // 먼저 현재 auth-storage 확인 (로그인 중인 경우)
        const stored = await AsyncStorage.getItem('auth-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.state?.user) {
            setHasPreviousLogin(true);
            if (parsed.state.user.phone) {
              setPhone(parsed.state.user.phone);
            }
            return;
          }
        }
        // 로그아웃 후에도 이전 기록 확인
        const lastUser = await AsyncStorage.getItem('last-logged-in-user');
        if (lastUser) {
          const parsedUser = JSON.parse(lastUser);
          setHasPreviousLogin(true);
          if (parsedUser?.phone) {
            setPhone(parsedUser.phone);
          }
        }
      } catch (error) {
        console.error('[PhoneAuthScreen] Failed to check previous login', error);
      }
    };
    checkPreviousLogin();
    // API URL 초기값 설정
    setApiUrlInput(apiBaseUrl || '');
  }, [apiBaseUrl]);

  // 저장된 토큰을 로그인 화면 토큰 입력란에 반영
  useEffect(() => {
    if (storedAccessToken) {
      setTokenInput(storedAccessToken);
    }
  }, [storedAccessToken]);

  // 전화번호 형식 검증
  const isValidPhone = (phoneNumber: string): boolean => {
    const phoneRegex = /^010-?\d{4}-?\d{4}$/;
    return phoneRegex.test(phoneNumber);
  };

  // 전화번호 포맷팅 (010-1234-5678)
  const formatPhone = (text: string): string => {
    const numbers = text.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 인증번호 요청
  const handleRequestCode = useCallback(async () => {
    if (!isValidPhone(phone)) {
      Alert.alert('입력 오류', '올바른 전화번호 형식이 아닙니다.\n(010-1234-5678)');
      return;
    }

    try {
      setRequestingCode(true);
      await authApi.requestCode(phone);
      setCodeSent(true);
      Alert.alert('인증번호 전송', '인증번호가 전송되었습니다.');
    } catch (error: any) {
      // 개발용 로그는 __DEV__ 모드에서만 console.log로 출력 (에러 오버레이 방지)
      if (__DEV__) {
        console.log('[PhoneAuthScreen] requestCode error (handled)', {
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message,
        });
      }
      
      // 네트워크 에러 처리
      let errorMessage = '인증번호 전송에 실패했습니다.';
      if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
        const { apiBaseUrl } = useAuthStore.getState();
        const currentUrl = apiBaseUrl || 'http://localhost:3000';
        if (__DEV__) {
          console.log('[PhoneAuthScreen] Network error - Current API URL:', currentUrl);
        }
        errorMessage = `네트워크 연결을 확인해주세요.\n\n현재 연결 시도 중인 주소:\n${currentUrl}\n\n백엔드 서버와 ngrok이 실행 중인지 확인해주세요.`;
        
        // 네트워크 에러 시 API URL 입력 옵션 제공
        Alert.alert(
          '네트워크 오류',
          errorMessage,
          [
            {
              text: 'API URL 설정',
              onPress: () => setShowApiUrlInput(true),
            },
            {
              text: '확인',
              style: 'cancel',
            },
          ]
        );
        return;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('오류', errorMessage);
    } finally {
      setRequestingCode(false);
    }
  }, [phone]);

  // API URL 저장
  const handleSaveApiUrl = useCallback(async () => {
    if (!apiUrlInput.trim()) {
      Alert.alert('입력 오류', 'API URL을 입력해주세요.');
      return;
    }
    
    try {
      const trimmedUrl = apiUrlInput.trim();
      // URL 형식 검증
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        Alert.alert('입력 오류', '올바른 URL 형식이 아닙니다.\n예: https://xxxx.ngrok.io');
        return;
      }
      
      await setApiBaseUrl(trimmedUrl);
      setShowApiUrlInput(false);
      
      // API 클라이언트 즉시 업데이트 확인
      const { apiBaseUrl: savedUrl } = useAuthStore.getState();
      if (__DEV__) {
        console.log('[PhoneAuthScreen] API URL saved:', savedUrl);
      }
      
      Alert.alert(
        '완료', 
        `API URL이 저장되었습니다.\n\n저장된 주소:\n${savedUrl}\n\n다시 인증번호를 요청해주세요.`
      );
    } catch (error) {
      console.error('[PhoneAuthScreen] Failed to save API URL', error);
      Alert.alert('오류', 'API URL 저장에 실패했습니다.');
    }
  }, [apiUrlInput, setApiBaseUrl]);

  // 인증번호 검증
  const handleVerifyCode = useCallback(async () => {
    if (code.length !== 6) {
      Alert.alert('입력 오류', '인증번호는 6자리입니다.');
      return;
    }

    try {
      setVerifyingCode(true);
      
      if (__DEV__) {
        console.log('[PhoneAuthScreen] Verifying code for phone:', phone);
      }
      
      const response = await authApi.verifyCode(phone, code);
      
      if (__DEV__) {
        console.log('[PhoneAuthScreen] verifyCode response:', {
          isNewUser: response.isNewUser,
          hasAccessToken: !!response.accessToken,
          hasUser: !!response.user,
          hasTemporaryToken: !!response.temporaryToken,
        });
      }
      
      if (!response.isNewUser && response.accessToken && response.user) {
        // 이미 가입한 사용자: 바로 로그인
        try {
          if (__DEV__) {
            console.log('[PhoneAuthScreen] Logging in user:', response.user.id);
          }
          
          // 로그인 처리
          await login(response.accessToken, {
            id: response.user.id,
            phone: response.user.phone,
            name: response.user.name,
            org_code: response.user.org_code,
          });
          
          // 로그인 상태 확인
          const authState = useAuthStore.getState();
          if (__DEV__) {
            console.log('[PhoneAuthScreen] Login state after login:', {
              isAuthenticated: authState.isAuthenticated,
              hasAccessToken: !!authState.accessToken,
              hasUser: !!authState.user,
            });
          }
          
          // 약간의 지연을 주어 상태 업데이트가 완료되도록 함
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (__DEV__) {
            console.log('[PhoneAuthScreen] Login successful, navigation should happen automatically');
          }
          
          // 로그인 성공하면 자동으로 홈 화면으로 이동됨 (AppNavigator에서 isAuthenticated 변경 감지)
        } catch (loginError: any) {
          console.error('[PhoneAuthScreen] Login error:', loginError);
          Alert.alert(
            '로그인 오류',
            '로그인 처리 중 오류가 발생했습니다.\n앱을 재시작해주세요.',
            [{ text: '확인' }]
          );
        }
      } else if (response.isNewUser && response.temporaryToken) {
        // 신규 사용자: 회원가입 화면으로 이동
        if (__DEV__) {
          console.log('[PhoneAuthScreen] New user, navigating to Signup');
        }
        navigation.navigate('Signup', {
          phone,
          temporaryToken: response.temporaryToken,
        });
      } else {
        console.error('[PhoneAuthScreen] unexpected response format', response);
        throw new Error('예상치 못한 응답 형식입니다.');
      }
    } catch (error: any) {
      // 개발용 로그는 __DEV__ 모드에서만 console.log로 출력 (에러 오버레이 방지)
      if (__DEV__) {
        console.log('[PhoneAuthScreen] verifyCode error (handled)', {
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message,
          error: error,
        });
      }
      
      // 네트워크 에러 처리
      let errorMessage = '인증번호가 일치하지 않습니다.';
      if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
        errorMessage = '네트워크 연결을 확인해주세요.\n서버에 연결할 수 없습니다.';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message && error.message !== 'Network Error') {
        errorMessage = error.message;
      }
      
      // 사용자에게는 항상 간단하고 명확한 메시지만 표시
      Alert.alert(
        '인증 실패',
        errorMessage,
        [
          {
            text: '확인',
            onPress: () => {
              // 인증번호 입력 필드 초기화하여 다시 입력할 수 있도록
              setCode('');
            },
          },
        ],
        { cancelable: true }
      );
    } finally {
      setVerifyingCode(false);
    }
  }, [phone, code, login, navigation]);

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <HeaderArea>
            <AppTitle>THE LESSON</AppTitle>
            <LogoImage source={logoImage} resizeMode="contain" />
            <AppSlogan>소규모 레슨 운영 자동화</AppSlogan>
            <AppSubtitle>계약 출결 정산 발송이 더 편리해집니다.</AppSubtitle>
          </HeaderArea>
          <Content>
            <StepContainer>
              {hasPreviousLogin ? (
                <>
                  <Title>전화번호 간편 로그인</Title>
                  <Subtitle>가입된 전화번호로 인증을 진행해주세요</Subtitle>
                </>
              ) : (
                <>
                  <Title>전화번호로 시작하기</Title>
                  <Subtitle>간편하게 전화번호로 thelesson을 이용하실 수 있어요</Subtitle>
                </>
              )}

              <InputLabel>전화번호</InputLabel>
              <PhoneInput
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="010-1234-5678"
                keyboardType="phone-pad"
                maxLength={13}
                editable={!codeSent}
              />

              {codeSent && (
                <>
                  <InputLabel style={{ marginTop: 20 }}>인증번호</InputLabel>
                  <CodeInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="6자리 인증번호"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </>
              )}

              {!codeSent ? (
                <PrimaryButton onPress={handleRequestCode} disabled={requestingCode || !isValidPhone(phone)}>
                  {requestingCode ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <PrimaryButtonText>
                      {hasPreviousLogin ? '인증요청 로그인' : '인증번호 요청'}
                    </PrimaryButtonText>
                  )}
                </PrimaryButton>
              ) : (
                <PrimaryButton onPress={handleVerifyCode} disabled={verifyingCode || code.length !== 6}>
                  {verifyingCode ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <PrimaryButtonText>
                      {hasPreviousLogin ? '로그인하기' : '시작하기'}
                    </PrimaryButtonText>
                  )}
                </PrimaryButton>
              )}

              {codeSent && (
                <SecondaryButton onPress={() => {
                  setCodeSent(false);
                  setCode('');
                }}>
                  <SecondaryButtonText>번호 다시 입력</SecondaryButtonText>
                </SecondaryButton>
              )}

              {/* API URL 설정 버튼 (개발용) */}
              <SecondaryButton 
                onPress={() => setShowApiUrlInput(true)}
                style={{ marginTop: 8 }}
              >
                <SecondaryButtonText style={{ fontSize: 12, color: '#8e8e93' }}>
                  API URL 설정
                </SecondaryButtonText>
              </SecondaryButton>

              {/* AccessToken 직접 입력 버튼 (임시 개발용) */}
              <SecondaryButton 
                onPress={() => setShowTokenInput(true)}
                style={{ marginTop: 8 }}
              >
                <SecondaryButtonText style={{ fontSize: 12, color: '#ff6b00' }}>
                  AccessToken 직접 입력 (임시)
                </SecondaryButtonText>
              </SecondaryButton>
            </StepContainer>
          </Content>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* API URL 입력 모달 */}
      {showApiUrlInput && (
        <Modal
          visible={showApiUrlInput}
          transparent
          animationType="slide"
          onRequestClose={() => setShowApiUrlInput(false)}
        >
          <ModalOverlay onPress={() => setShowApiUrlInput(false)}>
            <ModalContent onStartShouldSetResponder={() => true}>
              <ModalTitle>API URL 설정</ModalTitle>
              <ModalDescription>
                백엔드 서버 주소를 입력해주세요.{'\n'}
                예: https://your-ngrok-url.ngrok.io
              </ModalDescription>
              <ApiUrlInput
                value={apiUrlInput}
                onChangeText={setApiUrlInput}
                placeholder="https://your-ngrok-url.ngrok.io"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <CurrentUrlText>
                현재: {apiBaseUrl || 'http://localhost:3000'}
              </CurrentUrlText>
              <ModalButtons>
                <ModalButton onPress={() => setShowApiUrlInput(false)}>
                  <ModalButtonText>취소</ModalButtonText>
                </ModalButton>
                <ModalButton primary onPress={handleSaveApiUrl}>
                  <ModalButtonText primary>저장</ModalButtonText>
                </ModalButton>
              </ModalButtons>
            </ModalContent>
          </ModalOverlay>
        </Modal>
      )}

      {/* AccessToken 입력 모달 (임시 개발용) */}
      {showTokenInput && (
        <Modal
          visible={showTokenInput}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTokenInput(false)}
        >
          <ModalOverlay onPress={() => setShowTokenInput(false)}>
            <ModalContent onStartShouldSetResponder={() => true}>
              <ModalTitle>Access Token 입력 (임시)</ModalTitle>
              <ModalDescription>
                Access Token을 입력하고 저장하세요.{'\n'}
                개발/복구용 기능입니다.
              </ModalDescription>
              <InputLabel style={{ marginTop: 0 }}>Access Token</InputLabel>
              <ApiUrlInput
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="Bearer 토큰 문자열을 입력하세요"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={{ minHeight: 80 }}
              />
              <ModalButtons>
                <ModalButton onPress={() => setShowTokenInput(false)}>
                  <ModalButtonText>취소</ModalButtonText>
                </ModalButton>
                <ModalButton 
                  primary 
                  onPress={async () => {
                    if (!tokenInput.trim()) {
                      Alert.alert('입력 오류', 'Access Token을 입력해주세요.');
                      return;
                    }
                    try {
                      await saveAccessToken(tokenInput.trim());
                      setShowTokenInput(false);
                      Alert.alert('저장 완료', 'Access Token이 저장되었습니다.');
                    } catch (error: any) {
                      console.error('[PhoneAuthScreen] Save token error:', error);
                      Alert.alert('오류', '토큰 저장에 실패했습니다.');
                    }
                  }}
                >
                  <ModalButtonText primary>저장</ModalButtonText>
                </ModalButton>
              </ModalButtons>
            </ModalContent>
          </ModalOverlay>
        </Modal>
      )}
    </Container>
  );
}

const Container = styled.SafeAreaView`
  flex: 1;
  background-color: #ffffff;
`;

const HeaderArea = styled.View`
  padding: 60px 20px 40px;
  align-items: center;
  gap: 16px;
`;

const AppTitle = styled.Text`
  font-size: 28px;
  font-weight: 700;
  color: #111111;
  text-align: center;
  margin-bottom: 8px;
`;

const LogoImage = styled.Image`
  width: 80px;
  height: 80px;
  margin-bottom: 8px;
`;

const AppSlogan = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #1d42d8;
  text-align: center;
`;

const AppSubtitle = styled.Text`
  font-size: 14px;
  font-weight: 400;
  color: #8e8e93;
  text-align: center;
  margin-top: 4px;
`;

const Content = styled.View`
  flex: 1;
  padding: 20px;
  justify-content: flex-start;
  padding-top: 20px;
`;

const StepContainer = styled.View`
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
`;

const Title = styled.Text`
  font-size: 24px;
  font-weight: 700;
  color: #111111;
  margin-bottom: 8px;
  text-align: center;
`;

const Subtitle = styled.Text`
  font-size: 14px;
  color: #8e8e93;
  margin-bottom: 24px;
  text-align: center;
  line-height: 20px;
`;

const InputLabel = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8px;
  margin-top: 12px;
`;

const PhoneInput = styled.TextInput`
  border-width: 1px;
  border-color: #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
  color: #111111;
  background-color: #ffffff;
`;

const CodeInput = styled.TextInput`
  border-width: 1px;
  border-color: #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
  color: #111111;
  background-color: #ffffff;
  text-align: center;
  letter-spacing: 8px;
`;

const PrimaryButton = styled.TouchableOpacity<{ disabled?: boolean }>`
  background-color: #1d42d8;
  padding: 16px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`;

const PrimaryButtonText = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
`;

const SecondaryButton = styled.TouchableOpacity`
  padding: 12px;
  align-items: center;
  margin-top: 12px;
`;

const SecondaryButtonText = styled.Text`
  color: #8e8e93;
  font-size: 14px;
`;

const ModalOverlay = styled.TouchableOpacity`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const ModalContent = styled.View`
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
`;

const ModalTitle = styled.Text`
  font-size: 20px;
  font-weight: 700;
  color: #111111;
  margin-bottom: 8px;
`;

const ModalDescription = styled.Text`
  font-size: 14px;
  color: #666666;
  margin-bottom: 16px;
  line-height: 20px;
`;

const ApiUrlInput = styled.TextInput`
  border-width: 1px;
  border-color: #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #111111;
  background-color: #ffffff;
  margin-bottom: 8px;
`;

const CurrentUrlText = styled.Text`
  font-size: 12px;
  color: #8e8e93;
  margin-bottom: 16px;
`;

const ModalButtons = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  gap: 12px;
`;

const ModalButton = styled.TouchableOpacity<{ primary?: boolean }>`
  padding: 12px 24px;
  border-radius: 8px;
  background-color: ${(props) => (props.primary ? '#1d42d8' : '#f0f0f0')};
`;

const ModalButtonText = styled.Text<{ primary?: boolean }>`
  color: ${(props) => (props.primary ? '#ffffff' : '#111111')};
  font-size: 14px;
  font-weight: 600;
`;

