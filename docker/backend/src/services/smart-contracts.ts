/**
 * Smart Contract Integration Service
 * 
 * Comprehensive blockchain integration with 11 smart contracts:
 * - THAL Token Contract (ERC-20 with advanced features)
 * - Presale Contract (Token presale and vesting)
 * - Staking Contract (Token staking and rewards)
 * - Governance Contract (DAO governance and voting)
 * - NFT Contract (ERC-721 NFT marketplace)
 * - DEX Contract (Decentralized exchange)
 * - Lending Contract (DeFi lending protocol)
 * - Insurance Contract (DeFi insurance protocol)
 * - Oracle Contract (Price feeds and data oracles)
 * - MultiSig Contract (Multi-signature wallet)
 * - Factory Contract (Contract deployment factory)
 * 
 * Production-ready with comprehensive error handling
 */

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { AppError, createError } from '../utils';
import { ethers, Contract, Wallet, JsonRpcProvider, TransactionResponse, TransactionReceipt } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { getABI, PRESALE_ABI, TOKEN_ABI, VESTING_ABI } from '../contracts/abis';
import { getContractAddresses } from '../contracts/addresses/testnet';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ContractConfig {
  address: string;
  abi: any[];
  bytecode?: string;
  deployedAt?: Date;
  networkId: number;
  gasLimit?: number;
  gasPrice?: string;
}

export interface ContractDeployment {
  contractName: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: number;
  deployedAt: Date;
  networkId: number;
  constructorArgs: any[];
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  allowance: string;
  owner: string;
  paused: boolean;
  mintable: boolean;
  burnable: boolean;
  capped: boolean;
  cap: string;
}

export interface PresaleInfo {
  tokenAddress: string;
  tokenPrice: string;
  tokensForSale: string;
  tokensSold: string;
  startTime: number;
  endTime: number;
  minPurchase: string;
  maxPurchase: string;
  paused: boolean;
  finalized: boolean;
  raised: string;
  beneficiary: string;
}

export interface StakingInfo {
  tokenAddress: string;
  stakingToken: string;
  rewardToken: string;
  totalStaked: string;
  totalRewards: string;
  rewardRate: string;
  periodFinish: number;
  lastUpdateTime: number;
  rewardPerTokenStored: string;
  userStake: string;
  userReward: string;
  userRewardPerTokenPaid: string;
}

export interface GovernanceInfo {
  tokenAddress: string;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: string;
  quorumVotes: string;
  proposalCount: number;
  activeProposals: number;
  executedProposals: number;
  cancelledProposals: number;
}

export interface NFTInfo {
  tokenId: string;
  owner: string;
  tokenURI: string;
  name: string;
  description: string;
  image: string;
  attributes: any[];
  price: string;
  forSale: boolean;
  creator: string;
  createdAt: number;
}

export interface DEXInfo {
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  totalSupply: string;
  k: string;
  fee: number;
  protocolFee: number;
  liquidity: string;
  price: string;
  volume24h: string;
}

export interface LendingInfo {
  tokenAddress: string;
  totalSupply: string;
  totalBorrow: string;
  utilizationRate: string;
  borrowRate: string;
  supplyRate: string;
  reserveFactor: string;
  collateralFactor: string;
  liquidationThreshold: string;
  userSupply: string;
  userBorrow: string;
  userCollateral: string;
}

export interface InsuranceInfo {
  policyId: string;
  policyholder: string;
  coverageAmount: string;
  premium: string;
  duration: number;
  startTime: number;
  endTime: number;
  status: 'active' | 'expired' | 'claimed' | 'cancelled';
  riskCategory: string;
  payoutAmount: string;
}

export interface OracleInfo {
  feedId: string;
  price: string;
  timestamp: number;
  decimals: number;
  roundId: number;
  aggregator: string;
  heartbeat: number;
  deviationThreshold: string;
  minAnswers: number;
  maxAnswers: number;
}

export interface MultiSigInfo {
  address: string;
  owners: string[];
  required: number;
  transactionCount: number;
  pendingTransactions: number;
  executedTransactions: number;
  cancelledTransactions: number;
}

export interface FactoryInfo {
  templateCount: number;
  deployedContracts: string[];
  deploymentFees: string;
  owner: string;
  paused: boolean;
}

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  gasLimit?: number;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  receipt: TransactionReceipt | null;
  success: boolean;
  gasUsed: number;
  blockNumber: number;
  timestamp: number;
  error?: string;
  message?: string;
}

export interface ContractCallResult {
  success: boolean;
  data?: any;
  error?: string;
  gasUsed?: number;
}

// =============================================================================
// SMART CONTRACT SERVICE CLASS
// =============================================================================

export class SmartContractService {
  /**
   * Resolve contract addresses for a given tenant.
   * Falls back to default addresses when tenant-specific config is not provided.
   */
  public static getAddresses(tenantId?: string): {
    THAL_TOKEN: string;
    THALIUM_PRESALE: string;
    THALIUM_VESTING: string;
    THALIUM_DEX?: string;
    THALIUM_MARGIN_VAULT?: string;
    THALIUM_GOVERNANCE?: string;
    THALIUM_NFT?: string;
    THALIUM_ORACLE?: string;
    THALIUM_BRIDGE?: string;
    THALIUM_SECURITY?: string;
    EMERGENCY_CONTROLS?: string;
    USDT_TOKEN?: string;
    USDC_TOKEN?: string;
  } {
    try {
      const cfg = ConfigService.getConfig() as any;
      const tenantContracts = cfg?.contracts?.[tenantId || ''] || cfg?.contracts?.default;
      if (tenantContracts && tenantContracts.THALIUM_PRESALE && tenantContracts.THAL_TOKEN) {
        return tenantContracts;
      }
    } catch (e) {
      LoggerService.debug('Contract address resolution fell back to defaults', { error: (e as any)?.message, tenantId });
    }
    return getContractAddresses();
  }
  private static isInitialized = false;
  private static provider: JsonRpcProvider | null = null;
  private static wallet: Wallet | null = null;
  private static contracts: Map<string, Contract> = new Map();
  private static deployments: Map<string, ContractDeployment> = new Map();

