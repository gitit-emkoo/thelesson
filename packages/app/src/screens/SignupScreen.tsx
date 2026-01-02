import React, { useState, useCallback, useEffect } from 'react';
import { Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import styled from 'styled-components/native';
import { authApi, CompleteSignupRequest } from '../api/auth';
import { useAuthStore } from '../store/useStore';
import { AuthStackParamList } from '../navigation/AppNavigator';

const logoImage = require('../../assets/logo1.jpg');

export default function SignupScreen() {
  const route = useRoute<RouteProp<AuthStackParamList, 'Signup'>>();
  const navigation = useNavigation();
  const login = useAuthStore((state) => state.login);
  
  const { phone, temporaryToken: initialTemporaryToken } = route.params;
  const [temporaryToken] = useState<string>(initialTemporaryToken);
  
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: 프로필 정보
  const [name, setName] = useState('');
  const [orgCode, setOrgCode] = useState('');

  // Step 2: 기본 설정
  const [billingType, setBillingType] = useState<'prepaid' | 'postpaid' | null>(null);
  const [absencePolicy, setAbsencePolicy] = useState<'carry_over' | 'deduct_next' | 'vanish' | null>(null);
  const [sendTarget, setSendTarget] = useState<'student_only' | 'guardian_only' | 'both' | null>(null);
  const [skipSettings, setSkipSettings] = useState(false);

  // Step 3: 완료 처리
  const [completing, setCompleting] = useState(false);

  // Step 1: 다음 단계로
  const handleStep1Next = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return;
    }
    if (!orgCode.trim()) {
      Alert.alert('입력 오류', '상호명을 입력해주세요.');
      return;
    }
    setStep(2);
  }, [name, orgCode]);

  // Step 2: 건너뛰기 또는 완료
  const handleStep2Skip = useCallback(() => {
    setSkipSettings(true);
    setStep(3);
  }, []);

  const handleStep2Complete = useCallback(() => {
    if (!billingType || !absencePolicy || !sendTarget) {
      Alert.alert('입력 오류', '모든 설정을 선택해주세요.');
      return;
    }
    setSkipSettings(false);
    setStep(3);
  }, [billingType, absencePolicy, sendTarget]);

  // Step 3: 회원가입 완료
  const handleCompleteSignup = useCallback(async () => {
    if (!temporaryToken) {
      Alert.alert('오류', '인증 정보가 없습니다. 처음부터 다시 시작해주세요.');
      navigation.goBack();
      return;
    }

    try {
      setCompleting(true);

      const signupData: CompleteSignupRequest = {
        name: name.trim(),
        org_code: orgCode.trim(),
        settings: skipSettings
          ? undefined
          : {
              default_billing_type: billingType!,
              default_absence_policy: absencePolicy!,
              default_send_target: sendTarget!,
            },
      };

      const response = await authApi.completeSignup(temporaryToken, signupData);
      await login(response.accessToken, {
        id: response.user.id,
        phone: response.user.phone,
        name: response.user.name,
        org_code: response.user.org_code,
      });
    } catch (error: any) {
      console.error('[SignupScreen] completeSignup error', error);
      Alert.alert('오류', error?.response?.data?.message || '회원가입에 실패했습니다.');
      setCompleting(false);
    }
  }, [temporaryToken, name, orgCode, skipSettings, billingType, absencePolicy, sendTarget, login, navigation]);

  // Step 3는 자동으로 실행
  useEffect(() => {
    if (step === 3 && !completing) {
      handleCompleteSignup();
    }
  }, [step, completing, handleCompleteSignup]);

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
            <LogoImage source={logoImage} resizeMode="contain" />
            <AppSlogan>계약부터 정산까지 간편한 레슨관리 thelesson</AppSlogan>
          </HeaderArea>
          <Content>
            {/* Step 표시 */}
            <StepIndicator>
              <StepText>
                {step === 1 && '1/2'}
                {step === 2 && '2/2'}
                {step === 3 && '완료 중...'}
              </StepText>
            </StepIndicator>

            {/* Step 1: 프로필 정보 */}
            {step === 1 && (
              <StepContainer>
                <Title>프로필 정보</Title>
                <Subtitle>기본 정보를 입력해주세요.</Subtitle>

                <InputLabel>이름 *</InputLabel>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="선생님 이름"
                  autoCapitalize="words"
                />

                <InputLabel style={{ marginTop: 16 }}>상호명 *</InputLabel>
                <TextInput
                  value={orgCode}
                  onChangeText={setOrgCode}
                  placeholder="상호명을 입력하세요"
                  autoCapitalize="words"
                />

                <PrimaryButton onPress={handleStep1Next} disabled={!name.trim() || !orgCode.trim()}>
                  <PrimaryButtonText>다음</PrimaryButtonText>
                </PrimaryButton>
              </StepContainer>
            )}

            {/* Step 2: 기본 설정 */}
            {step === 2 && (
              <StepContainer>
                <Title>기본 설정</Title>
                <Subtitle>
                  계약서에 입력되는 조건을 설정해 주세요.{'\n'}
                  건너뛸 수 있고 마이페이지에서 수정할 수 있습니다.
                </Subtitle>

                <InputLabel>결제 방식</InputLabel>
                <OptionRow>
                  <OptionButton
                    $selected={billingType === 'prepaid'}
                    onPress={() => setBillingType('prepaid')}
                  >
                    <OptionButtonText $selected={billingType === 'prepaid'}>선불</OptionButtonText>
                  </OptionButton>
                  <OptionButton
                    $selected={billingType === 'postpaid'}
                    onPress={() => setBillingType('postpaid')}
                  >
                    <OptionButtonText $selected={billingType === 'postpaid'}>후불</OptionButtonText>
                  </OptionButton>
                </OptionRow>

                <InputLabel style={{ marginTop: 20 }}>결석 처리</InputLabel>
                <OptionRow>
                  <OptionButton
                    $selected={absencePolicy === 'deduct_next'}
                    onPress={() => setAbsencePolicy('deduct_next')}
                  >
                    <OptionButtonText $selected={absencePolicy === 'deduct_next'}>차감</OptionButtonText>
                  </OptionButton>
                  <OptionButton
                    $selected={absencePolicy === 'carry_over'}
                    onPress={() => setAbsencePolicy('carry_over')}
                  >
                    <OptionButtonText $selected={absencePolicy === 'carry_over'}>회차이월</OptionButtonText>
                  </OptionButton>
                  <OptionButton
                    $selected={absencePolicy === 'vanish'}
                    onPress={() => setAbsencePolicy('vanish')}
                  >
                    <OptionButtonText $selected={absencePolicy === 'vanish'}>소멸</OptionButtonText>
                  </OptionButton>
                </OptionRow>

                <InputLabel style={{ marginTop: 20 }}>전송 대상</InputLabel>
                <OptionRow>
                  <OptionButton
                    $selected={sendTarget === 'student_only'}
                    onPress={() => setSendTarget('student_only')}
                  >
                    <OptionButtonText $selected={sendTarget === 'student_only'}>수강생만</OptionButtonText>
                  </OptionButton>
                  <OptionButton
                    $selected={sendTarget === 'guardian_only'}
                    onPress={() => setSendTarget('guardian_only')}
                  >
                    <OptionButtonText $selected={sendTarget === 'guardian_only'}>보호자만</OptionButtonText>
                  </OptionButton>
                  <OptionButton
                    $selected={sendTarget === 'both'}
                    onPress={() => setSendTarget('both')}
                  >
                    <OptionButtonText $selected={sendTarget === 'both'}>둘 다</OptionButtonText>
                  </OptionButton>
                </OptionRow>

                <ButtonRow>
                  <SkipButton onPress={handleStep2Skip}>
                    <SkipButtonText>건너뛰기</SkipButtonText>
                  </SkipButton>
                  <PrimaryButton onPress={handleStep2Complete} disabled={!billingType || !absencePolicy || !sendTarget}>
                    <PrimaryButtonText>완료</PrimaryButtonText>
                  </PrimaryButton>
                </ButtonRow>
              </StepContainer>
            )}

            {/* Step 3: 완료 처리 */}
            {step === 3 && (
              <StepContainer>
                <ActivityIndicator size="large" color="#1d42d8" />
                <Title style={{ marginTop: 20 }}>회원가입 처리 중...</Title>
              </StepContainer>
            )}
          </Content>
        </ScrollView>
      </KeyboardAvoidingView>
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

