import { PrismaClient, Role, Sex } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.healthScan.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.insuranceInfo.deleteMany();
  await prisma.patientInfo.deleteMany();
  await prisma.doctorInfo.deleteMany();
  await prisma.doctorCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleared existing data');

  // Create Doctor Categories
  const categories = await Promise.all([
    prisma.doctorCategory.create({
      data: {
        name: 'Cardiologist',
        description: 'Specializes in heart and cardiovascular system',
      },
    }),
    prisma.doctorCategory.create({
      data: {
        name: 'Dermatologist',
        description: 'Specializes in skin, hair, and nail conditions',
      },
    }),
    prisma.doctorCategory.create({
      data: {
        name: 'Neurologist',
        description: 'Specializes in nervous system disorders',
      },
    }),
    prisma.doctorCategory.create({
      data: {
        name: 'Orthopedist',
        description: 'Specializes in bone and joint conditions',
      },
    }),
    prisma.doctorCategory.create({
      data: {
        name: 'Pediatrician',
        description: 'Specializes in children\'s health',
      },
    }),
  ]);

  console.log('🏥 Created doctor categories');

  // Create Admin User
  const adminPassword = await hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@qhealth.com',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  console.log('👨‍💼 Created admin user');

  // Create Doctors
  const doctorPassword = await hash('doctor123', 10);
  const doctors = await Promise.all([
    prisma.user.create({
      data: {
        email: 'dr.smith@qhealth.com',
        password: doctorPassword,
        role: Role.DOCTOR,
        doctorInfo: {
          create: {
            firstName: 'John',
            lastName: 'Smith',
            gender: Sex.MALE,
            dateOfBirth: new Date('1980-05-15'),
            contactNumber: '+1-555-0101',
            address: '123 Medical Center Dr, Healthcare City, HC 12345',
            bio: 'Experienced cardiologist with over 15 years of practice. Specializes in interventional cardiology and preventive care.',
            specialization: 'Interventional Cardiology',
            qualifications: 'MD, FACC, FSCAI',
            experience: 15,
          },
        },
        doctorCategories: {
          connect: [{ id: categories[0].id }], // Cardiologist
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'dr.johnson@qhealth.com',
        password: doctorPassword,
        role: Role.DOCTOR,
        doctorInfo: {
          create: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            gender: Sex.FEMALE,
            dateOfBirth: new Date('1985-08-22'),
            contactNumber: '+1-555-0102',
            address: '456 Dermatology Ave, Skin City, SC 67890',
            bio: 'Board-certified dermatologist specializing in cosmetic dermatology and skin cancer prevention.',
            specialization: 'Cosmetic Dermatology',
            qualifications: 'MD, FAAD',
            experience: 12,
          },
        },
        doctorCategories: {
          connect: [{ id: categories[1].id }], // Dermatologist
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'dr.williams@qhealth.com',
        password: doctorPassword,
        role: Role.DOCTOR,
        doctorInfo: {
          create: {
            firstName: 'Michael',
            lastName: 'Williams',
            gender: Sex.MALE,
            dateOfBirth: new Date('1978-12-10'),
            contactNumber: '+1-555-0103',
            address: '789 Neurology Blvd, Brain City, BC 11111',
            bio: 'Neurologist with expertise in stroke treatment and neurological disorders.',
            specialization: 'Stroke Neurology',
            qualifications: 'MD, PhD, FAAN',
            experience: 18,
          },
        },
        doctorCategories: {
          connect: [{ id: categories[2].id }], // Neurologist
        },
      },
    }),
  ]);

  console.log('👨‍⚕️ Created doctors');

  // Create Patients
  const patientPassword = await hash('patient123', 10);
  const patients = await Promise.all([
    prisma.user.create({
      data: {
        email: 'patient.anderson@email.com',
        password: patientPassword,
        role: Role.PATIENT,
        patientInfo: {
          create: {
            fullName: 'Emily Anderson',
            gender: Sex.FEMALE,
            dateOfBirth: new Date('1992-03-18'),
            contactNumber: '+1-555-0201',
            address: '321 Patient St, Health Town, HT 22222',
            weight: 65.5,
            height: 165.0,
            bloodType: 'A+',
            medicalHistory: 'No significant medical history',
            allergies: 'Penicillin',
            medications: 'None',
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'patient.brown@email.com',
        password: patientPassword,
        role: Role.PATIENT,
        patientInfo: {
          create: {
            fullName: 'David Brown',
            gender: Sex.MALE,
            dateOfBirth: new Date('1988-07-25'),
            contactNumber: '+1-555-0202',
            address: '654 Health Ave, Wellness City, WC 33333',
            weight: 78.2,
            height: 180.0,
            bloodType: 'O+',
            medicalHistory: 'Hypertension, Type 2 Diabetes',
            allergies: 'None',
            medications: 'Metformin, Lisinopril',
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'patient.garcia@email.com',
        password: patientPassword,
        role: Role.PATIENT,
        patientInfo: {
          create: {
            fullName: 'Maria Garcia',
            gender: Sex.FEMALE,
            dateOfBirth: new Date('1995-11-08'),
            contactNumber: '+1-555-0203',
            address: '987 Care Blvd, Medical City, MC 44444',
            weight: 58.0,
            height: 160.0,
            bloodType: 'B-',
            medicalHistory: 'Asthma',
            allergies: 'Dust, Pollen',
            medications: 'Albuterol inhaler',
          },
        },
      },
    }),
  ]);

  console.log('👥 Created patients');

  // Create Emergency Contacts
  await Promise.all([
    prisma.emergencyContact.create({
      data: {
        patientId: patients[0].id,
        contactName: 'Robert Anderson',
        relationship: 'Father',
        contactNumber: '+1-555-0301',
        contactAddress: '321 Patient St, Health Town, HT 22222',
      },
    }),
    prisma.emergencyContact.create({
      data: {
        patientId: patients[1].id,
        contactName: 'Jennifer Brown',
        relationship: 'Wife',
        contactNumber: '+1-555-0302',
        contactAddress: '654 Health Ave, Wellness City, WC 33333',
      },
    }),
    prisma.emergencyContact.create({
      data: {
        patientId: patients[2].id,
        contactName: 'Carlos Garcia',
        relationship: 'Brother',
        contactNumber: '+1-555-0303',
        contactAddress: '987 Care Blvd, Medical City, MC 44444',
      },
    }),
  ]);

  console.log('🚨 Created emergency contacts');

  // Create Insurance Info
  await Promise.all([
    prisma.insuranceInfo.create({
      data: {
        patientId: patients[0].id,
        providerName: 'HealthFirst Insurance',
        policyNumber: 'HF-001-2024-001',
        insuranceContact: '+1-800-HEALTH1',
      },
    }),
    prisma.insuranceInfo.create({
      data: {
        patientId: patients[1].id,
        providerName: 'WellCare Insurance',
        policyNumber: 'WC-002-2024-002',
        insuranceContact: '+1-800-WELLCARE',
      },
    }),
    prisma.insuranceInfo.create({
      data: {
        patientId: patients[2].id,
        providerName: 'MediCare Plus',
        policyNumber: 'MP-003-2024-003',
        insuranceContact: '+1-800-MEDICARE',
      },
    }),
  ]);

  console.log('🏥 Created insurance information');

  // Create Doctor Schedules
  const scheduleData = [
    { doctorId: doctors[0].id, dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00' },
    { doctorId: doctors[0].id, dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '17:00' },
    { doctorId: doctors[0].id, dayOfWeek: 'Friday', startTime: '09:00', endTime: '17:00' },
    { doctorId: doctors[1].id, dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '18:00' },
    { doctorId: doctors[1].id, dayOfWeek: 'Thursday', startTime: '10:00', endTime: '18:00' },
    { doctorId: doctors[2].id, dayOfWeek: 'Monday', startTime: '08:00', endTime: '16:00' },
    { doctorId: doctors[2].id, dayOfWeek: 'Tuesday', startTime: '08:00', endTime: '16:00' },
    { doctorId: doctors[2].id, dayOfWeek: 'Wednesday', startTime: '08:00', endTime: '16:00' },
  ];

  await Promise.all(
    scheduleData.map(schedule =>
      prisma.doctorSchedule.create({
        data: {
          doctorId: schedule.doctorId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: new Date(`2024-01-01T${schedule.startTime}:00`),
          endTime: new Date(`2024-01-01T${schedule.endTime}:00`),
        },
      })
    )
  );

  console.log('📅 Created doctor schedules');

  // Create Consultations
  const consultations = await Promise.all([
    prisma.consultation.create({
      data: {
        doctorId: doctors[0].id,
        patientId: patients[0].id,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:30:00Z'),
        consultationLink: 'https://meet.qhealth.com/consultation-001',
      },
    }),
    prisma.consultation.create({
      data: {
        doctorId: doctors[1].id,
        patientId: patients[1].id,
        startTime: new Date('2024-01-16T14:00:00Z'),
        endTime: new Date('2024-01-16T14:45:00Z'),
        consultationLink: 'https://meet.qhealth.com/consultation-002',
      },
    }),
    prisma.consultation.create({
      data: {
        doctorId: doctors[2].id,
        patientId: patients[2].id,
        startTime: new Date('2024-01-17T09:00:00Z'),
        consultationLink: 'https://meet.qhealth.com/consultation-003',
      },
    }),
  ]);

  console.log('💬 Created consultations');

  // Create Health Scans
  await Promise.all([
    prisma.healthScan.create({
      data: {
        consultationId: consultations[0].id,
        bloodPressure: '120/80',
        heartRate: 72.0,
        spO2: 98.0,
        respiratoryRate: 12.0,
        stressLevel: 2.1,
        stressScore: 245.6,
        hrvSdnn: 45.2,
        hrvRmsdd: 44.1,
        generalWellness: 78.5,
        generalRisk: 3.2,
        coronaryHeartDisease: 1.8,
        congestiveHeartFailure: 0.2,
        intermittentClaudication: 0.5,
        strokeRisk: 1.2,
        covidRisk: 2.1,
        height: 165.0,
        weight: 65.5,
        smoker: false,
        hypertension: false,
        bpMedication: false,
        diabetic: 0,
        waistCircumference: 75.0,
        heartDisease: false,
        depression: false,
        totalCholesterol: 180.0,
        hdl: 55.0,
        parentalHypertension: 0,
        physicalActivity: true,
        healthyDiet: true,
        antiHypertensive: false,
        historyBloodGlucose: false,
        historyFamilyDiabetes: 0,
      },
    }),
    prisma.healthScan.create({
      data: {
        consultationId: consultations[1].id,
        bloodPressure: '135/85',
        heartRate: 78.0,
        spO2: 96.0,
        respiratoryRate: 14.0,
        stressLevel: 3.5,
        stressScore: 312.8,
        hrvSdnn: 38.7,
        hrvRmsdd: 37.2,
        generalWellness: 65.3,
        generalRisk: 6.8,
        coronaryHeartDisease: 4.2,
        congestiveHeartFailure: 0.8,
        intermittentClaudication: 1.2,
        strokeRisk: 2.8,
        covidRisk: 3.5,
        height: 180.0,
        weight: 78.2,
        smoker: false,
        hypertension: true,
        bpMedication: true,
        diabetic: 2,
        waistCircumference: 88.0,
        heartDisease: false,
        depression: false,
        totalCholesterol: 220.0,
        hdl: 45.0,
        parentalHypertension: 1,
        physicalActivity: false,
        healthyDiet: false,
        antiHypertensive: true,
        historyBloodGlucose: true,
        historyFamilyDiabetes: 1,
      },
    }),
  ]);

  console.log('🔬 Created health scans');

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📊 Summary of created data:');
  console.log(`   - Admin users: 1`);
  console.log(`   - Doctor categories: ${categories.length}`);
  console.log(`   - Doctors: ${doctors.length}`);
  console.log(`   - Patients: ${patients.length}`);
  console.log(`   - Emergency contacts: 3`);
  console.log(`   - Insurance info: 3`);
  console.log(`   - Doctor schedules: ${scheduleData.length}`);
  console.log(`   - Consultations: ${consultations.length}`);
  console.log(`   - Health scans: 2`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
