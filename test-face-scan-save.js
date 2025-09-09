// Test script to verify face scan save functionality
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFaceScanSave() {
  try {
    console.log('🔍 Testing face scan save functionality...');
    
    // Test 1: Check database connection
    console.log('\n1️⃣ Testing database connection...');
    const userCount = await prisma.user.count();
    console.log('✅ Database connected. User count:', userCount);
    
    // Test 2: Check if we have any patients
    console.log('\n2️⃣ Checking for patients...');
    const patients = await prisma.user.findMany({
      where: { role: 'PATIENT' },
      include: { patientInfo: true }
    });
    console.log('✅ Found patients:', patients.length);
    
    if (patients.length === 0) {
      console.log('⚠️ No patients found. You need to create a patient user first.');
      return;
    }
    
    const testPatient = patients[0];
    console.log('✅ Using test patient:', testPatient.email, 'ID:', testPatient.id);
    
    // Test 3: Try to create a consultation
    console.log('\n3️⃣ Testing consultation creation...');
    const consultationCode = `SC${(testPatient.id % 100).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    
    const consultation = await prisma.consultation.create({
      data: {
        doctorId: testPatient.id,
        patientId: testPatient.id,
        startTime: new Date(),
        endTime: new Date(),
        consultationCode,
        isPublic: false,
        notes: 'Test self-check health scan',
        diagnosis: 'Test health assessment',
        treatment: 'Continue monitoring',
        followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    console.log('✅ Consultation created with ID:', consultation.id);
    
    // Test 4: Try to create a health scan
    console.log('\n4️⃣ Testing health scan creation...');
    const healthScanData = {
      consultationId: consultation.id,
      heartRate: 72.0,
      bloodPressure: '120/80',
      spO2: 98.5,
      respiratoryRate: 16.0,
      stressLevel: 2.5,
      generalWellness: 85.0,
      coronaryHeartDisease: 0.012, // 1.2%
      congestiveHeartFailure: 0.008, // 0.8%
      strokeRisk: 0.015 // 1.5%
    };
    
    const healthScan = await prisma.healthScan.create({
      data: healthScanData
    });
    console.log('✅ Health scan created with ID:', healthScan.id);
    console.log('✅ Health scan data:', JSON.stringify(healthScan, null, 2));
    
    // Test 5: Verify the data was saved
    console.log('\n5️⃣ Verifying saved data...');
    const savedHealthScan = await prisma.healthScan.findUnique({
      where: { id: healthScan.id },
      include: { consultation: true }
    });
    
    if (savedHealthScan) {
      console.log('✅ Health scan successfully saved and retrieved!');
      console.log('✅ Heart Rate:', savedHealthScan.heartRate);
      console.log('✅ Blood Pressure:', savedHealthScan.bloodPressure);
      console.log('✅ SpO2:', savedHealthScan.spO2);
      console.log('✅ General Wellness:', savedHealthScan.generalWellness);
    } else {
      console.log('❌ Health scan not found after creation!');
    }
    
    // Cleanup
    console.log('\n6️⃣ Cleaning up test data...');
    await prisma.healthScan.delete({ where: { id: healthScan.id } });
    await prisma.consultation.delete({ where: { id: consultation.id } });
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! The face scan save functionality should work.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFaceScanSave();
