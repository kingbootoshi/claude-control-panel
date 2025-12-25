import { useEffect, useMemo, useState, useCallback } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { createTrpcClient, trpc } from './trpc';

const TOKEN_STORAGE_KEY = 'ccpAuthToken';

interface AuthGateProps {
  children: ReactNode;
}

function isAuthError(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return error.data?.code === 'UNAUTHORIZED';
  }
  if (error instanceof Error) {
    return error.message.includes('UNAUTHORIZED') || error.message.includes('Invalid auth token');
  }
  return false;
}

function TrpcProvider({ token, children, onAuthError }: { token: string; children: ReactNode; onAuthError: () => void }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // Don't retry on auth errors
          if (isAuthError(error)) {
            onAuthError();
            return false;
          }
          return failureCount < 3;
        },
      },
      mutations: {
        retry: false,
        onError: (error) => {
          if (isAuthError(error)) {
            onAuthError();
          }
        },
      },
    },
  }));
  const { client, wsClient } = useMemo(() => createTrpcClient(token), [token]);

  useEffect(() => {
    return () => {
      wsClient.close();
    };
  }, [wsClient]);

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export function AuthGate({ children }: AuthGateProps) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [input, setInput] = useState(token);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;
    setError(null);
    localStorage.setItem(TOKEN_STORAGE_KEY, input.trim());
    setToken(input.trim());
  };

  const handleAuthError = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setInput('');
    setError('Invalid access token');
  }, []);

  if (!token) {
    return (
      <div className="auth-gate">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Claude Control Panel</h1>
          <p>Enter your access token to connect.</p>
          {error && <div className="auth-error">{error}</div>}
          <input
            type="password"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="CCP_AUTH_TOKEN"
            autoFocus
          />
          <button type="submit">Connect</button>
        </form>
      </div>
    );
  }

  return <TrpcProvider token={token} onAuthError={handleAuthError}>{children}</TrpcProvider>;
}
