import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

const AuthPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cookiesConsent, setCookiesConsent] = useState(false);
  const [needsCookieConsent, setNeedsCookieConsent] = useState(true);
  const [checkingConsent, setCheckingConsent] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkCookieConsent = async (userEmail: string) => {
    if (!userEmail) return;
    
    setCheckingConsent(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('cookies_consent')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('Error checking cookie consent:', error);
        setNeedsCookieConsent(true);
        return;
      }

      if (data?.cookies_consent === true) {
        setNeedsCookieConsent(false);
        setCookiesConsent(true);
      } else {
        setNeedsCookieConsent(true);
        setCookiesConsent(false);
      }
    } catch (error) {
      console.error('Error checking cookie consent:', error);
      setNeedsCookieConsent(true);
    } finally {
      setCheckingConsent(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Ошибка входа: неверный Email или Пароль');
        } else {
          toast.error('Ошибка входа: ' + error.message);
        }
        return;
      }

      if (data.session) {
        if (needsCookieConsent && cookiesConsent) {
          await supabase
            .from('users')
            .update({
              cookies_consent: true,
              cookies_consent_at: new Date().toISOString()
            })
            .eq('id', data.session.user.id);
        }

        toast.success('Вход выполнен успешно');
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  const canLogin = !needsCookieConsent || cookiesConsent;

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-gradient">
      <Card className="w-full max-w-md mx-4 shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-foreground">Вход в систему</CardTitle>
          <CardDescription className="text-muted-foreground">
            Введите ваш email и пароль для входа
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => checkCookieConsent(email)}
                placeholder="email@example.com"
                required
                autoComplete="email"
                className="bg-surface border-border focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="bg-surface border-border focus:border-primary focus:ring-primary"
              />
            </div>

            {needsCookieConsent && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Мы используем cookie-файлы для обеспечения работы сайта и улучшения 
                  пользовательского опыта. Продолжая использовать сайт, вы соглашаетесь 
                  с использованием cookie-файлов.
                </p>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="cookies"
                    checked={cookiesConsent}
                    onCheckedChange={(checked) => setCookiesConsent(checked === true)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="cookies"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                    >
                      Я принимаю{' '}
                      <a
                        href="http://milu.raketa.im/cookies-policy.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-teal hover:underline inline-flex items-center gap-1"
                      >
                        политику использования cookie
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !canLogin || checkingConsent}
            >
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
