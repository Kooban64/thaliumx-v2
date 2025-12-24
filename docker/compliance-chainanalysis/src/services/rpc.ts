/**
 * RPC service for blockchain interactions
 */

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('rpc');

export class RpcService {
  async getAddressTransactions(chain: string, address: string, options: any): Promise<any[]> {
    logger.info('Getting address transactions (placeholder)', { chain, address, options });
    return [];
  }

  async getBlock(chain: string, height: number): Promise<any> {
    logger.info('Getting block (placeholder)', { chain, height });
    return { height, transactions: [] };
  }
}

let rpcService: RpcService | null = null;

export function getRpcService(): RpcService {
  if (!rpcService) {
    rpcService = new RpcService();
  }
  return rpcService;
}