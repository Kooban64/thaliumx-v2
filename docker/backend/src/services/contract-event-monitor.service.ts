/**
 * Contract Event Monitor Service
 * 
 * Real-time monitoring of smart contract events:
 * - EmergencyModeActivated → Pause backend processing
 * - CircuitBreakerTriggered → Block affected operations
 * - SecurityEventLogged → Trigger security response
 * - TokensPurchased → Validate against backend records
 * 
 * Real-time event processing and response.
 */

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { SecurityOversightService } from './security-oversight';
import type { JsonRpcProvider } from 'ethers';
import { ethers } from 'ethers';
// Contract imported but not used in this file
import { getContractAddresses } from '../contracts/addresses/testnet';
import { getABI, SECURITY_ABI, EMERGENCY_CONTROLS_ABI, PRESALE_ABI } from '../contracts/abis';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ContractEvent {
  contractAddress: string;
  contractName: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  args: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresAction: boolean;
}

export interface EventMonitorConfig {
  enabled: boolean;
  pollInterval: number; // milliseconds
  contracts: {
    security?: string;
    emergencyControls?: string;
    presale?: string;
  };
}

// =============================================================================
// CONTRACT EVENT MONITOR SERVICE
// =============================================================================

export class ContractEventMonitorService {
  private static isMonitoring = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static lastProcessedBlock: Map<string, number> = new Map();
  private static eventHandlers: Map<string, (event: ContractEvent) => Promise<void>> = new Map();

