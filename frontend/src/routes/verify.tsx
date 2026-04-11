import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button, Card } from 'antd';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { verifyVerifyMutation } from '@/client/@tanstack/react-query.gen';

export const Route = createFileRoute('/verify')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || undefined,
    };
  },
  component: VerifyComponent,
});

function VerifyComponent() {
  const { token } = Route.useSearch();
  const verifyMutation = useMutation(verifyVerifyMutation());
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(
        {
          body: { token },
        },
        {
          onSuccess: () => {
            setStatus('success');
          },
          onError: () => {
            setStatus('error');
          },
        },
      );
    } else {
      setStatus('error');
    }
  }, [token]);

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-sky-100 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px] opacity-60" />

      <Card
        className="w-full max-w-[480px] rounded-3xl border-none shadow-2xl relative z-10"
        bodyStyle={{ padding: '48px 40px' }}
      >
        <div className="flex flex-col items-center text-center">
          {status === 'loading' && (
            <div className="py-8 animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-sky-50 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] mb-3">
                Verifying Account
              </h2>
              <p className="text-slate-500 text-lg">
                Please wait while we confirm your email address...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mb-4">
                Email Verified!
              </h2>
              <p className="text-slate-600 text-lg mb-10 max-w-[320px] mx-auto leading-relaxed">
                Your account is now fully activated. Welcome to the FlowO
                platform!
              </p>

              <Link to="/login" className="w-full">
                <Button
                  type="primary"
                  size="large"
                  className="w-full h-14 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-500/20 flex items-center justify-center"
                >
                  Go to Dashboard{' '}
                  <ArrowLeft className="ml-2 w-5 h-5 rotate-180" />
                </Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                <XCircle className="w-10 h-10 text-rose-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mb-4">
                Verification Failed
              </h2>
              <p className="text-slate-600 text-lg mb-10 max-w-[340px] mx-auto leading-relaxed">
                {token
                  ? 'The link is invalid or has expired. Please contact support if you believe this is an error.'
                  : "We couldn't find a verification token in the URL. Please check the link in your email."}
              </p>

              <div className="flex flex-col gap-3 w-full">
                <Link to="/login" className="w-full">
                  <Button
                    size="large"
                    className="w-full h-12 rounded-xl border-slate-200 text-slate-600 font-semibold flex items-center justify-center"
                  >
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