const Content = styled.View`
  flex: 1;
  padding: 20px;
  justify-content: flex-start;
  padding-top: 20px;
`;

const StepIndicator = styled.View`
  align-items: center;
  margin-bottom: 32px;
`;

const StepText = styled.Text`
  font-size: 14px;
  color: #8e8e93;
  font-weight: 600;
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

const TextInput = styled.TextInput`
  border-width: 1px;
  border-color: #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
  color: #111111;
  background-color: #ffffff;
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

const OptionRow = styled.View`
  flex-direction: row;
  gap: 8px;
  flex-wrap: wrap;
`;

const OptionButton = styled.TouchableOpacity<{ $selected: boolean }>`
  flex: 1;
  min-width: 80px;
  padding: 12px 16px;
  border-width: 1px;
  border-color: ${(props) => (props.$selected ? '#1d42d8' : '#e0e0e0')};
  border-radius: 8px;
  background-color: ${(props) => (props.$selected ? '#eef2ff' : '#ffffff')};
  align-items: center;
`;

const OptionButtonText = styled.Text<{ $selected: boolean }>`
  font-size: 14px;
  font-weight: ${(props) => (props.$selected ? 600 : 500)};
  color: ${(props) => (props.$selected ? '#1d42d8' : '#333333')};
`;

const ButtonRow = styled.View`
  flex-direction: row;
  gap: 12px;
  margin-top: 24px;
`;

const SkipButton = styled.TouchableOpacity`
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  background-color: #1d42d8;
`;

const SkipButtonText = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
`;

