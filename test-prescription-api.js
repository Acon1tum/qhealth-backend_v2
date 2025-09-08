const axios = require('axios');

// Test prescription API endpoints
const BASE_URL = 'http://localhost:3000/api';

// Mock JWT token (you'll need to replace this with a real token from login)
const MOCK_TOKEN = 'your-jwt-token-here';

const headers = {
  'Authorization': `Bearer ${MOCK_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testPrescriptionAPI() {
  console.log('🧪 Testing Prescription API Endpoints...\n');

  try {
    // Test 1: Create Prescription
    console.log('1️⃣ Testing CREATE prescription...');
    const createData = {
      patientId: 1,
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '7 days',
      instructions: 'Take with food',
      quantity: 14,
      refills: 0,
      notes: 'Test prescription'
    };

    const createResponse = await axios.post(`${BASE_URL}/prescriptions/create`, createData, { headers });
    console.log('✅ Create prescription:', createResponse.data);
    const prescriptionId = createResponse.data.data?.id;

    if (prescriptionId) {
      // Test 2: Get Prescription by ID
      console.log('\n2️⃣ Testing GET prescription by ID...');
      const getResponse = await axios.get(`${BASE_URL}/prescriptions/${prescriptionId}`, { headers });
      console.log('✅ Get prescription:', getResponse.data);

      // Test 3: Update Prescription
      console.log('\n3️⃣ Testing UPDATE prescription...');
      const updateData = {
        notes: 'Updated test prescription notes'
      };
      const updateResponse = await axios.put(`${BASE_URL}/prescriptions/${prescriptionId}`, updateData, { headers });
      console.log('✅ Update prescription:', updateResponse.data);

      // Test 4: Get Patient Prescriptions
      console.log('\n4️⃣ Testing GET patient prescriptions...');
      const patientResponse = await axios.get(`${BASE_URL}/prescriptions/patient/1`, { headers });
      console.log('✅ Patient prescriptions:', patientResponse.data);

      // Test 5: Delete Prescription
      console.log('\n5️⃣ Testing DELETE prescription...');
      const deleteResponse = await axios.delete(`${BASE_URL}/prescriptions/${prescriptionId}`, { headers });
      console.log('✅ Delete prescription:', deleteResponse.data);
    }

    console.log('\n🎉 All prescription API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Note: You need to login first to get a valid JWT token.');
      console.log('   Run: node test-api.js (auth test) to get a token.');
    }
  }
}

// Test authentication first
async function testAuth() {
  console.log('🔐 Testing authentication...');
  
  try {
    const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'doctor@example.com', // Replace with actual doctor credentials
      password: 'password123'      // Replace with actual password
    });

    if (authResponse.data.success) {
      console.log('✅ Authentication successful');
      console.log('🔑 Token:', authResponse.data.data.token);
      
      // Update headers with real token
      headers.Authorization = `Bearer ${authResponse.data.data.token}`;
      
      // Run prescription tests
      await testPrescriptionAPI();
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    console.log('\n💡 Please check your database has the test user credentials.');
  }
}

// Run tests
if (require.main === module) {
  testAuth();
}

module.exports = { testPrescriptionAPI, testAuth };
