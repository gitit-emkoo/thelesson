import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteStudent8() {
  try {
    const student = await prisma.student.findUnique({
      where: { id: 8 },
      include: {
        contracts: {
          include: {
            invoices: true,
            attendance_logs: true,
          },
        },
      },
    });

    if (!student) {
      console.log('8번 수강생을 찾을 수 없습니다.');
      return;
    }

    console.log(`8번 수강생: ${student.name}`);
    console.log(`계약 수: ${student.contracts.length}`);
    
    let invoiceCount = 0;
    let attendanceCount = 0;
    
    for (const contract of student.contracts) {
      invoiceCount += contract.invoices.length;
      attendanceCount += contract.attendance_logs.length;
    }
    
    console.log(`정산서 수: ${invoiceCount}`);
    console.log(`출결 기록 수: ${attendanceCount}`);

    // 학생 삭제 (CASCADE로 관련 데이터도 자동 삭제됨)
    await prisma.student.delete({
      where: { id: 8 },
    });

    console.log('\n8번 수강생이 삭제되었습니다.');
    console.log('(관련된 계약서, 출결기록, 정산서도 함께 삭제되었습니다)');
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteStudent8();



