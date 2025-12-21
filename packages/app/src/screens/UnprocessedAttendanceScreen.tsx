import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';
import { attendanceApi } from '../api/attendance';
import AttendanceAbsenceModal from '../components/modals/AttendanceAbsenceModal';
import AttendanceSignatureModal from '../components/modals/AttendanceSignatureModal';
import AttendanceConfirmModal from '../components/modals/AttendanceConfirmModal';
import { useStudentsStore } from '../store/useStudentsStore';

interface UnprocessedItem {
  contract_id: number;
  student_id: number;
  student_name: string;
  subject: string;
  day_of_week: string[];
  time: string | null;
  missed_date: string; // YYYY-MM-DD
}

function UnprocessedAttendanceContent() {
  const navigation = useNavigation();
  const fetchStudentDetail = useStudentsStore((state) => state.fetchStudentDetail);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UnprocessedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<UnprocessedItem | null>(null);
  const [showAttendanceSignatureModal, setShowAttendanceSignatureModal] = useState(false);
  const [showAttendanceAbsenceModal, setShowAttendanceAbsenceModal] = useState(false);
  const [showAttendanceConfirmModal, setShowAttendanceConfirmModal] = useState(false);

  const loadUnprocessed = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getUnprocessed();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('[UnprocessedAttendance] load error', error);
      Alert.alert('오류', '미처리 출결을 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnprocessed();
    }, [loadUnprocessed]),
  );

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day}(${dayOfWeek})`;
  };

  const formatDayOfWeek = (dayOfWeekArray: string[]): string => {
    const dayNames: Record<string, string> = {
      MON: '월',
      TUE: '화',
      WED: '수',
      THU: '목',
      FRI: '금',
      SAT: '토',
      SUN: '일',
    };
    return dayOfWeekArray.map((d) => dayNames[d] || d).join('/');
  };

  const handlePresent = useCallback((item: UnprocessedItem) => {
    setSelectedItem(item);
    // 서명 필요 여부는 계약서 정보를 확인해야 하지만, 일단 기본값으로 처리
    setShowAttendanceConfirmModal(true);
  }, []);

  const handleAbsence = useCallback((item: UnprocessedItem) => {
    setSelectedItem(item);
    setShowAttendanceAbsenceModal(true);
  }, []);

  const handleAttendancePresentSubmit = useCallback(
    async (signatureData?: string) => {
      if (!selectedItem) return;

      try {
        const occurredAt = new Date(selectedItem.missed_date);
        occurredAt.setHours(12, 0, 0, 0); // 정오로 설정

        await attendanceApi.create({
          student_id: selectedItem.student_id,
          contract_id: selectedItem.contract_id,
          occurred_at: occurredAt.toISOString(),
          status: 'present',
          signature_data: signatureData,
        });

        Alert.alert('완료', '출석이 기록되었습니다.');
        await loadUnprocessed();
        // 해당 수강생의 상세 정보도 새로고침 (출결 기록 반영)
        if (selectedItem?.student_id) {
          await fetchStudentDetail(selectedItem.student_id, { force: true }).catch(() => {
            // 에러는 무시 (수강생 상세 화면이 열려있지 않을 수 있음)
          });
        }
        setSelectedItem(null);
      } catch (error: any) {
        console.error('[UnprocessedAttendance] create attendance error', error);
        Alert.alert('오류', error?.message || '출석 기록에 실패했습니다.');
      }
    },
    [selectedItem, loadUnprocessed, fetchStudentDetail],
  );

  const handleAttendanceAbsenceSubmit = useCallback(
    async (data: {
      status: 'absent' | 'substitute';
      substitute_at?: string;
      reason: string;
    }) => {
      if (!selectedItem) return;

      try {
        const occurredAt = new Date(selectedItem.missed_date);
        occurredAt.setHours(12, 0, 0, 0);

        await attendanceApi.create({
          student_id: selectedItem.student_id,
          contract_id: selectedItem.contract_id,
          occurred_at: occurredAt.toISOString(),
          status: data.status,
          substitute_at: data.substitute_at,
          memo_public: data.reason,
        });

        Alert.alert('완료', `${data.status === 'absent' ? '결석' : '대체'}이 기록되었습니다.`);
        await loadUnprocessed();
        // 해당 수강생의 상세 정보도 새로고침 (출결 기록 반영)
        if (selectedItem?.student_id) {
          await fetchStudentDetail(selectedItem.student_id, { force: true }).catch(() => {
            // 에러는 무시 (수강생 상세 화면이 열려있지 않을 수 있음)
          });
        }
        setSelectedItem(null);
      } catch (error: any) {
        console.error('[UnprocessedAttendance] create absence error', error);
        Alert.alert('오류', error?.message || '기록에 실패했습니다.');
      }
    },
    [selectedItem, loadUnprocessed, fetchStudentDetail],
  );

  const groupedItems = useMemo(() => {
    const groups: Record<string, UnprocessedItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.missed_date]) {
        groups[item.missed_date] = [];
      }
      groups[item.missed_date].push(item);
    });
    return groups;
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <Container>
        <CenteredContainer>
          <ActivityIndicator size="large" color="#ff6b00" />
          <CenteredText>미처리 출결을 불러오는 중...</CenteredText>
        </CenteredContainer>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container>
        <Header>
          <Subtitle>미처리 출결이 없습니다.</Subtitle>
        </Header>
        <CenteredContainer>
          <CenteredText>미처리 출결이 없습니다.</CenteredText>
        </CenteredContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Subtitle>총 {items.length}건</Subtitle>
      </Header>
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.keys(groupedItems)
          .sort()
          .map((date) => (
            <DateGroup key={date}>
              <DateHeader>{formatDate(date)}</DateHeader>
              {groupedItems[date].map((item, index) => (
                <ItemCard key={`${item.contract_id}-${item.missed_date}-${index}`}>
                  <ItemHeader>
                    <StudentName>{item.student_name}</StudentName>
                    <Subject>{item.subject}</Subject>
                  </ItemHeader>
                  <ItemInfo>
                    <ItemInfoText>{formatDayOfWeek(item.day_of_week)}</ItemInfoText>
                    {item.time && <ItemInfoText> • {item.time}</ItemInfoText>}
                  </ItemInfo>
                  <ButtonRow>
                    <ActionButton onPress={() => handlePresent(item)} variant="primary">
                      <ActionButtonText variant="primary">출석</ActionButtonText>
                    </ActionButton>
                    <ActionButton onPress={() => handleAbsence(item)} variant="secondary">
                      <ActionButtonText variant="secondary">결석/대체</ActionButtonText>
                    </ActionButton>
                  </ButtonRow>
                </ItemCard>
              ))}
            </DateGroup>
          ))}
      </ScrollView>

      {/* 출석 서명 모달 */}
      {selectedItem && (
        <AttendanceSignatureModal
          visible={showAttendanceSignatureModal}
          onClose={() => {
            setShowAttendanceSignatureModal(false);
            setSelectedItem(null);
          }}
          onConfirm={(signature: string) => {
            handleAttendancePresentSubmit(signature);
            setShowAttendanceSignatureModal(false);
            setSelectedItem(null);
          }}
          studentName={selectedItem.student_name}
        />
      )}

      {/* 출석 확인 모달 */}
      {selectedItem && (
        <AttendanceConfirmModal
          visible={showAttendanceConfirmModal}
          onClose={() => {
            setShowAttendanceConfirmModal(false);
            setSelectedItem(null);
          }}
          onConfirm={() => {
            handleAttendancePresentSubmit();
            setShowAttendanceConfirmModal(false);
            setSelectedItem(null);
          }}
          studentName={selectedItem.student_name}
        />
      )}

      {/* 결석/대체 모달 */}
      {selectedItem && (
        <AttendanceAbsenceModal
          visible={showAttendanceAbsenceModal}
          onClose={() => {
            setShowAttendanceAbsenceModal(false);
            setSelectedItem(null);
          }}
          onConfirm={(data) => {
            handleAttendanceAbsenceSubmit(data);
            setShowAttendanceAbsenceModal(false);
            setSelectedItem(null);
          }}
          studentName={selectedItem.student_name}
        />
      )}
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: #ffffff;
`;

