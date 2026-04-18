import { useState, useCallback } from 'react';
import { Confetti } from '@/components/ui/Confetti';

export function useConfetti() {
  const [show, setShow] = useState(false);
  
  const fire = useCallback(() => {
    setShow(true);
  }, []);
  
  const ConfettiComponent = useCallback(() => (
    <Confetti active={show} onComplete={() => setShow(false)} />
  ), [show]);
  
  return { fire, Confetti: ConfettiComponent };
}
