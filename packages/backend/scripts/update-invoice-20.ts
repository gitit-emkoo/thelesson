import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateInvoice20() {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: 20 },
      include: {
        contract: true,
      },
    });

    if (!invoice) {
      console.log('정산서 ID 20을 찾을 수 없습니다.');
      return;
    }

    const policySnapshot = invoice.contract.policy_snapshot as Record<string, any>;
    const extensions = Array.isArray(policySnapshot.extensions) ? policySnapshot.extensions : [];

    console.log('정산서 ID 20 정보:');
    console.log(`  현재 base_amount: ${invoice.base_amount.toLocaleString()}원`);
    console.log(`  extensions 개수: ${extensions.length}`);

    if (extensions.length > 0) {
      // 두 번째 정산서이므로 첫 번째 연장 정보 사용
      const extension = extensions[0];
      console.log(`\n첫 번째 연장 정보:`);
      console.log(`  added_sessions: ${extension.added_sessions}`);
      console.log(`  extension_amount: ${extension.extension_amount}`);

      if (extension.extension_amount && extension.extension_amount > 0) {
        const newBaseAmount = extension.extension_amount;
        const newFinalAmount = newBaseAmount + invoice.auto_adjustment;

        await prisma.invoice.update({
          where: { id: 20 },
          data: {
            base_amount: newBaseAmount,
            final_amount: newFinalAmount,
          },
        });

        console.log(`\n정산서 업데이트 완료:`);
        console.log(`  base_amount: ${newBaseAmount.toLocaleString()}원`);
        console.log(`  final_amount: ${newFinalAmount.toLocaleString()}원`);
      } else {
        console.log('\n연장 금액이 없습니다.');
      }
    } else {
      console.log('\n연장 정보가 없습니다.');
    }
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateInvoice20();