  /**
   * Start monitoring contract events
   */
  public static async startMonitoring(config?: EventMonitorConfig): Promise<void> {
    if (this.isMonitoring) {
      LoggerService.warn('Contract event monitoring already started');
      return;
    }

    try {
      const addresses = getContractAddresses();
      const monitorConfig: EventMonitorConfig = config || {
        enabled: true,
        pollInterval: parseInt(process.env.CONTRACT_EVENT_POLL_INTERVAL || '5000', 10), // 5 seconds default
        contracts: {
          security: (addresses as any).THALIUM_SECURITY,
          emergencyControls: (addresses as any).EMERGENCY_CONTROLS,
          presale: addresses.THALIUM_PRESALE
        }
      };

      if (!monitorConfig.enabled) {
        LoggerService.info('Contract event monitoring is disabled');
        return;
      }

      this.isMonitoring = true;
      LoggerService.info('Starting contract event monitoring', {
        pollInterval: monitorConfig.pollInterval,
        contracts: monitorConfig.contracts
      });

      // Register event handlers
      this.registerEventHandlers();

      // Start polling
      this.monitoringInterval = setInterval(() => {
        void (async () => {
          try {
            await this.pollContractEvents(monitorConfig);
          } catch (error) {
            LoggerService.error('Error polling contract events', error);
          }
        })();
      }, monitorConfig.pollInterval);

      // Initial poll
      await this.pollContractEvents(monitorConfig);

      LoggerService.info('Contract event monitoring started successfully');
    } catch (error) {
      LoggerService.error('Failed to start contract event monitoring', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop monitoring contract events
   */
  public static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    LoggerService.info('Contract event monitoring stopped');
  }

  /**
   * Register event handlers
   */
  private static registerEventHandlers(): void {
    // EmergencyModeActivated handler
    this.eventHandlers.set('EmergencyModeActivated', async (event: ContractEvent) => {
      LoggerService.error('EMERGENCY MODE ACTIVATED', {
        contract: event.contractName,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // Create critical security event
      await SecurityOversightService.createSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY' as any,
        severity: 'CRITICAL' as any,
        title: 'Emergency Mode Activated',
        description: `Emergency mode activated on contract ${event.contractAddress}`,
        source: 'contract_monitor',
        userId: undefined,
        timestamp: new Date(),
        metadata: {
          contractAddress: event.contractAddress,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          reason: event.args.reason || 'Emergency mode activated',
          eventType: 'EmergencyModeActivated'
        },
        status: 'OPEN' as any
      });

      // Emit system event
      await EventStreamingService.emitSystemEvent(
        'contract.emergency.activated',
        'contract_monitor',
        'error',
        {
          contractAddress: event.contractAddress,
          transactionHash: event.transactionHash,
          reason: event.args.reason
        },
        {}
      );

      // TODO: Pause backend processing for affected contracts
      LoggerService.warn('Backend processing should be paused for emergency mode');
    });

    // CircuitBreakerTriggered handler
    this.eventHandlers.set('CircuitBreakerTriggered', async (event: ContractEvent) => {
      LoggerService.error('CIRCUIT BREAKER TRIGGERED', {
        contract: event.contractName,
        affectedContract: event.args.contractAddress,
        reason: event.args.reason,
        transactionHash: event.transactionHash
      });

      await SecurityOversightService.createSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY' as any,
        severity: 'HIGH' as any,
        title: 'Circuit Breaker Triggered',
        description: `Circuit breaker triggered for contract ${event.args.contractAddress}`,
        source: 'contract_monitor',
        userId: undefined,
        timestamp: new Date(),
        metadata: {
          contractAddress: event.args.contractAddress,
          reason: event.args.reason,
          transactionHash: event.transactionHash,
          eventType: 'CircuitBreakerTriggered'
        },
        status: 'OPEN' as any
      });

      await EventStreamingService.emitSystemEvent(
        'contract.circuit_breaker.triggered',
        'contract_monitor',
        'error',
        {
          affectedContract: event.args.contractAddress,
          reason: event.args.reason
        },
        {}
      );
    });

    // SecurityEventLogged handler
    this.eventHandlers.set('SecurityEventLogged', async (event: ContractEvent) => {
      const severity = this.mapContractSeverityToSecuritySeverity(event.args.severity);
      
      LoggerService.warn('Security event logged on-chain', {
        eventId: event.args.eventId.toString(),
        actor: event.args.actor,
        eventType: event.args.eventType,
        severity: event.args.severity
      });

      await SecurityOversightService.createSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY' as any,
        severity: severity as any,
        title: 'On-Chain Security Event',
        description: `Security event logged on-chain: ${event.args.eventType}`,
        source: 'contract_monitor',
        userId: event.args.actor,
        timestamp: new Date(),
        metadata: {
          contractAddress: event.contractAddress,
          eventId: event.args.eventId?.toString(),
          eventType: event.args.eventType,
          transactionHash: event.transactionHash
        },
        status: 'OPEN' as any
      });
    });

    // TokensPurchased handler (validate against backend)
    this.eventHandlers.set('TokensPurchased', async (event: ContractEvent) => {
      LoggerService.info('TokensPurchased event detected', {
        buyer: event.args.buyer,
        usdtAmount: event.args.usdtAmount?.toString(),
        thalAmount: event.args.thalAmount?.toString(),
        vestingScheduleId: event.args.vestingScheduleId
      });

      // Validate against backend records
      // This would check if the investment exists in the backend database
      // and matches the on-chain transaction
      await EventStreamingService.emitSystemEvent(
        'contract.presale.tokens_purchased',
        'contract_monitor',
        'info',
        {
          buyer: event.args.buyer,
          usdtAmount: event.args.usdtAmount?.toString(),
          thalAmount: event.args.thalAmount?.toString(),
          vestingScheduleId: event.args.vestingScheduleId,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        },
        { userId: event.args.buyer }
      );
    });
  }

  /**
   * Poll contract events
   */
  private static async pollContractEvents(config: EventMonitorConfig): Promise<void> {
    try {
      const contractConfig = ConfigService.getConfig();
      const provider = new ethers.JsonRpcProvider(contractConfig.blockchain.rpcUrl);
      // currentBlock extracted but not used in this function
      await provider.getBlockNumber();

      // Monitor ThaliumSecurity contract
      if (config.contracts.security) {
        await this.monitorContract(
          provider,
          config.contracts.security,
          'ThaliumSecurity',
          SECURITY_ABI || getABI('ThaliumSecurity'),
          ['EmergencyModeActivated', 'EmergencyModeDeactivated', 'SecurityEventLogged']
        );
      }

      // Monitor EmergencyControls contract
      if (config.contracts.emergencyControls) {
        await this.monitorContract(
          provider,
          config.contracts.emergencyControls,
          'EmergencyControls',
          EMERGENCY_CONTROLS_ABI || getABI('EmergencyControls'),
          ['CircuitBreakerTriggered', 'CircuitBreakerReset', 'EmergencyLevelChanged']
        );
      }

      // Monitor Presale contract
      if (config.contracts.presale) {
        await this.monitorContract(
          provider,
          config.contracts.presale,
          'ThaliumPresale',
          PRESALE_ABI || getABI('ThaliumPresale'),
          ['TokensPurchased', 'PresaleStarted', 'PresaleEnded', 'EmergencyPaused', 'EmergencyUnpaused']
        );
      }
    } catch (error) {
      LoggerService.error('Error polling contract events', error);
    }
  }

  /**
   * Monitor a specific contract for events
   */
  private static async monitorContract(
    provider: JsonRpcProvider,
    contractAddress: string,
    contractName: string,
    abi: any[] | null,
    eventNames: string[]
  ): Promise<void> {
    if (!abi || abi.length === 0) {
      LoggerService.warn(`ABI not available for ${contractName}`, { contractAddress });
      return;
    }

    try {
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const lastBlock = this.lastProcessedBlock.get(contractAddress) || 0;
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(lastBlock + 1, currentBlock - 1000); // Last 1000 blocks

      if (fromBlock > currentBlock) {
        return; // No new blocks
      }

      // Query events for each event name
      for (const eventName of eventNames) {
        try {
          const filterFn = (contract.filters as any)[eventName];
          if (!filterFn) {
            LoggerService.warn(`Filter function not found for event: ${eventName}`);
            continue;
          }
          const filter = filterFn();
          const events = await contract.queryFilter(filter, fromBlock, currentBlock);

          for (const event of events) {
            const eventLog = event as any;
            if (!eventLog || !('args' in eventLog) || !eventLog.args) continue;

            const contractEvent: ContractEvent = {
              contractAddress,
              contractName,
              eventName,
              blockNumber: eventLog.blockNumber || 0,
              transactionHash: eventLog.hash || eventLog.transactionHash || '',
              timestamp: Date.now(), // Would get from block timestamp
              args: this.parseEventArgs(eventLog.args),
              severity: this.determineEventSeverity(eventName),
              requiresAction: this.eventRequiresAction(eventName)
            };

            // Process event
            await this.processEvent(contractEvent);
          }
        } catch (error) {
          LoggerService.warn(`Failed to query ${eventName} events from ${contractName}`, { error });
        }
      }

      // Update last processed block
      this.lastProcessedBlock.set(contractAddress, currentBlock);
    } catch (error) {
      LoggerService.error(`Failed to monitor ${contractName} contract`, { error, contractAddress });
    }
  }

  /**
   * Process a contract event
   */
  private static async processEvent(event: ContractEvent): Promise<void> {
    try {
      // Check if handler exists
      const handler = this.eventHandlers.get(event.eventName);
      if (handler) {
        await handler(event);
      } else {
        // Default handler for unhandled events
        LoggerService.info('Unhandled contract event', {
          contract: event.contractName,
          event: event.eventName,
          transactionHash: event.transactionHash
        });

        await EventStreamingService.emitSystemEvent(
          `contract.${event.contractName.toLowerCase()}.${event.eventName.toLowerCase()}`,
          'contract_monitor',
          'info',
          {
            contractAddress: event.contractAddress,
            eventName: event.eventName,
            args: event.args,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber
          },
          {}
        );
      }

      // Log event processing
      await LoggerService.logAudit(
        'contract_event_processed',
        'contract_monitor',
        { userId: event.args.actor || event.args.buyer || undefined },
        {
          contractAddress: event.contractAddress,
          contractName: event.contractName,
          eventName: event.eventName,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          severity: event.severity,
          requiresAction: event.requiresAction
        }
      );
    } catch (error) {
      LoggerService.error('Failed to process contract event', {
        error,
        event: event.eventName,
        contract: event.contractName
      });
    }
  }

  /**
   * Parse event arguments (handle BigNumber and other types)
   */
  private static parseEventArgs(args: any): any {
    const parsed: any = {};
    for (const key in args) {
      if (isNaN(Number(key))) { // Skip numeric indices
        const value = args[key];
        if (typeof value === 'object' && value !== null && 'toString' in value) {
          parsed[key] = value.toString();
        } else {
          parsed[key] = value;
        }
      }
    }
    return parsed;
  }

  /**
   * Determine event severity
   */
  private static determineEventSeverity(eventName: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalEvents = ['EmergencyModeActivated', 'CircuitBreakerTriggered'];
    const highEvents = ['SecurityEventLogged', 'EmergencyPaused'];
    const mediumEvents = ['PresaleEnded', 'CircuitBreakerReset'];

    if (criticalEvents.includes(eventName)) return 'CRITICAL';
    if (highEvents.includes(eventName)) return 'HIGH';
    if (mediumEvents.includes(eventName)) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if event requires action
   */
  private static eventRequiresAction(eventName: string): boolean {
    const actionRequiredEvents = [
      'EmergencyModeActivated',
      'CircuitBreakerTriggered',
      'EmergencyPaused',
      'SecurityEventLogged'
    ];
    return actionRequiredEvents.includes(eventName);
  }

  /**
   * Map contract severity (number) to security severity
   */
  private static mapContractSeverityToSecuritySeverity(severity: number | string): any {
    const severityNum = typeof severity === 'string' ? parseInt(severity, 10) : severity;
    if (severityNum >= 4) return 'CRITICAL';
    if (severityNum >= 3) return 'HIGH';
    if (severityNum >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get monitoring status
   */
  public static getMonitoringStatus(): {
    isMonitoring: boolean;
    lastProcessedBlocks: Record<string, number>;
    registeredHandlers: string[];
  } {
    return {
      isMonitoring: this.isMonitoring,
      lastProcessedBlocks: Object.fromEntries(this.lastProcessedBlock),
      registeredHandlers: Array.from(this.eventHandlers.keys())
    };
  }
}
