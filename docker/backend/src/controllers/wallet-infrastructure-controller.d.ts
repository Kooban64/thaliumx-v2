/**
 * Wallet Infrastructure Controller
 *
 * Complete implementation matching original financial-svc
 * Handles wallet creation and management for users
 *
 * Features:
 * - Multi-currency wallet creation (FIAT, crypto, external)
 * - Wallet balance tracking via ledger integration
 * - Security settings management
 * - Wallet backup and recovery
 * - External wallet connection (MetaMask, WalletConnect)
 */
import { Request, Response } from 'express';
export declare class WalletInfrastructureController {
    /**
     * Create wallet infrastructure for new user
     * Creates FIAT wallet and optionally crypto wallets with ledger accounts
     */
    createUserWalletInfrastructure(req: Request, res: Response): Promise<void>;
    /**
     * Get user wallets
     */
    getUserWallets(req: Request, res: Response): Promise<void>;
    /**
     * Get wallet details
     */
    getWalletDetails(req: Request, res: Response): Promise<void>;
    /**
     * Get wallet balance - retrieves from ledger for accuracy
     */
    getWalletBalance(req: Request, res: Response): Promise<void>;
    /**
     * Update wallet status
     */
    updateWalletStatus(req: Request, res: Response): Promise<void>;
    /**
     * Get wallet transactions with pagination and filtering
     */
    getWalletTransactions(req: Request, res: Response): Promise<void>;
    /**
     * Create wallet transaction via ledger
     */
    createWalletTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Get external wallet providers
     */
    getExternalWalletProviders(_req: Request, res: Response): Promise<void>;
    /**
     * Connect external wallet
     */
    connectExternalWallet(req: Request, res: Response): Promise<void>;
    /**
     * Get wallet security settings
     */
    getWalletSecuritySettings(req: Request, res: Response): Promise<void>;
    /**
     * Update wallet security settings
     */
    updateWalletSecuritySettings(req: Request, res: Response): Promise<void>;
    /**
     * Get wallet backup information
     */
    getWalletBackup(req: Request, res: Response): Promise<void>;
    /**
     * Create wallet backup - encrypts wallet data for secure storage
     */
    createWalletBackup(req: Request, res: Response): Promise<void>;
    /**
     * Restore wallet from backup
     */
    restoreWalletFromBackup(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=wallet-infrastructure-controller.d.ts.map