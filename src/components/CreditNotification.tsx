import { useEffect, useState } from 'react';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from 'sonner';
import { formatCreditAmount } from '@/utils/creditUtils';

interface CreditNotificationProps {
  enabled?: boolean;
}

export const CreditNotification: React.FC<CreditNotificationProps> = ({ enabled = true }) => {
  const { credits } = useCredits();
  const [previousCredits, setPreviousCredits] = useState<number>(credits);
  const [hasNotified, setHasNotified] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    // Check for credit changes
    if (credits !== previousCredits) {
      const difference = credits - previousCredits;
      
      // Only show notification if there's a significant change
      if (Math.abs(difference) >= 1) {
        if (difference > 0) {
          // Credits increased
          toast.success(`🎉 Credits added! You now have ${formatCreditAmount(credits)}.`, {
            duration: 4000,
            icon: '⚡',
          });
        } else if (difference < 0) {
          // Credits decreased
          toast.info(`Credits used: ${formatCreditAmount(Math.abs(difference))}`, {
            duration: 3000,
            icon: '💸',
          });
        }
        
        setPreviousCredits(credits);
      }
    }

    // Low credit warning
    if (credits <= 5 && credits > 0 && !hasNotified) {
      toast.warning(`⚠️ Low credits! Only ${formatCreditAmount(credits)} remaining.`, {
        duration: 5000,
        action: {
          label: 'Buy More',
          onClick: () => {
            window.location.href = '/pricing';
          },
        },
      });
      setHasNotified(true);
    } else if (credits > 5) {
      setHasNotified(false);
    }

    // No credits notification
    if (credits === 0 && previousCredits > 0) {
      toast.error(`🚫 No credits remaining! Please purchase more to continue generating images.`, {
        duration: 6000,
        action: {
          label: 'Buy Credits',
          onClick: () => {
            window.location.href = '/pricing';
          },
        },
      });
    }
  }, [credits, previousCredits, enabled, hasNotified]);

  // This component doesn't render anything visible
  return null;
};

export default CreditNotification;
