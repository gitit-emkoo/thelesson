import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeExtensionForStudent12() {
  try {
    // 12번 수강생의 계약 찾기
    const student = await prisma.student.findUnique({
      where: { id: 12 },
      include: {
        contracts: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!student) {
      console.log('12번 수강생을 찾을 수 없습니다.');
      return;
    }

    console.log(`12번 수강생: ${student.name}`);
    console.log(`계약 수: ${student.contracts.length}`);

    for (const contract of student.contracts) {
      const policySnapshot = (contract.policy_snapshot ?? {}) as Record<string, any>;
      const extensions = Array.isArray(policySnapshot.extensions) ? policySnapshot.extensions : [];

      if (extensions.length > 0) {
        console.log(`\n계약 ID ${contract.id}의 연장 정보:`);
        console.log(JSON.stringify(extensions, null, 2));

        // extensions 배열 제거
        const updatedPolicySnapshot: Record<string, any> = {
          ...policySnapshot,
          extensions: [],
        };

        // total_sessions를 원래 값으로 복원 (첫 번째 extension의 previous_total 사용)
        if (extensions.length > 0 && extensions[0].previous_total) {
          updatedPolicySnapshot.total_sessions = extensions[0].previous_total;
          console.log(`total_sessions를 ${extensions[0].previous_total}로 복원`);
        }

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            policy_snapshot: updatedPolicySnapshot,
          },
        });

        console.log(`계약 ID ${contract.id}의 연장 정보를 제거했습니다.`);

        // 연장으로 생성된 정산서도 삭제
        const extensionInvoices = await prisma.invoice.findMany({
          where: {
            contract_id: contract.id,
            student_id: student.id,
          },
          orderBy: { created_at: 'asc' },
        });

        if (extensionInvoices.length > 1) {
          // 첫 번째 정산서는 유지, 나머지는 삭제
          const invoicesToDelete = extensionInvoices.slice(1);
          for (const invoice of invoicesToDelete) {
            await prisma.invoice.delete({
              where: { id: invoice.id },
            });
            console.log(`정산서 ID ${invoice.id} 삭제`);
          }
        }
      } else {
        console.log(`계약 ID ${contract.id}에는 연장 정보가 없습니다.`);
      }
    }

    console.log('\n완료되었습니다.');
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeExtensionForStudent12();



