import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteInvoice18() {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: 18 },
    });

    if (!invoice) {
      console.log('정산서 ID 18을 찾을 수 없습니다.');
      return;
    }

    console.log(`정산서 ID 18 삭제:`);
    console.log(`  student_id: ${invoice.student_id}`);
    console.log(`  contract_id: ${invoice.contract_id}`);
    console.log(`  year/month: ${invoice.year}/${invoice.month}`);
    console.log(`  base_amount: ${invoice.base_amount.toLocaleString()}원`);

    await prisma.invoice.delete({
      where: { id: 18 },
    });

    console.log('\n정산서 ID 18이 삭제되었습니다.');
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteInvoice18();



