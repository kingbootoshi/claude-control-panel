import { createTRPCReact } from '@trpc/react-query';
import { createWSClient, httpBatchLink, loggerLink, splitLink, wsLink } from '@trpc/client';
import type { AppRouter } from '../../src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/trpc`;
}

export function createTrpcClient(token: string) {
  const wsClient = createWSClient({
    url: getWebSocketUrl(),
    connectionParams: () => ({ token }),
    lazy: {
      enabled: true,
      closeMs: 1000,
    },
  });

  const client = trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          import.meta.env.DEV ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: wsLink({ client: wsClient }),
        false: httpBatchLink({
          url: '/trpc',
          headers: () => ({
            'x-ccp-token': token,
          }),
        }),
      }),
    ],
  });

  return { client, wsClient };
}
