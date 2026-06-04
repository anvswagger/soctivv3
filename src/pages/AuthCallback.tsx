import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function getOAuthErrorDescription(url: URL): string {
  const params = new URLSearchParams(url.search);

  if (url.hash.startsWith('#')) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return params.get('error_description') || params.get('error') || '';
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const finishOAuthSignIn = async () => {
      const url = new URL(window.location.href);
      const errorDescription = getOAuthErrorDescription(url);

      if (errorDescription) {
        toast({
          title: 'فشل تسجيل الدخول مع جوجل',
          description: 'حاول تسجيل الدخول مرة أخرى.',
          variant: 'destructive',
        });
        if (active) navigate('/auth?mode=login', { replace: true });
        return;
      }

      const code = url.searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[AuthCallback] Failed to exchange code for session:', error);
          toast({
            title: 'فشل تسجيل الدخول مع جوجل',
            description: 'حاول تسجيل الدخول مرة أخرى.',
            variant: 'destructive',
          });
          if (active) navigate('/auth?mode=login', { replace: true });
          return;
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (active) navigate('/auth?mode=login', { replace: true });
          return;
        }
      }

      if (active) navigate('/dashboard', { replace: true });
    };

    void finishOAuthSignIn();

    return () => {
      active = false;
    };
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
