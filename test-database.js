const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection and data...\n');

    // Test users
    const users = await prisma.user.findMany({
      include: {
        patientInfo: true,
        doctorInfo: true
      }
    });

    console.log(`📊 Total users: ${users.length}`);
    
    const patients = users.filter(u => u.role === 'PATIENT');
    const doctors = users.filter(u => u.role === 'DOCTOR');
    const admins = users.filter(u => u.role === 'ADMIN');

    console.log(`👥 Patients: ${patients.length}`);
    console.log(`👨‍⚕️ Doctors: ${doctors.length}`);
    console.log(`👨‍💼 Admins: ${admins.length}\n`);

    if (patients.length > 0) {
      console.log('✅ Available patients:');
      patients.forEach(patient => {
        console.log(`   - ID: ${patient.id}, Name: ${patient.patientInfo?.fullName || 'Unknown'}, Email: ${patient.email}`);
      });
    } else {
      console.log('❌ No patients found in database');
      console.log('💡 Run: npm run seed to populate the database');
    }

    if (doctors.length > 0) {
      console.log('\n✅ Available doctors:');
      doctors.forEach(doctor => {
        console.log(`   - ID: ${doctor.id}, Name: ${doctor.doctorInfo?.firstName || 'Unknown'} ${doctor.doctorInfo?.lastName || ''}, Email: ${doctor.email}`);
      });
    }

    // Test prescriptions table
    const prescriptions = await prisma.prescription.findMany();
    console.log(`\n💊 Existing prescriptions: ${prescriptions.length}`);

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