const Header = styled.View`
  padding: 16px;
  background-color: #ffffff;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
`;

const Title = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #111111;
`;

const Subtitle = styled.Text`
  margin-top: 4px;
  font-size: 14px;
  color: #666666;
`;

const CenteredContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 40px;
`;

const CenteredText = styled.Text`
  font-size: 16px;
  color: #8e8e93;
  margin-top: 12px;
`;

const DateGroup = styled.View`
  margin-bottom: 24px;
`;

const DateHeader = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #111111;
  padding: 12px 16px;
  background-color: #f8f9fa;
`;

const ItemCard = styled.View`
  background-color: #ffffff;
  padding: 16px;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
`;

const ItemHeader = styled.View`
  margin-bottom: 8px;
`;

const StudentName = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #111111;
`;

const Subject = styled.Text`
  font-size: 14px;
  color: #666666;
  margin-top: 4px;
`;

const ItemInfo = styled.View`
  flex-direction: row;
  margin-bottom: 12px;
`;

const ItemInfoText = styled.Text`
  font-size: 13px;
  color: #8e8e93;
`;

const ButtonRow = styled.View`
  flex-direction: row;
  gap: 8px;
`;

const ActionButton = styled.TouchableOpacity<{ variant: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  background-color: ${(props) => (props.variant === 'primary' ? '#1d42d8' : '#c7d2fe')};
`;

const ActionButtonText = styled.Text<{ variant: 'primary' | 'secondary' }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => (props.variant === 'primary' ? '#ffffff' : '#1d42d8')};
`;

export default function UnprocessedAttendanceScreen() {
  return <UnprocessedAttendanceContent />;
}

