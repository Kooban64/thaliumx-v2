"use strict";
/**
 * Smart Contract Routes
 *
 * API endpoints for comprehensive blockchain integration:
 * - Contract deployment and management
 * - Token operations (ERC-20)
 * - Presale operations
 * - Staking operations
 * - Governance operations
 * - NFT operations (ERC-721)
 * - DEX operations
 * - Lending operations
 * - Insurance operations
 * - Oracle operations
 * - MultiSig operations
 * - Factory operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const smart_contracts_1 = require("../services/smart-contracts");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
// =============================================================================
// CONTRACT DEPLOYMENT
// =============================================================================
/**
 * @swagger
 * /api/contracts/deploy:
 *   post:
 *     summary: Deploy a new smart contract
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractName
 *               - abi
 *               - bytecode
 *             properties:
 *               contractName:
 *                 type: string
 *                 description: Name of the contract
 *               abi:
 *                 type: array
 *                 description: Contract ABI
 *               bytecode:
 *                 type: string
 *                 description: Contract bytecode
 *               constructorArgs:
 *                 type: array
 *                 description: Constructor arguments
 *               gasLimit:
 *                 type: number
 *                 description: Gas limit for deployment
 *     responses:
 *       201:
 *         description: Contract deployed successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/deploy', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractName, abi, bytecode, constructorArgs = [], gasLimit } = req.body;
        if (!contractName || !abi || !bytecode) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: contractName, abi, bytecode'
            });
            return;
        }
        const deployment = await smart_contracts_1.SmartContractService.deployContract(contractName, abi, bytecode, constructorArgs, gasLimit);
        logger_1.LoggerService.info(`Contract deployed: ${contractName}`, {
            address: deployment.address,
            transactionHash: deployment.transactionHash
        });
        res.status(201).json({
            success: true,
            deployment
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Contract deployment failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deploy contract',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// TOKEN OPERATIONS
// =============================================================================
/**
 * @swagger
 * /api/contracts/token/{contractAddress}/info:
 *   get:
 *     summary: Get token information
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Token contract address
 *     responses:
 *       200:
 *         description: Token information
 *       404:
 *         description: Contract not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/token/:contractAddress/info', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const tokenInfo = await smart_contracts_1.SmartContractService.getTokenInfo(contractAddress);
        if (!tokenInfo) {
            res.status(404).json({
                success: false,
                error: 'Token contract not found or invalid'
            });
            return;
        }
        res.json({
            success: true,
            tokenInfo
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get token info failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get token info',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/contracts/token/{contractAddress}/transfer:
 *   post:
 *     summary: Transfer tokens
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Token contract address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - amount
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient address
 *               amount:
 *                 type: string
 *                 description: Amount to transfer
 *     responses:
 *       200:
 *         description: Transfer successful
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/token/:contractAddress/transfer', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { to, amount } = req.body;
        if (!to || !amount) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: to, amount'
            });
            return;
        }
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.executeTransaction(contractAddress, smart_contracts_1.SmartContractService['CONTRACT_ABIS'].THAL_TOKEN, 'transfer', [to, amount]);
        res.json({
            success: true,
            transaction: result
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Token transfer failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to transfer tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// PRESALE OPERATIONS
// =============================================================================
/**
 * @swagger
 * /api/contracts/presale/{contractAddress}/info:
 *   get:
 *     summary: Get presale information
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Presale contract address
 *     responses:
 *       200:
 *         description: Presale information
 *       404:
 *         description: Contract not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/presale/:contractAddress/info', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const presaleInfo = await smart_contracts_1.SmartContractService.getPresaleInfo(contractAddress);
        if (!presaleInfo) {
            res.status(404).json({
                success: false,
                error: 'Presale contract not found or invalid'
            });
            return;
        }
        res.json({
            success: true,
            presaleInfo
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get presale info failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get presale info',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/contracts/presale/{contractAddress}/buy:
 *   post:
 *     summary: Buy tokens from presale
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Presale contract address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *                 description: ETH amount to send
 *     responses:
 *       200:
 *         description: Purchase successful
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/presale/:contractAddress/buy', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { value } = req.body;
        if (!value) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: value'
            });
            return;
        }
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.executeTransaction(contractAddress, smart_contracts_1.SmartContractService['CONTRACT_ABIS'].PRESALE, 'buyTokens', [], value);
        res.json({
            success: true,
            transaction: result
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Presale purchase failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to purchase tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// STAKING OPERATIONS
// =============================================================================
/**
 * @swagger
 * /api/contracts/staking/{contractAddress}/info:
 *   get:
 *     summary: Get staking information
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Staking contract address
 *       - in: query
 *         name: userAddress
 *         schema:
 *           type: string
 *         description: User address for user-specific info
 *     responses:
 *       200:
 *         description: Staking information
 *       404:
 *         description: Contract not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/staking/:contractAddress/info', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { userAddress } = req.query;
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const stakingInfo = await smart_contracts_1.SmartContractService.getStakingInfo(contractAddress, userAddress);
        if (!stakingInfo) {
            res.status(404).json({
                success: false,
                error: 'Staking contract not found or invalid'
            });
            return;
        }
        res.json({
            success: true,
            stakingInfo
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get staking info failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get staking info',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/contracts/staking/{contractAddress}/stake:
 *   post:
 *     summary: Stake tokens
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Staking contract address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount to stake
 *     responses:
 *       200:
 *         description: Stake successful
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/staking/:contractAddress/stake', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { amount } = req.body;
        if (!amount) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: amount'
            });
            return;
        }
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.executeTransaction(contractAddress, smart_contracts_1.SmartContractService['CONTRACT_ABIS'].STAKING, 'stake', [amount]);
        res.json({
            success: true,
            transaction: result
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Staking failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to stake tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// CONTRACT CALLS (READ-ONLY)
// =============================================================================
/**
 * @swagger
 * /api/contracts/{contractAddress}/call:
 *   post:
 *     summary: Call contract method (read-only)
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - abi
 *               - method
 *             properties:
 *               abi:
 *                 type: array
 *                 description: Contract ABI
 *               method:
 *                 type: string
 *                 description: Method name to call
 *               args:
 *                 type: array
 *                 description: Method arguments
 *     responses:
 *       200:
 *         description: Call successful
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:contractAddress/call', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { abi, method, args = [] } = req.body;
        if (!abi || !method) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: abi, method'
            });
            return;
        }
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.callContract(contractAddress, abi, method, args);
        res.json({
            success: result.success,
            data: result.data,
            error: result.error
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Contract call failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to call contract',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// TRANSACTION EXECUTION
// =============================================================================
/**
 * @swagger
 * /api/contracts/{contractAddress}/execute:
 *   post:
 *     summary: Execute contract transaction
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - abi
 *               - method
 *             properties:
 *               abi:
 *                 type: array
 *                 description: Contract ABI
 *               method:
 *                 type: string
 *                 description: Method name to execute
 *               args:
 *                 type: array
 *                 description: Method arguments
 *               value:
 *                 type: string
 *                 description: ETH value to send
 *               gasLimit:
 *                 type: number
 *                 description: Gas limit
 *     responses:
 *       200:
 *         description: Transaction successful
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:contractAddress/execute', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { abi, method, args = [], value = '0', gasLimit } = req.body;
        if (!abi || !method) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: abi, method'
            });
            return;
        }
        if (!contractAddress) {
            res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.executeTransaction(contractAddress, abi, method, args, value, gasLimit);
        res.json({
            success: true,
            transaction: result
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transaction execution failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// NETWORK INFO
// =============================================================================
/**
 * @swagger
 * /api/contracts/network:
 *   get:
 *     summary: Get network information
 *     tags: [Smart Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Network information
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/network', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const networkId = await smart_contracts_1.SmartContractService.getNetworkId();
        res.json({
            success: true,
            network: {
                id: networkId,
                name: networkId === 1 ? 'Ethereum Mainnet' :
                    networkId === 3 ? 'Ropsten Testnet' :
                        networkId === 4 ? 'Rinkeby Testnet' :
                            networkId === 5 ? 'Goerli Testnet' :
                                networkId === 42 ? 'Kovan Testnet' :
                                    networkId === 137 ? 'Polygon Mainnet' :
                                        networkId === 80001 ? 'Polygon Mumbai' :
                                            'Unknown Network'
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get network info failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get network info',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * @swagger
 * /api/contracts/health:
 *   get:
 *     summary: Get smart contract service health status
 *     tags: [Smart Contracts]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 service:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 details:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                     networkId:
 *                       type: number
 *                     contractsCount:
 *                       type: number
 *                     deploymentsCount:
 *                       type: number
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = smart_contracts_1.SmartContractService.isHealthy();
        const networkId = await smart_contracts_1.SmartContractService.getNetworkId();
        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            service: 'smart-contracts',
            timestamp: new Date().toISOString(),
            details: {
                initialized: smart_contracts_1.SmartContractService.isHealthy(),
                networkId: networkId,
                contractsCount: 0, // Would be from service
                deploymentsCount: 0 // Would be from service
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Smart contract health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            service: 'smart-contracts',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=smart-contracts.js.map