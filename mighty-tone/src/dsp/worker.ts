import { prepareIr, type IrPrepOptions, type IrPrepResult } from './pipeline.ts';

export interface IrPrepRequest {
  type: 'prepare';
  wav: ArrayBuffer;
  options: Partial<IrPrepOptions>;
}

export type IrPrepResponse =
  { type: 'result'; result: IrPrepResult } | { type: 'error'; message: string };

export function handleIrPrepMessage(data: IrPrepRequest): IrPrepResponse {
  if (data?.type !== 'prepare') {
    return { type: 'error', message: `Unknown message type: ${String(data?.type)}` };
  }
  try {
    return { type: 'result', result: prepareIr(data.wav, data.options) };
  } catch (err) {
    return { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

interface WorkerScope {
  onmessage: ((ev: MessageEvent<IrPrepRequest>) => void) | null;
  postMessage(message: IrPrepResponse, transfer?: Transferable[]): void;
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
  const scope = self as unknown as WorkerScope;
  scope.onmessage = (ev) => {
    const response = handleIrPrepMessage(ev.data);
    const transfer = response.type === 'result' ? [response.result.ir.buffer as ArrayBuffer] : [];
    scope.postMessage(response, transfer);
  };
}
