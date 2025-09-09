// Environment and setup diagnostic script
const fs = require('fs');
const path = require('path');

console.log('🔍 QHealth Backend Environment Diagnostic');
console.log('==========================================\n');

// Check 1: Environment file
console.log('1️⃣ Checking environment configuration...');
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasDatabaseUrl = envContent.includes('DATABASE_URL');
  const hasJwtSecret = envContent.includes('JWT_SECRET');
  
  console.log('   - DATABASE_URL configured:', hasDatabaseUrl ? '✅' : '❌');
  console.log('   - JWT_SECRET configured:', hasJwtSecret ? '✅' : '❌');
} else {
  console.log('❌ .env file does not exist');
  if (fs.existsSync(envExamplePath)) {
    console.log('✅ .env.example file exists - you can copy it to .env');
  } else {
    console.log('❌ .env.example file does not exist either');
  }
}

// Check 2: Node modules
console.log('\n2️⃣ Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules exists');
} else {
  console.log('❌ node_modules does not exist - run npm install');
}

// Check 3: Prisma client
console.log('\n3️⃣ Checking Prisma setup...');
const prismaClientPath = path.join(__dirname, 'node_modules', '@prisma', 'client');
if (fs.existsSync(prismaClientPath)) {
  console.log('✅ Prisma client exists');
} else {
  console.log('❌ Prisma client does not exist - run npx prisma generate');
}

// Check 4: Database migrations
console.log('\n4️⃣ Checking database migrations...');
const migrationsPath = path.join(__dirname, 'prisma', 'migrations');
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath);
  console.log('✅ Migrations directory exists');
  console.log('   - Migration files:', migrations.length);
} else {
  console.log('❌ Migrations directory does not exist');
}

// Check 5: Package.json scripts
console.log('\n5️⃣ Checking package.json scripts...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  
  console.log('✅ package.json exists');
  console.log('   - dev script:', scripts.dev ? '✅' : '❌');
  console.log('   - db:generate script:', scripts['db:generate'] ? '✅' : '❌');
  console.log('   - db:push script:', scripts['db:push'] ? '✅' : '❌');
} else {
  console.log('❌ package.json does not exist');
}

console.log('\n📋 Setup Instructions:');
console.log('=====================');
console.log('1. Create .env file with database configuration:');
console.log('   DATABASE_URL="postgresql://username:password@localhost:5432/qhealth_v2"');
console.log('   JWT_SECRET="your-secret-key"');
console.log('   JWT_REFRESH_SECRET="your-refresh-secret-key"');
console.log('   PORT=3000');
console.log('   NODE_ENV="development"');
console.log('');
console.log('2. Install dependencies:');
console.log('   npm install');
console.log('');
console.log('3. Generate Prisma client:');
console.log('   npx prisma generate');
console.log('');
console.log('4. Push database schema:');
console.log('   npx prisma db push');
console.log('');
console.log('5. Seed database (optional):');
console.log('   npm run db:seed');
console.log('');
console.log('6. Start the server:');
console.log('   npm run dev');
