import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStudent8Invoice() {
  try {
    const student = await prisma.student.findUnique({
      where: { id: 8 },
      include: {
        contracts: {
          include: {
            invoices: {
              orderBy: { created_at: 'asc' },
            },
          },
        },
      },
    });

    if (!student) {
      console.log('8번 수강생을 찾을 수 없습니다.');
      return;
    }

    console.log(`\n8번 수강생: ${student.name}`);
    
    for (const contract of student.contracts) {
      console.log(`\n계약 ID: ${contract.id}`);
      console.log(`월 수업료: ${contract.monthly_amount}`);
      
      const policySnapshot = (contract.policy_snapshot ?? {}) as Record<string, any>;
      console.log(`\npolicy_snapshot:`);
      console.log(JSON.stringify(policySnapshot, null, 2));
      
      const totalSessions = typeof policySnapshot.total_sessions === 'number' ? policySnapshot.total_sessions : 0;
      const monthlyAmount = typeof policySnapshot.monthly_amount === 'number' ? policySnapshot.monthly_amount : contract.monthly_amount;
      const perSessionAmount = typeof policySnapshot.per_session_amount === 'number' ? policySnapshot.per_session_amount : null;
      
      console.log(`\n총 회차: ${totalSessions}`);
      console.log(`월 수업료: ${monthlyAmount}`);
      console.log(`명시적 단가: ${perSessionAmount || '없음'}`);
      
      const extensions = Array.isArray(policySnapshot.extensions) ? policySnapshot.extensions : [];
      console.log(`\n연장 정보:`);
      console.log(JSON.stringify(extensions, null, 2));
      
      if (extensions.length > 0) {
        const addedSessionsTotal = extensions.reduce(
          (sum: number, ext: any) => sum + (ext.added_sessions || 0),
          0,
        );
        const originalTotalSessions = totalSessions - addedSessionsTotal > 0
          ? totalSessions - addedSessionsTotal
          : totalSessions;
        
        console.log(`\n연장으로 추가된 총 회차: ${addedSessionsTotal}`);
        console.log(`최초 계약 회차: ${originalTotalSessions}`);
        
        let perSession = perSessionAmount || 0;
        if (!perSession && originalTotalSessions > 0 && monthlyAmount) {
          perSession = monthlyAmount / originalTotalSessions;
        }
        if (!perSession || perSession <= 0) {
          perSession = monthlyAmount && totalSessions > 0 ? monthlyAmount / totalSessions : 0;
        }
        
        console.log(`\n계산된 단가: ${perSession.toLocaleString()}원`);
        
        // 각 연장별로 계산
        extensions.forEach((ext: any, index: number) => {
          const added = ext.added_sessions || 0;
          const expectedAmount = perSession * added;
          console.log(`\n연장 ${index + 1}:`);
          console.log(`  추가 회차: ${added}`);
          console.log(`  예상 금액: ${expectedAmount.toLocaleString()}원 (단가 ${perSession.toLocaleString()}원 × ${added}회)`);
        });
      }
      
      console.log(`\n정산서 목록:`);
      for (const invoice of contract.invoices) {
        console.log(`\n정산서 ID: ${invoice.id}`);
        console.log(`  year/month: ${invoice.year}/${invoice.month}`);
        console.log(`  base_amount: ${invoice.base_amount.toLocaleString()}원`);
        console.log(`  auto_adjustment: ${invoice.auto_adjustment.toLocaleString()}원`);
        console.log(`  final_amount: ${invoice.final_amount.toLocaleString()}원`);
        console.log(`  send_status: ${invoice.send_status}`);
      }
    }
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudent8Invoice();



