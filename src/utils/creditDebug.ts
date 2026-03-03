import { getSubscriptionStatus, syncCreditsFromStripe, getCredits } from '@/lib/api';
import { toast } from 'sonner';

export const debugCredits = async (token: string | null) => {
  console.log('🔍 Debugging Credit System...');
  
  try {
    // 1. Check current credits
    console.log('1. Checking current credits...');
    const currentCredits = await getCredits(token);
    console.log('Current credits:', currentCredits);
    
    // 2. Check subscription status
    console.log('2. Checking subscription status...');
    const subscriptionStatus = await getSubscriptionStatus(token);
    console.log('Subscription status:', subscriptionStatus);
    
    // 3. Sync credits from Stripe
    console.log('3. Syncing credits from Stripe...');
    const syncResult = await syncCreditsFromStripe(token);
    console.log('Sync result:', syncResult);
    
    // 4. Check credits after sync
    console.log('4. Checking credits after sync...');
    const creditsAfterSync = await getCredits(token);
    console.log('Credits after sync:', creditsAfterSync);
    
    // Summary
    const debugInfo = {
      currentCredits: currentCredits.credits,
      subscriptionPlan: subscriptionStatus.plan,
      subscriptionStatus: subscriptionStatus.status,
      subscriptionCredits: subscriptionStatus.credits,
      syncPlan: syncResult.plan,
      syncCredits: syncResult.credits,
      syncStatus: syncResult.status,
      creditsAfterSync: creditsAfterSync.credits,
      expectedCredits: subscriptionStatus.plan === 'pro' ? 40 : 
                       subscriptionStatus.plan === 'popular' ? 25 : 
                       subscriptionStatus.plan === 'starter' ? 10 : 0
    };
    
    console.log('📊 Debug Summary:', debugInfo);
    
    // Check for issues
    const issues = [];
    
    if (subscriptionStatus.status === 'active' && subscriptionStatus.credits === 0) {
      issues.push('Subscription is active but no credits allocated');
    }
    
    if (syncResult.plan !== subscriptionStatus.plan) {
      issues.push(`Plan mismatch: Subscription shows ${subscriptionStatus.plan}, Sync shows ${syncResult.plan}`);
    }
    
    if (debugInfo.creditsAfterSync < debugInfo.expectedCredits) {
      issues.push(`Credits below expected: Have ${debugInfo.creditsAfterSync}, should have ${debugInfo.expectedCredits}`);
    }
    
    if (issues.length > 0) {
      console.error('❌ Issues found:', issues);
      toast.error(`Credit issues detected: ${issues.join(', ')}`);
    } else {
      console.log('✅ No issues found');
      toast.success('Credit system working correctly');
    }
    
    return debugInfo;
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    toast.error('Failed to debug credits');
    throw error;
  }
};

export const forceCreditRefresh = async (token: string | null) => {
  console.log('🔄 Forcing credit refresh...');
  
  try {
    // Multiple sync attempts to ensure credits are updated
    for (let i = 0; i < 3; i++) {
      console.log(`Sync attempt ${i + 1}...`);
      await syncCreditsFromStripe(token);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    const finalCredits = await getCredits(token);
    console.log('Final credits after refresh:', finalCredits);
    
    toast.success(`Credits refreshed: ${finalCredits.credits} credits`);
    return finalCredits;
    
  } catch (error) {
    console.error('❌ Force refresh failed:', error);
    toast.error('Failed to force refresh credits');
    throw error;
  }
};

// Add this to window for easy debugging in console
declare global {
  interface Window {
    debugCredits: (token: string | null) => Promise<any>;
    forceCreditRefresh: (token: string | null) => Promise<any>;
  }
}

export const setupCreditDebug = (token: string | null) => {
  window.debugCredits = () => debugCredits(token);
  window.forceCreditRefresh = () => forceCreditRefresh(token);
  
  console.log('🔧 Credit debug tools available!');
  console.log('Run debugCredits() to debug credit issues');
  console.log('Run forceCreditRefresh() to force refresh credits');
};
