import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStudent() {
  try {
    const studentId = 25;
    
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        contracts: {
          orderBy: { created_at: 'desc' },
          include: {
            invoices: {
              orderBy: [{ year: 'desc' }, { month: 'desc' }],
            },
          },
        },
      },
    });

    if (!student) {
      console.log('수강생을 찾을 수 없습니다.');
      return;
    }

    console.log('=== 수강생 정보 ===');
    console.log(`ID: ${student.id}`);
    console.log(`이름: ${student.name}`);
    console.log(`연락처: ${student.phone}`);
    console.log(`보호자: ${student.guardian_name || '-'}`);
    console.log(`보호자 연락처: ${student.guardian_phone || '-'}`);
    console.log(`활성화: ${student.is_active ? '예' : '아니오'}`);
    console.log(`생성일: ${student.created_at}`);
    console.log('');

    console.log(`=== 계약 정보 (${student.contracts.length}개) ===`);
    student.contracts.forEach((contract, index) => {
      console.log(`\n[계약 ${index + 1}]`);
      console.log(`  ID: ${contract.id}`);
      console.log(`  과목: ${contract.subject}`);
      console.log(`  상태: ${contract.status}`);
      console.log(`  청구유형: ${contract.billing_type}`);
      console.log(`  계약기간: ${contract.started_at ? new Date(contract.started_at).toLocaleDateString('ko-KR') : '-'} ~ ${contract.ended_at ? new Date(contract.ended_at).toLocaleDateString('ko-KR') : '-'}`);
      console.log(`  청구일: ${contract.billing_day || '-'}일`);
      console.log(`  월 수업료: ${contract.monthly_amount.toLocaleString()}원`);
      console.log(`  청구서 개수: ${contract.invoices.length}개`);
      
      if (contract.invoices.length > 0) {
        console.log(`  청구서 목록:`);
        contract.invoices.forEach((invoice) => {
          const createdDate = new Date(invoice.created_at).toLocaleDateString('ko-KR');
          const periodStart = invoice.period_start ? new Date(invoice.period_start).toLocaleDateString('ko-KR') : '-';
          const periodEnd = invoice.period_end ? new Date(invoice.period_end).toLocaleDateString('ko-KR') : '-';
          console.log(`    - ${invoice.year}년 ${invoice.month}월: 생성일=${createdDate}, 기간=${periodStart}~${periodEnd}, 상태=${invoice.send_status}, 금액=${invoice.final_amount.toLocaleString()}원`);
        });
      }
    });
  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudent();




