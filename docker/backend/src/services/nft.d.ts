/**
 * NFT Service & Marketplace (Seaport Integration)
 *
 * Production-ready NFT marketplace leveraging existing Smart Contract integration:
 * - Multi-Tenant NFT Marketplace with Seaport execution
 * - Advanced Order Management (Fixed price, Dutch auctions, Offers, Bundles)
 * - Collection & Token Management with metadata pipeline
 * - Fund Segregation & Financial Integration
 * - Compliance & Security (KYC/AML, Sanctions screening)
 * - Real-time Indexing & Event Processing
 *
 * Built on existing Smart Contract, BlnkFinance, and Keycloak infrastructure
 */
export interface NFTCollection {
    id: string;
    tenantId: string;
    chainId: number;
    contractAddress: string;
    name: string;
    symbol: string;
    creator: string;
    royaltyBps: number;
    verified: boolean;
    totalSupply: number;
    mintedCount: number;
    floorPrice: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    owners: number;
    metadata: CollectionMetadata;
    policyFlags: PolicyFlags;
    createdAt: Date;
    updatedAt: Date;
}
export interface NFTToken {
    id: string;
    tenantId: string;
    collectionId: string;
    tokenId: string;
    owner: string;
    metadataUri: string;
    metadata: TokenMetadata;
    traits: TokenTrait[];
    rarityScore: number;
    rarityRank: number;
    lastSalePrice: number;
    lastSaleTimestamp: Date;
    lastRefreshedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface NFTOrder {
    id: string;
    tenantId: string;
    orderHash: string;
    maker: string;
    kind: OrderKind;
    side: OrderSide;
    offerItems: OrderItem[];
    considerationItems: OrderItem[];
    startTime: number;
    endTime: number;
    salt: string;
    counter: number;
    zone: string;
    conduitKey: string;
    totalPrice: number;
    currency: string;
    status: OrderStatus;
    feeRecipient: string;
    feeBps: number;
    policyFlags: PolicyFlags;
    signature: string;
    jsonBlob: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface NFTFill {
    id: string;
    tenantId: string;
    orderId: string;
    txHash: string;
    blockNumber: number;
    taker: string;
    amount: number;
    price: number;
    currency: string;
    feeAmount: number;
    royaltyAmount: number;
    timestamp: Date;
    createdAt: Date;
}
export interface NFTAuction {
    id: string;
    tenantId: string;
    orderId: string;
    tokenId: string;
    collectionId: string;
    seller: string;
    startPrice: number;
    endPrice: number;
    currentPrice: number;
    startTime: number;
    endTime: number;
    status: AuctionStatus;
    highestBidder: string;
    highestBid: number;
    reservePrice: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface NFTBundle {
    id: string;
    tenantId: string;
    orderId: string;
    items: BundleItem[];
    totalPrice: number;
    currency: string;
    seller: string;
    status: BundleStatus;
    createdAt: Date;
    updatedAt: Date;
}
export interface CollectionMetadata {
    name: string;
    description: string;
    image: string;
    externalLink: string;
    sellerFeeBasisPoints: number;
    feeRecipient: string;
    attributes: CollectionAttribute[];
}
export interface TokenMetadata {
    name: string;
    description: string;
    image: string;
    animationUrl?: string;
    externalUrl?: string;
    attributes: TokenAttribute[];
}
export interface TokenTrait {
    traitType: string;
    value: string | number;
    rarity: number;
    count: number;
}
export interface OrderItem {
    itemType: ItemType;
    token: string;
    identifier: string;
    amount: string;
}
export interface BundleItem {
    collectionId: string;
    tokenId: string;
    amount: number;
}
export interface CollectionAttribute {
    traitType: string;
    value: string;
    count: number;
}
export interface TokenAttribute {
    traitType: string;
    value: string | number;
}
export interface PolicyFlags {
    allowlistRequired: boolean;
    kycRequired: boolean;
    sanctionsScreening: boolean;
    royaltyEnforcement: boolean;
    custodyEnabled: boolean;
    bundleEnabled: boolean;
    auctionEnabled: boolean;
    offerEnabled: boolean;
}
export declare enum OrderKind {
    FIXED_PRICE = "FIXED_PRICE",
    DUTCH_AUCTION = "DUTCH_AUCTION",
    ENGLISH_AUCTION = "ENGLISH_AUCTION",
    BUNDLE = "BUNDLE",
    OFFER = "OFFER"
}
export declare enum OrderSide {
    SELL = "SELL",
    BUY = "BUY"
}
export declare enum OrderStatus {
    ACTIVE = "ACTIVE",
    FULFILLED = "FULFILLED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    INVALID = "INVALID"
}
export declare enum AuctionStatus {
    ACTIVE = "ACTIVE",
    ENDED = "ENDED",
    CANCELLED = "CANCELLED",
    SETTLED = "SETTLED"
}
export declare enum BundleStatus {
    ACTIVE = "ACTIVE",
    FULFILLED = "FULFILLED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED"
}
export declare enum ItemType {
    NATIVE = 0,
    ERC20 = 1,
    ERC721 = 2,
    ERC1155 = 3,
    ERC721_WITH_CRITERIA = 4,
    ERC1155_WITH_CRITERIA = 5
}
export declare class NFTService {
    private static isInitialized;
    private static collections;
    private static tokens;
    private static orders;
    private static fills;
    private static auctions;
    private static bundles;
    private static readonly SEAPORT_ADDRESSES;
    private static readonly DEFAULT_POLICY_FLAGS;
    /**
     * Initialize NFT Service
     */
    static initialize(): Promise<void>;
    /**
     * Create a new NFT collection
     */
    static createCollection(tenantId: string, chainId: number, contractAddress: string, name: string, symbol: string, creator: string, royaltyBps: number | undefined, // 2.5%
    metadata: CollectionMetadata, policyFlags?: PolicyFlags): Promise<NFTCollection>;
    /**
     * Create a sell order (fixed price)
     */
    static createSellOrder(tenantId: string, maker: string, tokenId: string, collectionId: string, price: number, currency?: string, startTime?: number, endTime?: number, // 30 days
    feeRecipient?: string, feeBps?: number): Promise<NFTOrder>;
    /**
     * Fulfill an order (buy/sell)
     */
    static fulfillOrder(tenantId: string, orderId: string, taker: string, txHash: string, blockNumber: number, amount: number, price: number): Promise<NFTFill>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static initializeSeaportContracts;
    private static loadExistingData;
    private static startIndexerWorkers;
    private static validateOrderCreation;
    private static validateOrderFulfillment;
    private static generateOrderHash;
    private static generateSalt;
    private static updateTokenOwnership;
    private static recordFinancialTransaction;
}
//# sourceMappingURL=nft.d.ts.map