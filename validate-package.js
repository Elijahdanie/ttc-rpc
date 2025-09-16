#!/usr/bin/env node

// Simple validation script to test the built package
const packageJson = require('./package.json');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating ttc-rpc package...');

// Check if all required files exist
const requiredFiles = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/socket.js',
  'dist/socket.d.ts',
  'dist/rpc-info.js',
  'dist/rpc-info.d.ts',
  'dist/rpc.decorator.js',
  'dist/rpc.decorator.d.ts',
  'dist/server.js',
  'dist/server.d.ts',
  'README.md'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    console.error(`❌ Missing required file: ${file}`);
    allFilesExist = false;
  } else {
    console.log(`✅ Found: ${file}`);
  }
});

// Test importing the main module
try {
  const ttcRpc = require('./dist/index.js');
  console.log('Available exports:', Object.keys(ttcRpc));
  
  if (ttcRpc.ttc && (typeof ttcRpc.ttc === 'object' || typeof ttcRpc.ttc === 'function') && typeof ttcRpc.ttc.describe === 'function') {
    console.log('✅ Main module imports correctly');
    console.log('✅ ttc.describe is available');
  } else {
    console.error('❌ Main module structure is incorrect');
    console.error('ttc:', typeof ttcRpc.ttc);
    if (ttcRpc.ttc) {
      console.error('ttc.describe:', typeof ttcRpc.ttc.describe);
    }
    allFilesExist = false;
  }
} catch (error) {
  console.error('❌ Failed to import main module:', error.message);
  allFilesExist = false;
}

// Check package.json configuration
const requiredFields = ['name', 'version', 'main', 'types', 'files'];
requiredFields.forEach(field => {
  if (packageJson[field]) {
    console.log(`✅ package.json has ${field}: ${JSON.stringify(packageJson[field])}`);
  } else {
    console.error(`❌ Missing required package.json field: ${field}`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('🎉 Package validation successful! Ready for publishing.');
  process.exit(0);
} else {
  console.log('❌ Package validation failed. Please fix the issues above.');
  process.exit(1);
}
