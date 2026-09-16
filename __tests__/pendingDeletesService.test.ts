jest.mock('react-native-keychain', () => ({
  __store: {} as Record<string, string>,
  getGenericPassword: async ({ service }: { service: string }) => {
    const value = (jest.requireMock('react-native-keychain') as any).__store[service];
    return value ? { username: 'user', password: value } : false;
  },
  setGenericPassword: async (_u: string, p: string, { service }: { service: string }) => {
    (jest.requireMock('react-native-keychain') as any).__store[service] = p;
    return true;
  },
}));

jest.mock('../src/services/lazosService', () => ({
  deleteLazoRemote: jest.fn(),
}));

import * as Keychain from 'react-native-keychain';
import { deleteLazoRemote } from '../src/services/lazosService';
import {
  getPendingDeletes,
  addPendingDelete,
  removePendingDelete,
  flushPendingDeletes,
} from '../src/services/pendingDeletesService';

const mockedDelete = deleteLazoRemote as jest.Mock;

// Resetea el store en memoria del mock de Keychain entre tests.
beforeEach(() => {
  (Keychain as any).__store = {};
  mockedDelete.mockReset();
});

describe('pendingDeletesService (outbox de borrados)', () => {
  it('cola vacía al inicio', async () => {
    const pending = await getPendingDeletes();
    expect(pending).toEqual([]);
  });

  it('addPendingDelete persiste y no duplica', async () => {
    await addPendingDelete('lazo-1');
    await addPendingDelete('lazo-1');
    await addPendingDelete('lazo-2');
    expect(await getPendingDeletes()).toEqual(['lazo-1', 'lazo-2']);
  });

  it('removePendingDelete saca solo el id indicado', async () => {
    await addPendingDelete('lazo-1');
    await addPendingDelete('lazo-2');
    await removePendingDelete('lazo-1');
    expect(await getPendingDeletes()).toEqual(['lazo-2']);
  });

  it('flush ejecuta los DELETE y vacía la cola con éxito', async () => {
    await addPendingDelete('lazo-1');
    await addPendingDelete('lazo-2');
    mockedDelete.mockResolvedValue(undefined);
    await flushPendingDeletes();
    expect(mockedDelete).toHaveBeenCalledTimes(2);
    expect(await getPendingDeletes()).toEqual([]);
  });

  it('flush trata 404 como éxito (el lazo ya no existe)', async () => {
    await addPendingDelete('lazo-1');
    mockedDelete.mockRejectedValue(
      Object.assign(new Error('Lazo no encontrado'), { status: 404 }),
    );
    await flushPendingDeletes();
    expect(await getPendingDeletes()).toEqual([]);
  });

  it('flush conserva en la cola los que fallan por red', async () => {
    await addPendingDelete('lazo-ok');
    await addPendingDelete('lazo-fail');
    mockedDelete.mockImplementation(async (id: string) => {
      if (id === 'lazo-fail') {
        throw Object.assign(new Error('Network request failed'), {});
      }
    });
    await flushPendingDeletes();
    expect(await getPendingDeletes()).toEqual(['lazo-fail']);
  });
});
