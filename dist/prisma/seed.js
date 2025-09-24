"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🌱 Starting database seeding...');
        // Clear existing data
        yield prisma.healthScan.deleteMany();
        yield prisma.consultation.deleteMany();
        yield prisma.doctorSchedule.deleteMany();
        yield prisma.emergencyContact.deleteMany();
        yield prisma.insuranceInfo.deleteMany();
        yield prisma.patientInfo.deleteMany();
        yield prisma.doctorInfo.deleteMany();
        yield prisma.doctorCategory.deleteMany();
        yield prisma.user.deleteMany();
        yield prisma.organization.deleteMany();
        console.log('🧹 Cleared existing data');
        // Create Organizations
        const organizations = yield Promise.all([
            prisma.organization.create({
                data: {
                    name: 'Quanby Healthcare Center',
                    description: 'Primary healthcare facility providing comprehensive medical services',
                    address: '123 Healthcare Blvd, Medical City, MC 12345',
                    phone: '+1-555-HEALTH',
                    email: 'info@quanbyhealthcare.com',
                    website: 'https://quanbyhealthcare.com',
                    isActive: true,
                },
            }),
            prisma.organization.create({
                data: {
                    name: 'Metro General Hospital',
                    description: 'Large general hospital with specialized departments',
                    address: '456 Hospital Ave, Metro City, MC 67890',
                    phone: '+1-555-HOSPITAL',
                    email: 'contact@metrogeneral.com',
                    website: 'https://metrogeneral.com',
                    isActive: true,
                },
            }),
        ]);
        console.log('🏢 Created organizations');
        // Create Doctor Categories
        const categories = yield Promise.all([
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
        // Create Super Admin User
        const superAdminPassword = yield (0, bcryptjs_1.hash)('superadmin123', 10);
        const superAdmin = yield prisma.user.create({
            data: {
                email: 'superadmin@qhealth.com',
                password: superAdminPassword,
                role: client_1.Role.SUPER_ADMIN,
                // Super admin doesn't belong to any organization
            },
        });
        console.log('👑 Created super admin user');
        // Create Admin Users for each organization
        const adminPassword = yield (0, bcryptjs_1.hash)('admin123', 10);
        const admins = yield Promise.all([
            prisma.user.create({
                data: {
                    email: 'admin@quanbyhealthcare.com',
                    password: adminPassword,
                    role: client_1.Role.ADMIN,
                    organizationId: organizations[0].id, // Quanby Healthcare Center
                },
            }),
            prisma.user.create({
                data: {
                    email: 'admin@metrogeneral.com',
                    password: adminPassword,
                    role: client_1.Role.ADMIN,
                    organizationId: organizations[1].id, // Metro General Hospital
                },
            }),
        ]);
        console.log('👨‍💼 Created admin users');
        // Create Doctors
        const doctorPassword = yield (0, bcryptjs_1.hash)('doctor123', 10);
        const doctors = yield Promise.all([
            prisma.user.create({
                data: {
                    email: 'dr.smith@quanbyhealthcare.com',
                    password: doctorPassword,
                    role: client_1.Role.DOCTOR,
                    organizationId: organizations[0].id, // Quanby Healthcare Center
                    doctorInfo: {
                        create: {
                            firstName: 'John',
                            middleName: 'Alexander',
                            lastName: 'Smith',
                            gender: client_1.Sex.MALE,
                            dateOfBirth: new Date('1980-05-15'),
                            contactNumber: '+63-917-123-4567',
                            address: '123 Medical Center Dr, BGC, Taguig City, Metro Manila 1634',
                            bio: 'Experienced cardiologist with over 15 years of practice. Specializes in interventional cardiology, preventive care, and complex cardiac procedures. Graduated from UP College of Medicine and completed fellowship in Interventional Cardiology at Johns Hopkins Hospital.',
                            specialization: 'Interventional Cardiology',
                            qualifications: 'MD, FACC, FSCAI, Diplomate of Internal Medicine, Fellow in Interventional Cardiology',
                            experience: 15,
                            // Medical License Information
                            prcId: 'PRC-1234567',
                            ptrId: 'PTR-2024-001234',
                            medicalLicenseLevel: client_1.MedicalLicenseLevel.S3, // Subspecialist
                            philHealthAccreditation: client_1.PhilHealthAccreditation.ACCREDITED,
                            licenseNumber: 'MD-2024-001234',
                            licenseExpiry: new Date('2025-12-31'),
                            isLicenseActive: true,
                            licenseIssuedBy: 'Professional Regulation Commission',
                            licenseIssuedDate: new Date('2009-06-15'),
                            renewalRequired: true,
                            additionalCertifications: JSON.stringify([
                                'Board Certified in Internal Medicine',
                                'Fellow of the American College of Cardiology',
                                'Fellow of the Society for Cardiovascular Angiography and Interventions',
                                'Certified in Advanced Cardiac Life Support',
                                'Certified in Basic Life Support'
                            ]),
                        },
                    },
                    doctorCategories: {
                        connect: [{ id: categories[0].id }], // Cardiologist
                    },
                },
            }),
            prisma.user.create({
                data: {
                    email: 'dr.johnson@quanbyhealthcare.com',
                    password: doctorPassword,
                    role: client_1.Role.DOCTOR,
                    organizationId: organizations[0].id, // Quanby Healthcare Center
                    doctorInfo: {
                        create: {
                            firstName: 'Sarah',
                            middleName: 'Marie',
                            lastName: 'Johnson',
                            gender: client_1.Sex.FEMALE,
                            dateOfBirth: new Date('1985-08-22'),
                            contactNumber: '+63-917-234-5678',
                            address: '456 Dermatology Ave, Makati City, Metro Manila 1200',
                            bio: 'Board-certified dermatologist specializing in cosmetic dermatology, skin cancer prevention, and advanced laser treatments. Graduated from UST Faculty of Medicine and completed dermatology residency at St. Luke\'s Medical Center.',
                            specialization: 'Cosmetic Dermatology & Dermatopathology',
                            qualifications: 'MD, FAAD, Diplomate of Dermatology, Fellow in Cosmetic Dermatology',
                            experience: 12,
                            // Medical License Information
                            prcId: 'PRC-2345678',
                            ptrId: 'PTR-2024-002345',
                            medicalLicenseLevel: client_1.MedicalLicenseLevel.S2, // Specialist
                            philHealthAccreditation: client_1.PhilHealthAccreditation.ACCREDITED,
                            licenseNumber: 'MD-2024-002345',
                            licenseExpiry: new Date('2025-08-31'),
                            isLicenseActive: true,
                            licenseIssuedBy: 'Professional Regulation Commission',
                            licenseIssuedDate: new Date('2012-08-22'),
                            renewalRequired: true,
                            additionalCertifications: JSON.stringify([
                                'Board Certified in Dermatology',
                                'Fellow of the American Academy of Dermatology',
                                'Certified in Cosmetic Dermatology',
                                'Certified in Dermatopathology',
                                'Certified in Laser Surgery',
                                'Certified in Botox and Dermal Fillers'
                            ]),
                        },
                    },
                    doctorCategories: {
                        connect: [{ id: categories[1].id }], // Dermatologist
                    },
                },
            }),
            prisma.user.create({
                data: {
                    email: 'dr.williams@metrogeneral.com',
                    password: doctorPassword,
                    role: client_1.Role.DOCTOR,
                    organizationId: organizations[1].id, // Metro General Hospital
                    doctorInfo: {
                        create: {
                            firstName: 'Michael',
                            middleName: 'David',
                            lastName: 'Williams',
                            gender: client_1.Sex.MALE,
                            dateOfBirth: new Date('1978-12-10'),
                            contactNumber: '+63-917-345-6789',
                            address: '789 Neurology Blvd, Quezon City, Metro Manila 1100',
                            bio: 'Neurologist with expertise in stroke treatment, neurological disorders, and neurocritical care. Graduated from Ateneo School of Medicine and completed neurology fellowship at Massachusetts General Hospital.',
                            specialization: 'Stroke Neurology & Neurocritical Care',
                            qualifications: 'MD, PhD, FAAN, Diplomate of Neurology, Fellow in Stroke Neurology',
                            experience: 18,
                            // Medical License Information
                            prcId: 'PRC-3456789',
                            ptrId: 'PTR-2024-003456',
                            medicalLicenseLevel: client_1.MedicalLicenseLevel.S3, // Subspecialist
                            philHealthAccreditation: client_1.PhilHealthAccreditation.ACCREDITED,
                            licenseNumber: 'MD-2024-003456',
                            licenseExpiry: new Date('2025-06-30'),
                            isLicenseActive: true,
                            licenseIssuedBy: 'Professional Regulation Commission',
                            licenseIssuedDate: new Date('2006-12-10'),
                            renewalRequired: true,
                            additionalCertifications: JSON.stringify([
                                'Board Certified in Neurology',
                                'Fellow of the American Academy of Neurology',
                                'Certified in Stroke Neurology',
                                'Certified in Neurocritical Care',
                                'Certified in Electroencephalography',
                                'Certified in Electromyography'
                            ]),
                        },
                    },
                    doctorCategories: {
                        connect: [{ id: categories[2].id }], // Neurologist
                    },
                },
            }),
            // Add more doctors for better testing
            prisma.user.create({
                data: {
                    email: 'dr.garcia@quanbyhealthcare.com',
                    password: doctorPassword,
                    role: client_1.Role.DOCTOR,
                    organizationId: organizations[0].id, // Quanby Healthcare Center
                    doctorInfo: {
                        create: {
                            firstName: 'Maria',
                            middleName: 'Isabella',
                            lastName: 'Garcia',
                            gender: client_1.Sex.FEMALE,
                            dateOfBirth: new Date('1982-03-20'),
                            contactNumber: '+63-917-456-7890',
                            address: '321 Orthopedic St, Mandaluyong City, Metro Manila 1550',
                            bio: 'Orthopedic surgeon specializing in sports medicine and joint replacement surgery. Graduated from UERM College of Medicine and completed orthopedic surgery residency at Philippine General Hospital.',
                            specialization: 'Sports Medicine & Joint Replacement Surgery',
                            qualifications: 'MD, Diplomate of Orthopedic Surgery, Fellow in Sports Medicine',
                            experience: 14,
                            // Medical License Information
                            prcId: 'PRC-4567890',
                            ptrId: 'PTR-2024-004567',
                            medicalLicenseLevel: client_1.MedicalLicenseLevel.S2, // Specialist
                            philHealthAccreditation: client_1.PhilHealthAccreditation.ACCREDITED,
                            licenseNumber: 'MD-2024-004567',
                            licenseExpiry: new Date('2025-03-31'),
                            isLicenseActive: true,
                            licenseIssuedBy: 'Professional Regulation Commission',
                            licenseIssuedDate: new Date('2010-03-20'),
                            renewalRequired: true,
                            additionalCertifications: JSON.stringify([
                                'Board Certified in Orthopedic Surgery',
                                'Fellow in Sports Medicine',
                                'Certified in Arthroscopic Surgery',
                                'Certified in Joint Replacement Surgery',
                                'Certified in Sports Medicine',
                                'Team Physician for Philippine National Team'
                            ]),
                        },
                    },
                    doctorCategories: {
                        connect: [{ id: categories[3].id }], // Orthopedist
                    },
                },
            }),
            prisma.user.create({
                data: {
                    email: 'dr.rodriguez@metrogeneral.com',
                    password: doctorPassword,
                    role: client_1.Role.DOCTOR,
                    organizationId: organizations[1].id, // Metro General Hospital
                    doctorInfo: {
                        create: {
                            firstName: 'Carlos',
                            middleName: 'Miguel',
                            lastName: 'Rodriguez',
                            gender: client_1.Sex.MALE,
                            dateOfBirth: new Date('1987-11-05'),
                            contactNumber: '+63-917-567-8901',
                            address: '654 Pediatrics Ave, Pasig City, Metro Manila 1600',
                            bio: 'Pediatrician with specialization in pediatric cardiology and neonatology. Graduated from De La Salle University Medical Center and completed pediatric residency at Children\'s Hospital of Philadelphia.',
                            specialization: 'Pediatric Cardiology & Neonatology',
                            qualifications: 'MD, Diplomate of Pediatrics, Fellow in Pediatric Cardiology',
                            experience: 10,
                            // Medical License Information
                            prcId: 'PRC-5678901',
                            ptrId: 'PTR-2024-005678',
                            medicalLicenseLevel: client_1.MedicalLicenseLevel.S2, // Specialist
                            philHealthAccreditation: client_1.PhilHealthAccreditation.ACCREDITED,
                            licenseNumber: 'MD-2024-005678',
                            licenseExpiry: new Date('2025-11-30'),
                            isLicenseActive: true,
                            licenseIssuedBy: 'Professional Regulation Commission',
                            licenseIssuedDate: new Date('2014-11-05'),
                            renewalRequired: true,
                            additionalCertifications: JSON.stringify([
                                'Board Certified in Pediatrics',
                                'Fellow in Pediatric Cardiology',
                                'Certified in Neonatology',
                                'Certified in Pediatric Advanced Life Support',
                                'Certified in Neonatal Resuscitation Program',
                                'Certified in Pediatric Echocardiography'
                            ]),
                        },
                    },
                    doctorCategories: {
                        connect: [{ id: categories[4].id }], // Pediatrician
                    },
                },
            }),
        ]);
        console.log('👨‍⚕️ Created doctors');
        // Create Patients
        const patientPassword = yield (0, bcryptjs_1.hash)('patient123', 10);
        const patients = yield Promise.all([
            prisma.user.create({
                data: {
                    email: 'patient.anderson@email.com',
                    password: patientPassword,
                    role: client_1.Role.PATIENT,
                    // Patients don't belong to any organization
                    patientInfo: {
                        create: {
                            fullName: 'Emily Anderson',
                            gender: client_1.Sex.FEMALE,
                            dateOfBirth: new Date('1992-03-18'),
                            contactNumber: '+1-555-0201',
                            address: '321 Patient St, Health Town, HT 22222',
                            weight: 65.5,
                            height: 165.0,
                            bloodType: 'A+',
                            medicalHistory: 'No significant medical history',
                            allergies: 'Penicillin',
                            medications: 'None',
                            // PhilHealth Information
                            philHealthId: '12-345678901-2',
                            philHealthStatus: 'ACTIVE',
                            philHealthCategory: 'INDIVIDUAL',
                            philHealthExpiry: new Date('2025-12-31'),
                            philHealthMemberSince: new Date('2020-01-15'),
                            philHealthIdVerified: true,
                            philHealthIdVerifiedBy: admins[0].id,
                            philHealthIdVerifiedAt: new Date('2024-01-01'),
                        },
                    },
                },
            }),
            prisma.user.create({
                data: {
                    email: 'patient.brown@email.com',
                    password: patientPassword,
                    role: client_1.Role.PATIENT,
                    // Patients don't belong to any organization
                    patientInfo: {
                        create: {
                            fullName: 'David Brown',
                            gender: client_1.Sex.MALE,
                            dateOfBirth: new Date('1988-07-25'),
                            contactNumber: '+1-555-0202',
                            address: '654 Health Ave, Wellness City, WC 33333',
                            weight: 78.2,
                            height: 180.0,
                            bloodType: 'O+',
                            medicalHistory: 'Hypertension, Type 2 Diabetes',
                            allergies: 'None',
                            medications: 'Metformin, Lisinopril',
                            // PhilHealth Information
                            philHealthId: '23-456789012-3',
                            philHealthStatus: 'ACTIVE',
                            philHealthCategory: 'FAMILY',
                            philHealthExpiry: new Date('2025-06-30'),
                            philHealthMemberSince: new Date('2018-03-10'),
                            philHealthIdVerified: true,
                            philHealthIdVerifiedBy: admins[0].id,
                            philHealthIdVerifiedAt: new Date('2024-01-01'),
                        },
                    },
                },
            }),
            prisma.user.create({
                data: {
                    email: 'patient.garcia@email.com',
                    password: patientPassword,
                    role: client_1.Role.PATIENT,
                    // Patients don't belong to any organization
                    patientInfo: {
                        create: {
                            fullName: 'Maria Garcia',
                            gender: client_1.Sex.FEMALE,
                            dateOfBirth: new Date('1995-11-08'),
                            contactNumber: '+1-555-0203',
                            address: '987 Care Blvd, Medical City, MC 44444',
                            weight: 58.0,
                            height: 160.0,
                            bloodType: 'B-',
                            medicalHistory: 'Asthma',
                            allergies: 'Dust, Pollen',
                            medications: 'Albuterol inhaler',
                            // PhilHealth Information
                            philHealthId: '34-567890123-4',
                            philHealthStatus: 'ACTIVE',
                            philHealthCategory: 'SPONSORED',
                            philHealthExpiry: new Date('2025-09-15'),
                            philHealthMemberSince: new Date('2021-07-20'),
                            philHealthIdVerified: true,
                            philHealthIdVerifiedBy: admins[0].id,
                            philHealthIdVerifiedAt: new Date('2024-01-01'),
                        },
                    },
                },
            }),
        ]);
        console.log('👥 Created patients');
        // Create Emergency Contacts
        yield Promise.all([
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
        yield Promise.all([
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
        yield Promise.all(scheduleData.map(schedule => prisma.doctorSchedule.create({
            data: {
                doctorId: schedule.doctorId,
                dayOfWeek: schedule.dayOfWeek,
                startTime: new Date(`2024-01-01T${schedule.startTime}:00`),
                endTime: new Date(`2024-01-01T${schedule.endTime}:00`),
                isAvailable: true,
            },
        })));
        console.log('📅 Created doctor schedules');
        // Create Appointment Requests (upcoming dates for testing)
        const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const appointments = yield Promise.all([
            prisma.appointmentRequest.create({
                data: {
                    patientId: patients[0].id,
                    doctorId: doctors[0].id,
                    requestedDate: inDays(3),
                    requestedTime: '10:00',
                    reason: 'Chest pain follow-up',
                    status: client_1.AppointmentStatus.PENDING,
                    priority: client_1.Priority.NORMAL,
                    notes: 'Initial request'
                }
            }),
            prisma.appointmentRequest.create({
                data: {
                    patientId: patients[1].id,
                    doctorId: doctors[0].id,
                    requestedDate: inDays(5),
                    requestedTime: '11:30',
                    reason: 'EKG review',
                    status: client_1.AppointmentStatus.PENDING,
                    priority: client_1.Priority.HIGH
                }
            }),
            prisma.appointmentRequest.create({
                data: {
                    patientId: patients[2].id,
                    doctorId: doctors[1].id,
                    requestedDate: inDays(2),
                    requestedTime: '14:00',
                    reason: 'Skin rash evaluation',
                    status: client_1.AppointmentStatus.CONFIRMED,
                    priority: client_1.Priority.NORMAL
                }
            }),
            prisma.appointmentRequest.create({
                data: {
                    patientId: patients[0].id,
                    doctorId: doctors[2].id,
                    requestedDate: inDays(9),
                    requestedTime: '09:15',
                    reason: 'Migraine assessment',
                    status: client_1.AppointmentStatus.PENDING,
                    priority: client_1.Priority.LOW
                }
            })
        ]);
        console.log(`📨 Created appointment requests: ${appointments.length}`);
        // Create Consultations
        const consultations = yield Promise.all([
            prisma.consultation.create({
                data: {
                    doctorId: doctors[0].id,
                    patientId: patients[0].id,
                    startTime: new Date('2024-01-15T10:00:00Z'),
                    endTime: new Date('2024-01-15T10:30:00Z'),
                    consultationCode: 'QH1501ABC',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[1].id,
                    patientId: patients[1].id,
                    startTime: new Date('2024-01-16T14:00:00Z'),
                    endTime: new Date('2024-01-16T14:45:00Z'),
                    consultationCode: 'QH1602DEF',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[2].id,
                    patientId: patients[2].id,
                    startTime: new Date('2024-01-17T09:00:00Z'),
                    consultationCode: 'QH1703GHI',
                },
            }),
        ]);
        console.log('💬 Created consultations');
        // Create Health Scans
        const healthScans = yield Promise.all([
            // Healthy young adult (Emily Anderson)
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
            // Middle-aged with diabetes and hypertension (David Brown)
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
            // Young adult with asthma (Maria Garcia)
            prisma.healthScan.create({
                data: {
                    consultationId: consultations[2].id,
                    bloodPressure: '110/70',
                    heartRate: 68.0,
                    spO2: 97.0,
                    respiratoryRate: 16.0,
                    stressLevel: 1.8,
                    stressScore: 198.4,
                    hrvSdnn: 52.3,
                    hrvRmsdd: 48.7,
                    generalWellness: 82.1,
                    generalRisk: 2.1,
                    coronaryHeartDisease: 0.9,
                    congestiveHeartFailure: 0.1,
                    intermittentClaudication: 0.3,
                    strokeRisk: 0.8,
                    covidRisk: 1.5,
                    height: 160.0,
                    weight: 58.0,
                    smoker: false,
                    hypertension: false,
                    bpMedication: false,
                    diabetic: 0,
                    waistCircumference: 68.0,
                    heartDisease: false,
                    depression: false,
                    totalCholesterol: 165.0,
                    hdl: 58.0,
                    parentalHypertension: 0,
                    physicalActivity: true,
                    healthyDiet: true,
                    antiHypertensive: false,
                    historyBloodGlucose: false,
                    historyFamilyDiabetes: 0,
                },
            }),
        ]);
        // Create additional consultations for more health scans
        const additionalConsultations = yield Promise.all([
            prisma.consultation.create({
                data: {
                    doctorId: doctors[3].id, // Dr. Maria Garcia (Orthopedist)
                    patientId: patients[0].id, // Emily Anderson
                    startTime: new Date('2024-01-20T10:00:00Z'),
                    endTime: new Date('2024-01-20T10:30:00Z'),
                    consultationCode: 'QH2004JKL',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[4].id, // Dr. Carlos Rodriguez (Pediatrician)
                    patientId: patients[1].id, // David Brown
                    startTime: new Date('2024-01-22T14:00:00Z'),
                    endTime: new Date('2024-01-22T14:45:00Z'),
                    consultationCode: 'QH2205MNO',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[0].id, // Dr. John Smith (Cardiologist)
                    patientId: patients[2].id, // Maria Garcia
                    startTime: new Date('2024-01-25T09:00:00Z'),
                    endTime: new Date('2024-01-25T09:30:00Z'),
                    consultationCode: 'QH2506PQR',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[1].id, // Dr. Sarah Johnson (Dermatologist)
                    patientId: patients[0].id, // Emily Anderson
                    startTime: new Date('2024-01-28T11:00:00Z'),
                    endTime: new Date('2024-01-28T11:30:00Z'),
                    consultationCode: 'QH2807STU',
                },
            }),
            prisma.consultation.create({
                data: {
                    doctorId: doctors[2].id, // Dr. Michael Williams (Neurologist)
                    patientId: patients[1].id, // David Brown
                    startTime: new Date('2024-01-30T15:00:00Z'),
                    endTime: new Date('2024-01-30T15:45:00Z'),
                    consultationCode: 'QH3008VWX',
                },
            }),
        ]);
        // Create additional health scans with varied health profiles
        const additionalHealthScans = yield Promise.all([
            // High-risk patient with multiple conditions
            prisma.healthScan.create({
                data: {
                    consultationId: additionalConsultations[0].id,
                    bloodPressure: '150/95',
                    heartRate: 85.0,
                    spO2: 94.0,
                    respiratoryRate: 18.0,
                    stressLevel: 4.2,
                    stressScore: 385.7,
                    hrvSdnn: 32.1,
                    hrvRmsdd: 29.8,
                    generalWellness: 45.8,
                    generalRisk: 12.3,
                    coronaryHeartDisease: 8.7,
                    congestiveHeartFailure: 2.1,
                    intermittentClaudication: 3.4,
                    strokeRisk: 5.6,
                    covidRisk: 4.8,
                    height: 175.0,
                    weight: 95.0,
                    smoker: true,
                    hypertension: true,
                    bpMedication: true,
                    diabetic: 2,
                    waistCircumference: 102.0,
                    heartDisease: true,
                    depression: true,
                    totalCholesterol: 280.0,
                    hdl: 35.0,
                    parentalHypertension: 2,
                    physicalActivity: false,
                    healthyDiet: false,
                    antiHypertensive: true,
                    historyBloodGlucose: true,
                    historyFamilyDiabetes: 2,
                },
            }),
            // Elderly patient with age-related conditions
            prisma.healthScan.create({
                data: {
                    consultationId: additionalConsultations[1].id,
                    bloodPressure: '140/90',
                    heartRate: 82.0,
                    spO2: 95.0,
                    respiratoryRate: 15.0,
                    stressLevel: 3.8,
                    stressScore: 345.2,
                    hrvSdnn: 28.9,
                    hrvRmsdd: 26.4,
                    generalWellness: 58.7,
                    generalRisk: 9.2,
                    coronaryHeartDisease: 6.3,
                    congestiveHeartFailure: 1.8,
                    intermittentClaudication: 2.7,
                    strokeRisk: 4.1,
                    covidRisk: 3.9,
                    height: 170.0,
                    weight: 85.0,
                    smoker: false,
                    hypertension: true,
                    bpMedication: true,
                    diabetic: 1,
                    waistCircumference: 92.0,
                    heartDisease: false,
                    depression: false,
                    totalCholesterol: 240.0,
                    hdl: 42.0,
                    parentalHypertension: 1,
                    physicalActivity: true,
                    healthyDiet: true,
                    antiHypertensive: true,
                    historyBloodGlucose: true,
                    historyFamilyDiabetes: 1,
                },
            }),
            // Athlete with excellent health metrics
            prisma.healthScan.create({
                data: {
                    consultationId: additionalConsultations[2].id,
                    bloodPressure: '105/65',
                    heartRate: 58.0,
                    spO2: 99.0,
                    respiratoryRate: 10.0,
                    stressLevel: 1.2,
                    stressScore: 156.3,
                    hrvSdnn: 68.4,
                    hrvRmsdd: 62.1,
                    generalWellness: 92.8,
                    generalRisk: 0.8,
                    coronaryHeartDisease: 0.3,
                    congestiveHeartFailure: 0.05,
                    intermittentClaudication: 0.1,
                    strokeRisk: 0.4,
                    covidRisk: 0.9,
                    height: 168.0,
                    weight: 62.0,
                    smoker: false,
                    hypertension: false,
                    bpMedication: false,
                    diabetic: 0,
                    waistCircumference: 70.0,
                    heartDisease: false,
                    depression: false,
                    totalCholesterol: 155.0,
                    hdl: 65.0,
                    parentalHypertension: 0,
                    physicalActivity: true,
                    healthyDiet: true,
                    antiHypertensive: false,
                    historyBloodGlucose: false,
                    historyFamilyDiabetes: 0,
                },
            }),
            // Patient with mental health concerns
            prisma.healthScan.create({
                data: {
                    consultationId: additionalConsultations[3].id,
                    bloodPressure: '125/80',
                    heartRate: 88.0,
                    spO2: 96.5,
                    respiratoryRate: 17.0,
                    stressLevel: 5.1,
                    stressScore: 425.8,
                    hrvSdnn: 25.6,
                    hrvRmsdd: 22.3,
                    generalWellness: 42.3,
                    generalRisk: 7.6,
                    coronaryHeartDisease: 3.8,
                    congestiveHeartFailure: 0.9,
                    intermittentClaudication: 1.5,
                    strokeRisk: 2.9,
                    covidRisk: 3.2,
                    height: 162.0,
                    weight: 70.0,
                    smoker: true,
                    hypertension: false,
                    bpMedication: false,
                    diabetic: 0,
                    waistCircumference: 78.0,
                    heartDisease: false,
                    depression: true,
                    totalCholesterol: 195.0,
                    hdl: 48.0,
                    parentalHypertension: 0,
                    physicalActivity: false,
                    healthyDiet: false,
                    antiHypertensive: false,
                    historyBloodGlucose: false,
                    historyFamilyDiabetes: 0,
                },
            }),
            // Patient with metabolic syndrome
            prisma.healthScan.create({
                data: {
                    consultationId: additionalConsultations[4].id,
                    bloodPressure: '145/92',
                    heartRate: 90.0,
                    spO2: 93.0,
                    respiratoryRate: 19.0,
                    stressLevel: 4.7,
                    stressScore: 398.2,
                    hrvSdnn: 29.8,
                    hrvRmsdd: 27.1,
                    generalWellness: 38.9,
                    generalRisk: 14.7,
                    coronaryHeartDisease: 11.2,
                    congestiveHeartFailure: 3.4,
                    intermittentClaudication: 4.8,
                    strokeRisk: 7.3,
                    covidRisk: 5.6,
                    height: 178.0,
                    weight: 110.0,
                    smoker: false,
                    hypertension: true,
                    bpMedication: true,
                    diabetic: 2,
                    waistCircumference: 108.0,
                    heartDisease: false,
                    depression: false,
                    totalCholesterol: 320.0,
                    hdl: 28.0,
                    parentalHypertension: 2,
                    physicalActivity: false,
                    healthyDiet: false,
                    antiHypertensive: true,
                    historyBloodGlucose: true,
                    historyFamilyDiabetes: 2,
                },
            }),
        ]);
        console.log('🔬 Created health scans');
        console.log('✅ Database seeding completed successfully!');
        console.log('\n📊 Summary of created data:');
        console.log(`   - Organizations: ${organizations.length}`);
        console.log(`   - Super admin users: 1`);
        console.log(`   - Admin users: ${admins.length}`);
        console.log(`   - Doctor categories: ${categories.length}`);
        console.log(`   - Doctors: ${doctors.length}`);
        console.log(`   - Patients: ${patients.length}`);
        console.log(`   - Emergency contacts: 3`);
        console.log(`   - Insurance info: 3`);
        console.log(`   - Doctor schedules: ${scheduleData.length}`);
        console.log(`   - Consultations: ${consultations.length + additionalConsultations.length}`);
        console.log(`   - Health scans: ${healthScans.length + additionalHealthScans.length}`);
        console.log('\n🔐 Login Credentials:');
        console.log(`   - Super Admin: superadmin@qhealth.com / superadmin123`);
        console.log(`   - Admin (Quanby): admin@quanbyhealthcare.com / admin123`);
        console.log(`   - Admin (Metro): admin@metrogeneral.com / admin123`);
        console.log(`   - Doctors: dr.smith@quanbyhealthcare.com, dr.johnson@quanbyhealthcare.com, dr.williams@metrogeneral.com, dr.garcia@quanbyhealthcare.com, dr.rodriguez@metrogeneral.com / doctor123`);
        console.log(`   - Patients: patient.anderson@email.com, patient.brown@email.com, patient.garcia@email.com / patient123`);
        console.log('\n📋 Doctor Specializations:');
        console.log(`   - Dr. John Smith: Interventional Cardiology (S3 - Subspecialist)`);
        console.log(`   - Dr. Sarah Johnson: Cosmetic Dermatology (S2 - Specialist)`);
        console.log(`   - Dr. Michael Williams: Stroke Neurology (S3 - Subspecialist)`);
        console.log(`   - Dr. Maria Garcia: Sports Medicine & Orthopedics (S2 - Specialist)`);
        console.log(`   - Dr. Carlos Rodriguez: Pediatric Cardiology (S2 - Specialist)`);
    });
}
main()
    .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