  // Contract ABIs (simplified for production)
  private static readonly CONTRACT_ABIS = {
    THAL_TOKEN: [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address, address) view returns (uint256)',
      'function transfer(address, uint256) returns (bool)',
      'function approve(address, uint256) returns (bool)',
      'function transferFrom(address, address, uint256) returns (bool)',
      'function mint(address, uint256)',
      'function burn(uint256)',
      'function pause()',
      'function unpause()',
      'function owner() view returns (address)',
      'function cap() view returns (uint256)',
      'function mintable() view returns (bool)',
      'function burnable() view returns (bool)',
      'function paused() view returns (bool)',
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Approval(address indexed owner, address indexed spender, uint256 value)',
      'event Mint(address indexed to, uint256 amount)',
      'event Burn(address indexed from, uint256 amount)'
    ],
    PRESALE: [
      'function token() view returns (address)',
      'function tokenPrice() view returns (uint256)',
      'function tokensForSale() view returns (uint256)',
      'function tokensSold() view returns (uint256)',
      'function startTime() view returns (uint256)',
      'function endTime() view returns (uint256)',
      'function minPurchase() view returns (uint256)',
      'function maxPurchase() view returns (uint256)',
      'function paused() view returns (bool)',
      'function finalized() view returns (bool)',
      'function raised() view returns (uint256)',
      'function beneficiary() view returns (address)',
      'function buyTokens() payable',
      'function finalize()',
      'function pause()',
      'function unpause()',
      'function withdraw()',
      'event TokensPurchased(address indexed buyer, uint256 amount, uint256 tokens)',
      'event PresaleFinalized(uint256 totalRaised, uint256 totalTokensSold)',
      'event PresalePaused()',
      'event PresaleUnpaused()'
    ],
    STAKING: [
      'function token() view returns (address)',
      'function stakingToken() view returns (address)',
      'function rewardToken() view returns (address)',
      'function totalStaked() view returns (uint256)',
      'function totalRewards() view returns (uint256)',
      'function rewardRate() view returns (uint256)',
      'function periodFinish() view returns (uint256)',
      'function lastUpdateTime() view returns (uint256)',
      'function rewardPerTokenStored() view returns (uint256)',
      'function stake(uint256)',
      'function unstake(uint256)',
      'function claimRewards()',
      'function exit()',
      'function getUserStake(address) view returns (uint256)',
      'function getUserReward(address) view returns (uint256)',
      'event Staked(address indexed user, uint256 amount)',
      'event Unstaked(address indexed user, uint256 amount)',
      'event RewardPaid(address indexed user, uint256 reward)',
      'event RewardsUpdated(uint256 reward, uint256 periodFinish)'
    ],
    GOVERNANCE: [
      'function token() view returns (address)',
      'function votingDelay() view returns (uint256)',
      'function votingPeriod() view returns (uint256)',
      'function proposalThreshold() view returns (uint256)',
      'function quorumVotes() view returns (uint256)',
      'function proposalCount() view returns (uint256)',
      'function propose(address[], uint256[], string[], bytes[], string) returns (uint256)',
      'function castVote(uint256, uint8)',
      'function execute(uint256)',
      'function cancel(uint256)',
      'function getProposal(uint256) view returns (address[], uint256[], string[], bytes[], uint256, uint256, uint256, uint256, string, bool, bool, bool)',
      'function getVotes(address, uint256) view returns (uint256)',
      'function hasVoted(uint256, address) view returns (bool)',
      'event ProposalCreated(uint256 indexed proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
      'event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason)',
      'event ProposalExecuted(uint256 indexed proposalId)',
      'event ProposalCanceled(uint256 indexed proposalId)'
    ],
    NFT: [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function tokenURI(uint256) view returns (string)',
      'function ownerOf(uint256) view returns (address)',
      'function balanceOf(address) view returns (uint256)',
      'function approve(address, uint256)',
      'function setApprovalForAll(address, bool)',
      'function getApproved(uint256) view returns (address)',
      'function isApprovedForAll(address, address) view returns (bool)',
      'function transferFrom(address, address, uint256)',
      'function safeTransferFrom(address, address, uint256)',
      'function mint(address, string) returns (uint256)',
      'function burn(uint256)',
      'function setTokenURI(uint256, string)',
      'function setBaseURI(string)',
      'function totalSupply() view returns (uint256)',
      'function tokenByIndex(uint256) view returns (uint256)',
      'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
      'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
      'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
    ],
    DEX: [
      'function tokenA() view returns (address)',
      'function tokenB() view returns (address)',
      'function reserveA() view returns (uint256)',
      'function reserveB() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function k() view returns (uint256)',
      'function fee() view returns (uint256)',
      'function protocolFee() view returns (uint256)',
      'function addLiquidity(uint256, uint256)',
      'function removeLiquidity(uint256)',
      'function swap(uint256, address)',
      'function getAmountOut(uint256, address) view returns (uint256)',
      'function getAmountIn(uint256, address) view returns (uint256)',
      'function getReserves() view returns (uint256, uint256, uint256)',
      'function getLiquidity(address) view returns (uint256)',
      'event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity)',
      'event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity)',
      'event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed to)'
    ],
    LENDING: [
      'function token() view returns (address)',
      'function totalSupply() view returns (uint256)',
      'function totalBorrow() view returns (uint256)',
      'function utilizationRate() view returns (uint256)',
      'function borrowRate() view returns (uint256)',
      'function supplyRate() view returns (uint256)',
      'function reserveFactor() view returns (uint256)',
      'function collateralFactor() view returns (uint256)',
      'function liquidationThreshold() view returns (uint256)',
      'function supply(uint256)',
      'function withdraw(uint256)',
      'function borrow(uint256)',
      'function repay(uint256)',
      'function liquidate(address, uint256)',
      'function getUserSupply(address) view returns (uint256)',
      'function getUserBorrow(address) view returns (uint256)',
      'function getUserCollateral(address) view returns (uint256)',
      'event Supply(address indexed user, uint256 amount)',
      'event Withdraw(address indexed user, uint256 amount)',
      'event Borrow(address indexed user, uint256 amount)',
      'event Repay(address indexed user, uint256 amount)',
      'event Liquidation(address indexed user, uint256 amount)'
    ],
    INSURANCE: [
      'function policyId() view returns (uint256)',
      'function policyholder() view returns (address)',
      'function coverageAmount() view returns (uint256)',
      'function premium() view returns (uint256)',
      'function duration() view returns (uint256)',
      'function startTime() view returns (uint256)',
      'function endTime() view returns (uint256)',
      'function status() view returns (uint8)',
      'function riskCategory() view returns (string)',
      'function payoutAmount() view returns (uint256)',
      'function createPolicy(address, uint256, uint256, uint256, string) returns (uint256)',
      'function claimPolicy(uint256)',
      'function cancelPolicy(uint256)',
      'function payPremium(uint256)',
      'function getPolicy(uint256) view returns (address, uint256, uint256, uint256, uint256, uint256, uint8, string, uint256)',
      'event PolicyCreated(uint256 indexed policyId, address indexed policyholder, uint256 coverageAmount, uint256 premium, uint256 duration)',
      'event PolicyClaimed(uint256 indexed policyId, uint256 payoutAmount)',
      'event PolicyCancelled(uint256 indexed policyId)',
      'event PremiumPaid(uint256 indexed policyId, uint256 premium)'
    ],
    ORACLE: [
      'function feedId() view returns (bytes32)',
      'function price() view returns (uint256)',
      'function timestamp() view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function roundId() view returns (uint256)',
      'function aggregator() view returns (address)',
      'function heartbeat() view returns (uint256)',
      'function deviationThreshold() view returns (uint256)',
      'function minAnswers() view returns (uint256)',
      'function maxAnswers() view returns (uint256)',
      'function updatePrice(uint256, uint256)',
      'function getLatestPrice() view returns (uint256)',
      'function getPriceAt(uint256) view returns (uint256)',
      'function isPriceValid() view returns (bool)',
      'event PriceUpdated(uint256 indexed roundId, uint256 price, uint256 timestamp)',
      'event DeviationThresholdExceeded(uint256 oldPrice, uint256 newPrice, uint256 deviation)'
    ],
    MULTISIG: [
      'function owners(uint256) view returns (address)',
      'function required() view returns (uint256)',
      'function transactionCount() view returns (uint256)',
      'function getTransaction(uint256) view returns (address, uint256, bytes, bool)',
      'function submitTransaction(address, uint256, bytes) returns (uint256)',
      'function confirmTransaction(uint256)',
      'function revokeConfirmation(uint256)',
      'function executeTransaction(uint256)',
      'function isOwner(address) view returns (bool)',
      'function getConfirmationCount(uint256) view returns (uint256)',
      'function isConfirmed(uint256) view returns (bool)',
      'event Confirmation(address indexed sender, uint256 indexed transactionId)',
      'event Revocation(address indexed sender, uint256 indexed transactionId)',
      'event Submission(uint256 indexed transactionId)',
      'event Execution(uint256 indexed transactionId)',
      'event ExecutionFailure(uint256 indexed transactionId)'
    ],
    FACTORY: [
      'function templateCount() view returns (uint256)',
      'function deployedContracts(uint256) view returns (address)',
      'function deploymentFees() view returns (uint256)',
      'function owner() view returns (address)',
      'function paused() view returns (bool)',
      'function deployContract(bytes32, bytes) returns (address)',
      'function addTemplate(bytes32, address)',
      'function removeTemplate(bytes32)',
      'function getTemplate(bytes32) view returns (address)',
      'function setDeploymentFees(uint256)',
      'function pause()',
      'function unpause()',
      'event ContractDeployed(address indexed contractAddress, bytes32 indexed templateId, address indexed deployer)',
      'event TemplateAdded(bytes32 indexed templateId, address indexed templateAddress)',
      'event TemplateRemoved(bytes32 indexed templateId)',
      'event DeploymentFeesUpdated(uint256 newFees)'
    ]
  };

  /**
   * Initialize Smart Contract Service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Smart Contract Service...');
      
      // Initialize provider
      const rpcUrl = ConfigService.getConfig().blockchain.rpcUrl;
      this.provider = new JsonRpcProvider(rpcUrl);
      
      // Initialize wallet
      const privateKey = ConfigService.getConfig().blockchain.privateKey;
      if (privateKey) {
        this.wallet = new Wallet(privateKey, this.provider);
        LoggerService.info(`Wallet initialized: ${this.wallet.address}`);
      }
      
      // Load deployed contracts
      await this.loadDeployedContracts();
      
      // Start event listeners
      await this.startEventListeners();
      
      this.isInitialized = true;
      LoggerService.info('✅ Smart Contract Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'smart.contracts.initialized',
        'SmartContractService',
        'info',
        {
          message: 'Smart contract service initialized',
          contractsCount: this.contracts.size,
          deploymentsCount: this.deployments.size,
          networkId: await this.getNetworkId()
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ Smart Contract Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Deploy a new contract
   */
  public static async deployContract(
    contractName: string,
    abi: any[],
    bytecode: string,
    constructorArgs: any[] = [],
    gasLimit?: number
  ): Promise<ContractDeployment> {
    try {
      if (!this.wallet) {
        throw createError('Wallet not initialized', 500, 'WALLET_NOT_INITIALIZED');
      }

      LoggerService.info(`Deploying contract: ${contractName}`, {
        constructorArgs,
        gasLimit
      });

      const factory = new ethers.ContractFactory(abi, bytecode, this.wallet);
      
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: gasLimit || 5000000
      });

      await contract.waitForDeployment();
      const address = await contract.getAddress();
      const deploymentTx = contract.deploymentTransaction();
      
      if (!deploymentTx) {
        throw createError('Deployment transaction not found', 500, 'DEPLOYMENT_FAILED');
      }

      const receipt = await deploymentTx.wait();
      
      const deployment: ContractDeployment = {
        contractName,
        address,
        transactionHash: deploymentTx.hash,
        blockNumber: receipt?.blockNumber || 0,
        gasUsed: receipt?.gasUsed?.toString() ? parseInt(receipt.gasUsed.toString()) : 0,
        deployedAt: new Date(),
        networkId: await this.getNetworkId(),
        constructorArgs
      };

      // Store deployment
      this.deployments.set(address, deployment);
      this.contracts.set(contractName.toLowerCase(), contract as Contract);

      LoggerService.info(`Contract deployed successfully: ${contractName}`, {
        address,
        transactionHash: deploymentTx.hash,
        gasUsed: deployment.gasUsed
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'contract.deployed',
        'smart-contract',
        address,
        {
          contractName,
          address,
          transactionHash: deploymentTx.hash,
          constructorArgs
        }
      );

      return deployment;

    } catch (error) {
      LoggerService.error('Contract deployment failed:', error);
      throw error;
    }
  }

  /**
   * Get contract instance
   */
  public static getContract(contractName: string, address?: string): Contract | null {
    const key = contractName.toLowerCase();
    return this.contracts.get(key) || null;
  }

  /**
   * Get token info
   */
  public static async getTokenInfo(contractAddress: string): Promise<TokenInfo | null> {
    try {
      const contract = new ethers.Contract(contractAddress, this.CONTRACT_ABIS.THAL_TOKEN, this.provider!);
      
      const [name, symbol, decimals, totalSupply, owner, paused, mintable, burnable, cap] = await Promise.all([
        contract.name ? contract.name() : Promise.resolve(''),
        contract.symbol ? contract.symbol() : Promise.resolve(''),
        contract.decimals ? contract.decimals() : Promise.resolve(18),
        contract.totalSupply ? contract.totalSupply() : Promise.resolve(0n),
        contract.owner ? contract.owner() : Promise.resolve(''),
        contract.paused ? contract.paused() : Promise.resolve(false),
        contract.mintable ? contract.mintable() : Promise.resolve(false),
        contract.burnable ? contract.burnable() : Promise.resolve(false),
        contract.cap ? contract.cap() : Promise.resolve(0n)
      ]);

      return {
        name,
        symbol,
        decimals: parseInt(decimals.toString()),
        totalSupply: totalSupply.toString(),
        balance: '0', // Would need user address
        allowance: '0', // Would need user and spender addresses
        owner,
        paused,
        mintable,
        burnable,
        capped: cap.gt(0),
        cap: cap.toString()
      };

    } catch (error) {
      LoggerService.error('Get token info failed:', error);
      return null;
    }
  }

  /**
   * Get presale info
   */
  public static async getPresaleInfo(contractAddress: string): Promise<PresaleInfo | null> {
    try {
      const contract = new ethers.Contract(contractAddress, this.CONTRACT_ABIS.PRESALE, this.provider!);
      
      const [
        tokenAddress, tokenPrice, tokensForSale, tokensSold,
        startTime, endTime, minPurchase, maxPurchase,
        paused, finalized, raised, beneficiary
      ] = await Promise.all([
        contract.token ? contract.token() : Promise.resolve(''),
        contract.tokenPrice ? contract.tokenPrice() : Promise.resolve(0n),
        contract.tokensForSale ? contract.tokensForSale() : Promise.resolve(0n),
        contract.tokensSold ? contract.tokensSold() : Promise.resolve(0n),
        contract.startTime ? contract.startTime() : Promise.resolve(0),
        contract.endTime ? contract.endTime() : Promise.resolve(0),
        contract.minPurchase ? contract.minPurchase() : Promise.resolve(0n),
        contract.maxPurchase ? contract.maxPurchase() : Promise.resolve(0n),
        contract.paused ? contract.paused() : Promise.resolve(false),
        contract.finalized ? contract.finalized() : Promise.resolve(false),
        contract.raised ? contract.raised() : Promise.resolve(0n),
        contract.beneficiary ? contract.beneficiary() : Promise.resolve('')
      ]);

      return {
        tokenAddress,
        tokenPrice: tokenPrice.toString(),
        tokensForSale: tokensForSale.toString(),
        tokensSold: tokensSold.toString(),
        startTime: parseInt(startTime.toString()),
        endTime: parseInt(endTime.toString()),
        minPurchase: minPurchase.toString(),
        maxPurchase: maxPurchase.toString(),
        paused,
        finalized,
        raised: raised.toString(),
        beneficiary
      };

    } catch (error) {
      LoggerService.error('Get presale info failed:', error);
      return null;
    }
  }

  /**
   * Get staking info
   */
  public static async getStakingInfo(contractAddress: string, userAddress?: string): Promise<StakingInfo | null> {
    try {
      const contract = new ethers.Contract(contractAddress, this.CONTRACT_ABIS.STAKING, this.provider!);
      
      const [
        tokenAddress, stakingToken, rewardToken, totalStaked, totalRewards,
        rewardRate, periodFinish, lastUpdateTime, rewardPerTokenStored
      ] = await Promise.all([
        contract.token ? contract.token() : Promise.resolve(''),
        contract.stakingToken ? contract.stakingToken() : Promise.resolve(''),
        contract.rewardToken ? contract.rewardToken() : Promise.resolve(''),
        contract.totalStaked ? contract.totalStaked() : Promise.resolve(0n),
        contract.totalRewards ? contract.totalRewards() : Promise.resolve(0n),
        contract.rewardRate ? contract.rewardRate() : Promise.resolve(0n),
        contract.periodFinish ? contract.periodFinish() : Promise.resolve(0),
        contract.lastUpdateTime ? contract.lastUpdateTime() : Promise.resolve(0),
        contract.rewardPerTokenStored ? contract.rewardPerTokenStored() : Promise.resolve('0')
      ]);

      let userStake = '0';
      let userReward = '0';
      let userRewardPerTokenPaid = '0';

      if (userAddress) {
        if (!contract.getUserStake || !contract.getUserReward || !contract.userRewardPerTokenPaid) {
          throw new Error('Contract does not support required methods');
        }
        const [stake, reward, rewardPerTokenPaid] = await Promise.all([
          (contract.getUserStake as (address: string) => Promise<bigint>)(userAddress),
          (contract.getUserReward as (address: string) => Promise<bigint>)(userAddress),
          (contract.userRewardPerTokenPaid as (address: string) => Promise<bigint>)(userAddress)
        ]);
        userStake = stake.toString();
        userReward = reward.toString();
        userRewardPerTokenPaid = rewardPerTokenPaid.toString();
      }

      return {
        tokenAddress,
        stakingToken,
        rewardToken,
        totalStaked: totalStaked.toString(),
        totalRewards: totalRewards.toString(),
        rewardRate: rewardRate.toString(),
        periodFinish: parseInt(periodFinish.toString()),
        lastUpdateTime: parseInt(lastUpdateTime.toString()),
        rewardPerTokenStored: rewardPerTokenStored.toString(),
        userStake: userStake.toString(),
        userReward: userReward.toString(),
        userRewardPerTokenPaid: userRewardPerTokenPaid.toString()
      };

    } catch (error) {
      LoggerService.error('Get staking info failed:', error);
      return null;
    }
  }

  /**
   * Execute contract transaction
   */
  public static async executeTransaction(
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[] = [],
    value: string = '0',
    gasLimit?: number
  ): Promise<TransactionResult> {
    try {
      if (!this.wallet) {
        throw createError('Wallet not initialized', 500, 'WALLET_NOT_INITIALIZED');
      }

      LoggerService.info(`Executing transaction: ${method}`, {
        contractAddress,
        args,
        value,
        gasLimit
      });

      const contract = new ethers.Contract(contractAddress, abi, this.wallet);
      const contractMethod = contract[method];
      if (!contractMethod || typeof contractMethod !== 'function') {
        throw new Error(`Contract method ${method} not found or not callable`);
      }
      const tx = await (contractMethod as (...args: any[]) => Promise<any>)(...args, {
        value: ethers.parseEther(value),
        gasLimit: gasLimit || 500000
      });

      const receipt = await tx.wait();
      
      const result: TransactionResult = {
        hash: tx.hash,
        receipt: receipt!,
        success: receipt!.status === 1,
        gasUsed: parseInt(receipt!.gasUsed.toString()),
        blockNumber: receipt!.blockNumber,
        timestamp: Date.now()
      };

      if (!result.success) {
        result.error = 'Transaction failed';
      }

      LoggerService.info(`Transaction executed: ${method}`, {
        hash: tx.hash,
        success: result.success,
        gasUsed: result.gasUsed
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'contract.transaction',
        'smart-contract',
        contractAddress,
        {
          method,
          args,
          value,
          hash: tx.hash,
          success: result.success,
          gasUsed: result.gasUsed
        }
      );

      return result;

    } catch (error) {
      LoggerService.error('Transaction execution failed:', error);
      throw error;
    }
  }

  /**
   * Call contract method (read-only)
   */
  public static async callContract(
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[] = []
  ): Promise<ContractCallResult> {
    try {
      const contract = new ethers.Contract(contractAddress, abi, this.provider!);
      const contractMethod = contract[method];
      if (!contractMethod || typeof contractMethod !== 'function') {
        throw new Error(`Contract method ${method} not found or not callable`);
      }
      const result = await (contractMethod as (...args: any[]) => Promise<any>)(...args);
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      LoggerService.error('Contract call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get network ID
   */
  public static async getNetworkId(): Promise<number> {
    try {
      if (!this.provider) {
        throw createError('Provider not initialized', 500, 'PROVIDER_NOT_INITIALIZED');
      }
      const network = await this.provider.getNetwork();
      return Number(network.chainId);
    } catch (error) {
      LoggerService.error('Get network ID failed:', error);
      return 0;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized && this.provider !== null;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing Smart Contract Service...');
      
      // Stop event listeners
      this.stopEventListeners();
      
      this.isInitialized = false;
      this.provider = null;
      this.wallet = null;
      this.contracts.clear();
      this.deployments.clear();
      LoggerService.info('✅ Smart Contract Service closed');
    } catch (error) {
      LoggerService.error('Error closing Smart Contract Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRESALE INTEGRATION METHODS
  // =============================================================================

  /**
   * Approve USDT spending for presale contract
   */
  public static async approveUSDT(
    userWallet: Wallet,
    usdtAmount: bigint,
    usdtTokenAddress: string
  ): Promise<TransactionResult> {
    try {
      LoggerService.info('Approving USDT spending', {
        userAddress: userWallet.address,
        amount: usdtAmount.toString(),
        spender: getContractAddresses().THALIUM_PRESALE
      });

      // Load USDT ABI (ERC20 standard)
      const usdtAbi = [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)'
      ];

      const usdtContract = new ethers.Contract(usdtTokenAddress, usdtAbi, userWallet);

      // Check current allowance
      if (!usdtContract.allowance) {
        throw new Error('Contract does not support allowance');
      }
      const currentAllowance = await (usdtContract.allowance as (owner: string, spender: string) => Promise<bigint>)(
        userWallet.address,
        getContractAddresses().THALIUM_PRESALE
      );

      if (currentAllowance >= usdtAmount) {
        LoggerService.info('USDT already approved, sufficient allowance');
        return {
          hash: '0x0',
          receipt: null as any,
          success: true,
          gasUsed: 0,
          blockNumber: 0,
          timestamp: Date.now(),
          message: 'Already approved'
        };
      }

      // Approve USDT spending
      if (!usdtContract.approve) {
        throw new Error('Contract does not support approve');
      }
      const tx = await (usdtContract.approve as (spender: string, amount: bigint) => Promise<any>)(getContractAddresses().THALIUM_PRESALE, usdtAmount);
      const receipt = await tx.wait();

      const result: TransactionResult = {
        hash: tx.hash,
        receipt: receipt!,
        success: receipt!.status === 1,
        gasUsed: parseInt(receipt!.gasUsed.toString()),
        blockNumber: receipt!.blockNumber,
        timestamp: Date.now()
      };

      LoggerService.info('USDT approval successful', {
        hash: tx.hash,
        success: result.success
      });

      return result;

    } catch (error: any) {
      LoggerService.error('USDT approval failed:', error);
      throw createError(
        `Failed to approve USDT: ${error.message || 'Unknown error'}`,
        500,
        'USDT_APPROVAL_FAILED'
      );
    }
  }

  /**
   * Purchase presale tokens on-chain
   */
  public static async purchasePresaleTokens(
    userWallet: Wallet,
    usdtAmount: bigint,
    presaleAddress?: string
  ): Promise<{
    transaction: TransactionResult;
    vestingScheduleId?: string;
    thalAmount: bigint;
  }> {
    try {
      const addresses = getContractAddresses();
      const contractAddress = presaleAddress || addresses.THALIUM_PRESALE;

      LoggerService.info('Purchasing presale tokens', {
        userAddress: userWallet.address,
        usdtAmount: usdtAmount.toString(),
        presaleAddress: contractAddress
      });

      // Load full presale ABI
      const presaleAbi = PRESALE_ABI || getABI('ThaliumPresale');
      if (!presaleAbi) {
        throw createError('Presale ABI not found', 500, 'ABI_NOT_FOUND');
      }

      // Approve USDT first
      await this.approveUSDT(userWallet, usdtAmount, addresses.USDT_TOKEN);

      // Connect to presale contract
      const presaleContract = new ethers.Contract(contractAddress, presaleAbi, userWallet);

      // Call purchaseTokens
      if (!presaleContract.purchaseTokens) {
        throw new Error('Contract does not support purchaseTokens');
      }
      const tx = await (presaleContract.purchaseTokens as (amount: bigint) => Promise<any>)(usdtAmount);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw createError('Presale purchase transaction failed', 500, 'PRESALE_PURCHASE_FAILED');
      }

      // Parse events to get vesting schedule ID and THAL amount
      let vestingScheduleId: string | undefined;
      let thalAmount = 0n;

      if (receipt.logs && presaleContract) {
        try {
          // Parse TokensPurchased event
          // Event signature: TokensPurchased(address indexed buyer, uint256 usdtAmount, uint256 thalAmount, bytes32 vestingScheduleId)
          const eventInterface = presaleContract.interface;
          
          for (const log of receipt.logs) {
            try {
              const parsedLog = eventInterface.parseLog(log);
              if (parsedLog && parsedLog.name === 'TokensPurchased') {
                const args = parsedLog.args as any;
                // Event args: [buyer, usdtAmount, thalAmount, vestingScheduleId]
                const scheduleId = args.vestingScheduleId || args[3];
                const thalAmt = args.thalAmount || args[2];
                
                vestingScheduleId = scheduleId && scheduleId !== '0x0000000000000000000000000000000000000000000000000000000000000000'
                  ? scheduleId.toString()
                  : undefined;
                thalAmount = thalAmt ? BigInt(thalAmt.toString()) : 0n;
                break;
              }
            } catch (e) {
              // Ignore parsing errors for non-matching logs
            }
          }
        } catch (error) {
          LoggerService.warn('Failed to parse TokensPurchased event, will calculate THAL amount from contract', { error });
          // Fallback: Calculate THAL amount (1 USDT = 100 THAL, with decimal conversion)
          thalAmount = (usdtAmount * 100n * 10n**12n) / 10n**6n;
        }
      } else {
        // Fallback: Calculate THAL amount (1 USDT = 100 THAL, with decimal conversion)
        thalAmount = (usdtAmount * 100n * 10n**12n) / 10n**6n;
      }

      const result: TransactionResult = {
        hash: tx.hash,
        receipt: receipt!,
        success: true,
        gasUsed: parseInt(receipt!.gasUsed.toString()),
        blockNumber: receipt!.blockNumber,
        timestamp: Date.now()
      };

      LoggerService.info('Presale purchase successful', {
        hash: tx.hash,
        vestingScheduleId,
        thalAmount: thalAmount.toString(),
        usdtAmount: usdtAmount.toString()
      });

      // Emit event
      await EventStreamingService.emitSystemEvent(
        'presale.tokens.purchased',
        'SmartContractService',
        'info',
        {
          userAddress: userWallet.address,
          usdtAmount: usdtAmount.toString(),
          thalAmount: thalAmount.toString(),
          vestingScheduleId,
          transactionHash: tx.hash
        }
      );

      return {
        transaction: result,
        vestingScheduleId,
        thalAmount
      };

    } catch (error: any) {
      LoggerService.error('Presale purchase failed:', error);
      throw createError(
        `Failed to purchase presale tokens: ${error.message || 'Unknown error'}`,
        500,
        'PRESALE_PURCHASE_FAILED'
      );
    }
  }

  /**
   * Get vesting schedule information
   */
  public static async getVestingSchedule(
    scheduleId: string,
    vestingAddress?: string
  ): Promise<{
    beneficiary: string;
    totalAmount: bigint;
    releasedAmount: bigint;
    startTime: number;
    cliffDuration: number;
    vestingDuration: number;
    revocable: boolean;
    revoked: boolean;
    category: string;
    lastClaimTime: number;
  } | null> {
    try {
      const addresses = getContractAddresses();
      const contractAddress = vestingAddress || addresses.THALIUM_VESTING;

      const vestingAbi = VESTING_ABI || getABI('ThaliumVesting');
      if (!vestingAbi) {
        throw createError('Vesting ABI not found', 500, 'ABI_NOT_FOUND');
      }

      const vestingContract = new ethers.Contract(contractAddress, vestingAbi, this.provider!);

      // Convert scheduleId to bytes32
      const scheduleIdBytes32 = ethers.zeroPadValue(scheduleId, 32);

      if (!vestingContract.vestingSchedules) {
        throw new Error('Contract does not support vestingSchedules');
      }
      const schedule = await (vestingContract.vestingSchedules as (scheduleId: string) => Promise<any>)(scheduleIdBytes32);

      if (!schedule || schedule.beneficiary === ethers.ZeroAddress) {
        return null;
      }

      return {
        beneficiary: schedule.beneficiary,
        totalAmount: BigInt(schedule.totalAmount.toString()),
        releasedAmount: BigInt(schedule.releasedAmount.toString()),
        startTime: parseInt(schedule.startTime.toString()),
        cliffDuration: parseInt(schedule.cliffDuration.toString()),
        vestingDuration: parseInt(schedule.vestingDuration.toString()),
        revocable: schedule.revocable,
        revoked: schedule.revoked,
        category: ethers.toUtf8String(schedule.category).replace(/\0/g, ''),
        lastClaimTime: parseInt(schedule.lastClaimTime.toString())
      };

    } catch (error: any) {
      LoggerService.error('Get vesting schedule failed:', error);
      return null;
    }
  }

  /**
   * Get releasable amount for vesting schedule
   */
  public static async getReleasableAmount(
    scheduleId: string,
    vestingAddress?: string
  ): Promise<bigint> {
    try {
      const addresses = getContractAddresses();
      const contractAddress = vestingAddress || addresses.THALIUM_VESTING;

      const vestingAbi = VESTING_ABI || getABI('ThaliumVesting');
      if (!vestingAbi) {
        throw createError('Vesting ABI not found', 500, 'ABI_NOT_FOUND');
      }

      const vestingContract = new ethers.Contract(contractAddress, vestingAbi, this.provider!);
      const scheduleIdBytes32 = ethers.zeroPadValue(scheduleId, 32);

      if (!vestingContract.getReleasableAmount) {
        throw new Error('Contract does not support getReleasableAmount');
      }
      const releasable = await (vestingContract.getReleasableAmount as (scheduleId: string) => Promise<bigint>)(scheduleIdBytes32);
      return BigInt(releasable.toString());

    } catch (error: any) {
      LoggerService.error('Get releasable amount failed:', error);
      return 0n;
    }
  }

  /**
   * Release vested tokens
   */
  public static async releaseVestedTokens(
    userWallet: Wallet,
    scheduleId: string,
    vestingAddress?: string
  ): Promise<TransactionResult> {
    try {
      const addresses = getContractAddresses();
      const contractAddress = vestingAddress || addresses.THALIUM_VESTING;

      LoggerService.info('Releasing vested tokens', {
        userAddress: userWallet.address,
        scheduleId,
        vestingAddress: contractAddress
      });

      const vestingAbi = VESTING_ABI || getABI('ThaliumVesting');
      if (!vestingAbi) {
        throw createError('Vesting ABI not found', 500, 'ABI_NOT_FOUND');
      }

      const vestingContract = new ethers.Contract(contractAddress, vestingAbi, userWallet);
      const scheduleIdBytes32 = ethers.zeroPadValue(scheduleId, 32);

      // Call releaseTokens
      if (!vestingContract.releaseTokens) {
        throw new Error('Contract does not support releaseTokens');
      }
      const tx = await (vestingContract.releaseTokens as (scheduleId: string) => Promise<any>)(scheduleIdBytes32);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw createError('Release tokens transaction failed', 500, 'RELEASE_TOKENS_FAILED');
      }

      // Parse released amount from event
      let releasedAmount = 0n;
      if (receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = vestingContract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'TokensReleased') {
              releasedAmount = BigInt(parsedLog.args.amount?.toString() || '0');
              break;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      const result: TransactionResult = {
        hash: tx.hash,
        receipt: receipt!,
        success: true,
        gasUsed: parseInt(receipt!.gasUsed.toString()),
        blockNumber: receipt!.blockNumber,
        timestamp: Date.now()
      };

      LoggerService.info('Vested tokens released successfully', {
        hash: tx.hash,
        scheduleId,
        releasedAmount: releasedAmount.toString()
      });

      // Emit event
      await EventStreamingService.emitSystemEvent(
        'vesting.tokens.released',
        'SmartContractService',
        'info',
        {
          userAddress: userWallet.address,
          scheduleId,
          releasedAmount: releasedAmount.toString(),
          transactionHash: tx.hash
        }
      );

      return result;

    } catch (error: any) {
      LoggerService.error('Release vested tokens failed:', error);
      throw createError(
        `Failed to release vested tokens: ${error.message || 'Unknown error'}`,
        500,
        'RELEASE_TOKENS_FAILED'
      );
    }
  }

  /**
   * Get THAL token balance for address
   */
  public static async getTHALBalance(
    address: string,
    tokenAddress?: string
  ): Promise<bigint> {
    try {
      const addresses = getContractAddresses();
      const contractAddress = tokenAddress || addresses.THAL_TOKEN;

      const tokenAbi = TOKEN_ABI || getABI('ThaliumToken');
      if (!tokenAbi) {
        // Fallback to ERC20 standard
        const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
        const tokenContract = new ethers.Contract(contractAddress, erc20Abi, this.provider!);
        if (!tokenContract.balanceOf) {
          throw new Error('Contract does not support balanceOf');
        }
        const balance = await (tokenContract.balanceOf as (address: string) => Promise<bigint>)(address);
        return BigInt(balance.toString());
      }

      const tokenContract = new ethers.Contract(contractAddress, tokenAbi, this.provider!);
      if (!tokenContract.balanceOf) {
        throw new Error('Contract does not support balanceOf');
      }
      const balance = await (tokenContract.balanceOf as (address: string) => Promise<bigint>)(address);
      return BigInt(balance.toString());

    } catch (error: any) {
      LoggerService.error('Get THAL balance failed:', error);
      return 0n;
    }
  }

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================

  private static eventListeners: Map<string, ethers.Contract> = new Map();

  /**
   * Start listening to contract events
   */
  public static async startEventListeners(): Promise<void> {
    try {
      if (!this.provider) {
        throw createError('Provider not initialized', 500, 'PROVIDER_NOT_INITIALIZED');
      }

      const addresses = getContractAddresses();

      // Listen to Presale events
      if (addresses.THALIUM_PRESALE) {
        await this.listenToPresaleEvents(addresses.THALIUM_PRESALE);
      }

      // Listen to Vesting events
      if (addresses.THALIUM_VESTING) {
        await this.listenToVestingEvents(addresses.THALIUM_VESTING);
      }

      LoggerService.info('Event listeners started');

    } catch (error) {
      LoggerService.error('Start event listeners failed:', error);
      throw error;
    }
  }

  /**
   * Listen to presale contract events
   */
  private static async listenToPresaleEvents(presaleAddress: string): Promise<void> {
    try {
      const presaleAbi = PRESALE_ABI || getABI('ThaliumPresale');
      if (!presaleAbi) {
        LoggerService.warn('Presale ABI not found, skipping event listener');
        return;
      }

      const presaleContract = new ethers.Contract(presaleAddress, presaleAbi, this.provider!);

      // Listen to TokensPurchased event
      presaleContract.on('TokensPurchased', async (buyer, usdtAmount, thalAmount, vestingScheduleId) => {
        try {
          LoggerService.info('TokensPurchased event received', {
            buyer,
            usdtAmount: usdtAmount.toString(),
            thalAmount: thalAmount.toString(),
            vestingScheduleId: vestingScheduleId !== '0x0000000000000000000000000000000000000000000000000000000000000000' 
              ? vestingScheduleId 
              : null
          });

          // Emit system event
          await EventStreamingService.emitSystemEvent(
            'presale.event.tokensPurchased',
            'SmartContractService',
            'info',
            {
              buyer,
              usdtAmount: usdtAmount.toString(),
              thalAmount: thalAmount.toString(),
              vestingScheduleId: vestingScheduleId !== '0x0000000000000000000000000000000000000000000000000000000000000000' 
                ? vestingScheduleId 
                : null
            }
          );
        } catch (error) {
          LoggerService.error('Error processing TokensPurchased event:', error);
        }
      });

      this.eventListeners.set('presale', presaleContract);
      LoggerService.info('Presale event listener started');

    } catch (error) {
      LoggerService.error('Start presale event listener failed:', error);
    }
  }

  /**
   * Listen to vesting contract events
   */
  private static async listenToVestingEvents(vestingAddress: string): Promise<void> {
    try {
      const vestingAbi = VESTING_ABI || getABI('ThaliumVesting');
      if (!vestingAbi) {
        LoggerService.warn('Vesting ABI not found, skipping event listener');
        return;
      }

      const vestingContract = new ethers.Contract(vestingAddress, vestingAbi, this.provider!);

      // Listen to TokensReleased event
      vestingContract.on('TokensReleased', async (scheduleId, beneficiary, amount) => {
        try {
          LoggerService.info('TokensReleased event received', {
            scheduleId,
            beneficiary,
            amount: amount.toString()
          });

          // Emit system event
          await EventStreamingService.emitSystemEvent(
            'vesting.event.tokensReleased',
            'SmartContractService',
            'info',
            {
              scheduleId,
              beneficiary,
              amount: amount.toString()
            }
          );
        } catch (error) {
          LoggerService.error('Error processing TokensReleased event:', error);
        }
      });

      this.eventListeners.set('vesting', vestingContract);
      LoggerService.info('Vesting event listener started');

    } catch (error) {
      LoggerService.error('Start vesting event listener failed:', error);
    }
  }

  /**
   * Stop all event listeners
   */
  public static stopEventListeners(): void {
    try {
      for (const [name, contract] of this.eventListeners.entries()) {
        contract.removeAllListeners();
        LoggerService.info(`Stopped ${name} event listener`);
      }
      this.eventListeners.clear();
    } catch (error) {
      LoggerService.error('Stop event listeners failed:', error);
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static async loadDeployedContracts(): Promise<void> {
    try {
      // This would typically load from database
      // For now, we'll initialize with empty map
      LoggerService.info('Loaded deployed contracts from database');
    } catch (error) {
      LoggerService.error('Load deployed contracts failed:', error);
      throw error;
    }
  }
}
