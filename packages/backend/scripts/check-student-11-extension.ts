import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStudent11Extension() {
  try {
    const contract = await prisma.contract.findFirst({
      where: {
        student: {
          id: 11,
        },
      },
    });

    if (!contract) {
      console.log('11번 수강생의 계약을 찾을 수 없습니다.');
      return;
    }

    const policySnapshot = contract.policy_snapshot as Record<string, any>;
    const extensions = Array.isArray(policySnapshot.extensions) ? policySnapshot.extensions : [];

    console.log('계약 ID:', contract.id);
    console.log('\npolicy_snapshot.extensions:');
    console.log(JSON.stringify(extensions, null, 2));

    if (extensions.length > 0) {
      const lastExtension = extensions[extensions.length - 1];
      console.log('\n마지막 연장 정보:');
      console.log(`  added_sessions: ${lastExtension.added_sessions}`);
      console.log(`  extension_amount: ${lastExtension.extension_amount}`);
      console.log(`  previous_total: ${lastExtension.previous_total}`);
      console.log(`  new_total: ${lastExtension.new_total}`);
    }

    // 정산서 확인
    const invoices = await prisma.invoice.findMany({
      where: {
        contract_id: contract.id,
        student_id: 11,
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

checkStudent11Extension();



