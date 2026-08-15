import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Client, Connection } from '@temporalio/client';
import { submitWithStart } from './client';
import { applyContextDelta, cancelTask, getTask } from './shared';
import type { ContextDelta, TaskCapsule } from './types';

export interface RpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method: string;
  params?: any;
}

export async function dispatch(client: Client, request: RpcRequest) {
  const params = request.params ?? {};
  switch (request.method) {
    case 'tasks/send': {
      const task = (params.task ?? params) as TaskCapsule;
      const { snapshot } = await submitWithStart(task, client);
      return snapshot;
    }
    case 'tasks/get':
      return client.workflow.getHandle(String(params.id ?? params.task_id)).query(getTask);
    case 'tasks/update': {
      const delta = (params.context_delta ?? params.delta) as ContextDelta;
      return client.workflow
        .getHandle(String(params.id ?? delta.task_id))
        .executeUpdate(applyContextDelta, { updateId: delta.delta_id, args: [delta] });
    }
    case 'tasks/cancel':
      return client.workflow
        .getHandle(String(params.id ?? params.task_id))
        .executeUpdate(cancelTask, { args: [] });
    default:
      throw Object.assign(new Error('unsupported_method'), { code: -32601 });
  }
}

async function temporalClient() {
  const tls =
    process.env.TEMPORAL_TLS_CERT && process.env.TEMPORAL_TLS_KEY
      ? {
          clientCertPair: {
            crt: await readFile(process.env.TEMPORAL_TLS_CERT),
            key: await readFile(process.env.TEMPORAL_TLS_KEY),
          },
        }
      : undefined;
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    tls,
  });
  return new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
  });
}

async function main() {
  const client = await temporalClient();
  const token = process.env.AKASHIC_CONTROL_TOKEN;
  const port = Number(process.env.PORT ?? 8787);
  http
    .createServer(async (request, response) => {
      response.setHeader('content-type', 'application/json');
      try {
        if (request.url === '/healthz' && request.method === 'GET') {
          response.end(
            JSON.stringify({
              ok: true,
              service: 'akashic-temporal-control',
              workflow_authority: 'temporal',
            }),
          );
          return;
        }
        if (request.url !== '/a2a' || request.method !== 'POST') {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        if (token && request.headers.authorization !== `Bearer ${token}`) {
          response.statusCode = 401;
          response.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 1_048_576) throw new Error('request_too_large');
        }
        const rpc = JSON.parse(body) as RpcRequest;
        const result = await dispatch(client, rpc);
        response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id ?? null, result }));
      } catch (error: any) {
        response.statusCode = error?.code === -32601 ? 404 : 400;
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: error?.code ?? -32000, message: error?.message ?? String(error) },
          }),
        );
      }
    })
    .listen(port, '0.0.0.0', () => console.log(`akashic temporal control on :${port}`));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
