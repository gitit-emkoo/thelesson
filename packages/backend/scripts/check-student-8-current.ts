import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { student_id: 8 },
    include: {
      invoices: {
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!contract) {
    console.log('Contract not found');
    return;
  }

  console.log('Contract ID:', contract.id);
  const policySnapshot = contract.policy_snapshot as any;
  console.log('Total Sessions:', policySnapshot?.total_sessions);
  console.log('Extensions:', JSON.stringify(policySnapshot?.extensions, null, 2));
  
  console.log('\nInvoices:');
  contract.invoices.forEach((inv, idx) => {
    console.log(`  ${idx + 1}. Invoice ID: ${inv.id}, Year: ${inv.year}, Month: ${inv.month}`);
    console.log(`     Base Amount: ${inv.base_amount}, Final Amount: ${inv.final_amount}`);
    console.log(`     Send Status: ${inv.send_status}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);



