import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStudent12() {
  try {
    const contract = await prisma.contract.findFirst({
      where: {
        student: {
          id: 12,
        },
      },
    });

    if (!contract) {
      console.log('12번 수강생의 계약을 찾을 수 없습니다.');
      return;
    }

    const policySnapshot = contract.policy_snapshot as Record<string, any>;
    const extensions = Array.isArray(policySnapshot.extensions) ? policySnapshot.extensions : [];

    console.log('12번 수강생 계약 정보:');
    console.log(`계약 ID: ${contract.id}`);
    console.log(`월 수업료: ${contract.monthly_amount}`);
    console.log(`총 회차: ${policySnapshot.total_sessions || 0}`);
    
    console.log('\npolicy_snapshot:');
    console.log(JSON.stringify(policySnapshot, null, 2));

    if (extensions.length > 0) {
      console.log('\n연장 정보:');
      extensions.forEach((ext, index) => {
        console.log(`\n연장 ${index + 1}:`);
        console.log(`  type: ${ext.type}`);
        console.log(`  added_sessions: ${ext.added_sessions}`);
        console.log(`  extension_amount: ${ext.extension_amount}`);
        console.log(`  previous_total: ${ext.previous_total}`);
        console.log(`  new_total: ${ext.new_total}`);
        console.log(`  extended_at: ${ext.extended_at}`);
      });
    } else {
      console.log('\n연장 정보 없음');
    }

    // 정산서 확인
    const invoices = await prisma.invoice.findMany({
      where: {
        contract_id: contract.id,
        student_id: 12,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    console.log('\n정산서 목록:');
    invoices.forEach((invoice, index) => {
      console.log(`\n정산서 ${index + 1} (ID: ${invoice.id}):`);
      console.log(`  year/month: ${invoice.year}/${invoice.month}`);
      console.log(`  base_amount: ${invoice.base_amount.toLocaleString()}원`);
      console.log(`  final_amount: ${invoice.final_amount.toLocaleString()}원`);
      console.log(`  created_at: ${invoice.created_at}`);
    });
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudent12();



