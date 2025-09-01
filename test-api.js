// Simple API test script for QHealth Backend
// Run with: node test-api.js

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testData = {
  patient: {
    email: 'patient@test.com',
    password: 'password123',
    role: 'PATIENT'
  },
  doctor: {
    email: 'doctor@test.com',
    password: 'password123',
    role: 'DOCTOR'
  }
};

// Simple HTTP request function
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    console.log(`\n${options.method || 'GET'} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error.message);
    return { status: 'ERROR', data: { error: error.message } };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  await makeRequest('/health');
}

async function testAuthEndpoints() {
  console.log('\n🔐 Testing Authentication Endpoints...');
  
  // Test registration (this would normally fail without proper setup)
  await makeRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(testData.patient)
  });
}

async function testAppointmentEndpoints() {
  console.log('\n📅 Testing Appointment Endpoints...');
  
  // Test getting appointments (will fail without auth)
  await makeRequest('/appointments/my-appointments');
}

async function testMedicalRecordsEndpoints() {
  console.log('\n📋 Testing Medical Records Endpoints...');
  
  // Test getting medical records (will fail without auth)
  await makeRequest('/medical-records/patient/1');
}

async function testConsultationEndpoints() {
  console.log('\n👨‍⚕️ Testing Consultation Endpoints...');
  
  // Test getting consultation (will fail without auth)
  await makeRequest('/consultations/1');
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting QHealth Backend API Tests...');
  console.log(`📍 Testing against: ${BASE_URL}`);
  
  try {
    await testHealthCheck();
    await testAuthEndpoints();
    await testAppointmentEndpoints();
    await testMedicalRecordsEndpoints();
    await testConsultationEndpoints();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Note: Most endpoints will return 401/403 errors without proper authentication.');
    console.log('   This is expected behavior and indicates the security is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, makeRequest };

