import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import styled from 'styled-components/native';
import { usersApi } from '../../api/users';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  initialName?: string;
  initialOrgCode?: string;
}

export default function ProfileEditModal({
  visible,
  onClose,
  onSave,
  initialName = '',
  initialOrgCode = '',
}: ProfileEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState(initialName);
  const [orgCode, setOrgCode] = useState(initialOrgCode);

  useEffect(() => {
    if (visible) {
      setUserName(initialName);
      setOrgCode(initialOrgCode);
    }
  }, [visible, initialName, initialOrgCode]);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (userName.trim()) {
        await usersApi.updateName(userName.trim());
      }
      if (orgCode.trim()) {
        await usersApi.updateOrgCode(orgCode.trim());
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('[ProfileEditModal] save error', error);
      Alert.alert('오류', error?.message || '프로필 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <ModalOverlay>
        <ModalContainer>
          <ModalHeader>
            <ModalTitle>프로필 수정</ModalTitle>
            <CloseButton onPress={onClose}>
              <CloseButtonText>닫기</CloseButtonText>
            </CloseButton>
          </ModalHeader>

          <ModalContent>
            <InputLabel>이름</InputLabel>
            <StyledTextInput
              value={userName}
              onChangeText={setUserName}
              placeholder="예: 김선생"
              autoCapitalize="none"
            />
            <InputLabel>상호명</InputLabel>
            <StyledTextInput
              value={orgCode}
              onChangeText={setOrgCode}
              placeholder="예: thelesson"
              autoCapitalize="none"
            />
          </ModalContent>

          <ButtonContainer>
            <SaveButton onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#ff6b00" />
              ) : (
                <SaveButtonText>수정</SaveButtonText>
              )}
            </SaveButton>
          </ButtonContainer>
        </ModalContainer>
      </ModalOverlay>
    </Modal>
  );
}

// Styled Components
const ModalOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const ModalContainer = styled.View`
  background-color: #ffffff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  max-height: 90%;
  padding-bottom: 40px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom-width: 1px;
  border-bottom-color: #e0e0e0;
`;

const ModalTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #111111;
`;

const CloseButton = styled.TouchableOpacity`
  padding: 8px;
`;

const CloseButtonText = styled.Text`
  font-size: 16px;
  color: #ff6b00;
  font-weight: 600;
`;

const ModalContent = styled.View`
  padding: 20px;
`;

const InputLabel = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  margin-top: 12px;
  margin-bottom: 8px;
`;

const StyledTextInput = styled.TextInput`
  border-width: 1px;
  border-color: #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  font-size: 16px;
  background-color: #ffffff;
  margin-bottom: 8px;
`;

const ButtonContainer = styled.View`
  padding: 20px;
`;

const SaveButton = styled.TouchableOpacity<{ disabled?: boolean }>`
  background-color: ${(props) => (props.disabled ? '#cccccc' : '#ff6b00')};
  padding: 16px;
  border-radius: 12px;
  align-items: center;
`;

const SaveButtonText = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

