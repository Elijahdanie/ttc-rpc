import { ttc, generateRPCMethodsInfo, generateRPCMethodsList, generateFullAPIDocumentation } from './index';
import { UserService } from './test-service';
import express from 'express';

// Initialize the RPC system with the test service
const app = express();

ttc.init({
  app,
  modules: [UserService],
  generate_client: false, // Don't generate client for this test
  authCb: (token) => Promise.resolve({ userId: 'test' }),
  middleware: "default",
});

console.log('🔍 Testing RPC Info Generation...\n');

// Test 1: Generate methods info by service
console.log('📋 Methods by Service:');
const servicesMethods = generateRPCMethodsInfo();
console.log(JSON.stringify(servicesMethods, null, 2));

console.log('\n' + '='.repeat(80) + '\n');

// Test 2: Generate flat methods list
console.log('📝 Flat Methods List:');
const methodsList = generateRPCMethodsList();
console.log(JSON.stringify(methodsList, null, 2));

console.log('\n' + '='.repeat(80) + '\n');

// Test 3: Generate full API documentation
console.log('📚 Full API Documentation:');
const fullDoc = generateFullAPIDocumentation();
console.log(JSON.stringify(fullDoc, null, 2));

console.log('\n✅ RPC Info Generation test completed!');
