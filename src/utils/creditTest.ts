import { validateCreditUpdate, formatCreditAmount, getCreditStatusMessage, getCreditsColorClass } from './creditUtils';

export const testCreditSystem = () => {
  console.log('🧪 Testing Credit System...');
  
  // Test 1: Credit validation
  console.log('\n📋 Test 1: Credit Validation');
  
  // Valid credit update
  const validResult = validateCreditUpdate(25, 10);
  console.log('✅ Valid credit update:', validResult);
  
  // Invalid credit (negative)
  const negativeResult = validateCreditUpdate(-5, 10);
  console.log('❌ Negative credit test:', negativeResult);
  
  // Invalid credit (NaN)
  const nanResult = validateCreditUpdate(NaN, 10);
  console.log('❌ NaN credit test:', nanResult);
  
  // Large credit jump (should log warning)
  const largeJumpResult = validateCreditUpdate(2000, 10);
  console.log('⚠️ Large jump test:', largeJumpResult);
  
  // Test 2: Credit formatting
  console.log('\n📋 Test 2: Credit Formatting');
  
  console.log('1 credit:', formatCreditAmount(1));
  console.log('10 credits:', formatCreditAmount(10));
  console.log('1000 credits:', formatCreditAmount(1000));
  
  // Test 3: Status messages
  console.log('\n📋 Test 3: Status Messages');
  
  console.log('0 credits:', getCreditStatusMessage(0, 'starter'));
  console.log('3 credits:', getCreditStatusMessage(3, 'starter'));
  console.log('10 credits:', getCreditStatusMessage(10, 'starter'));
  console.log('50 credits:', getCreditStatusMessage(50, 'pro'));
  
  // Test 4: Color classes
  console.log('\n📋 Test 4: Color Classes');
  
  console.log('0 credits color:', getCreditsColorClass(0));
  console.log('3 credits color:', getCreditsColorClass(3));
  console.log('10 credits color:', getCreditsColorClass(10));
  console.log('50 credits color:', getCreditsColorClass(50));
  
  console.log('\n✅ Credit system tests completed!');
  
  return {
    validationTests: {
      valid: validResult.isValid,
      negative: !negativeResult.isValid,
      nan: !nanResult.isValid,
      largeJump: largeJumpResult.isValid
    },
    formattingTests: {
      single: formatCreditAmount(1) === '1 credit',
      multiple: formatCreditAmount(10) === '10 credits',
      thousands: formatCreditAmount(1000) === '1,000 credits'
    },
    colorTests: {
      zero: getCreditsColorClass(0) === 'text-red-500',
      low: getCreditsColorClass(3) === 'text-orange-500',
      medium: getCreditsColorClass(10) === 'text-yellow-500',
      high: getCreditsColorClass(50) === 'text-green-500'
    }
  };
};

// Test credit sync simulation
export const simulateCreditSync = async (delay: number = 2000) => {
  console.log(`🔄 Simulating credit sync in ${delay}ms...`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ Credit sync simulated successfully');
      resolve({
        credits: Math.floor(Math.random() * 100) + 1,
        plan: 'starter',
        status: 'active'
      });
    }, delay);
  });
};

// Test real-time updates
export const testRealTimeUpdates = () => {
  console.log('🔄 Testing real-time credit updates...');
  
  let credits = 10;
  
  // Simulate credit consumption
  const interval = setInterval(() => {
    credits -= 1;
    console.log(`💸 Credit consumed: ${credits} remaining`);
    
    // Dispatch custom event to simulate real-time update
    window.dispatchEvent(new CustomEvent('creditUpdate', {
      detail: {
        credits,
        plan: 'starter',
        status: 'active'
      }
    }));
    
    if (credits <= 0) {
      clearInterval(interval);
      console.log('🚫 Credits depleted!');
    }
  }, 1000);
  
  return () => clearInterval(interval);
};

// Export test runner
export const runCreditTests = () => {
  const results = testCreditSystem();
  const stopRealTimeTest = testRealTimeUpdates();
  
  console.log('\n📊 Test Results:', results);
  
  // Stop real-time test after 10 seconds
  setTimeout(() => {
    stopRealTimeTest();
    console.log('⏹️ Real-time test stopped');
  }, 10000);
  
  return results;
};

// Auto-run tests in development
if (import.meta.env.DEV) {
  console.log('🧪 Development mode detected - Credit tests available');
  console.log('Run `runCreditTests()` in console to test credit system');
}
