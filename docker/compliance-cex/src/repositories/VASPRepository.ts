/**
 * VASP Repository for CEX Compliance Service
 * Manages VASP (Virtual Asset Service Provider) registry data
 */

import { QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, QueryOptions, PaginatedResult } from './BaseRepository';
import { VASPTable } from '../types/database';
import { VASP } from '../types/compliance';
import { databaseService } from '../services/database';

// ==================== DTOs ====================

/**
 * DTO for creating a new VASP
 */
export interface CreateVASPDTO {
  name: string;
  lei?: string;
  registrationNumber: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  jurisdiction: string;
  website?: string;
  complianceContact: {
    name: string;
    email: string;
    phone?: string;
  };
  did?: string;
  publicKey?: string;
  status?: 'active' | 'suspended' | 'inactive';
}

/**
 * DTO for updating a VASP
 */
export interface UpdateVASPDTO {
  name?: string;
  lei?: string;
  registrationNumber?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postalCode?: string;
  };
  jurisdiction?: string;
  website?: string;
  complianceContact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  did?: string;
  publicKey?: string;
  status?: 'active' | 'suspended' | 'inactive';
}

// ==================== REPOSITORY ====================

/**
 * VASP Repository - Manages VASP registry data
 */
export class VASPRepository extends BaseRepository<VASPTable, CreateVASPDTO, UpdateVASPDTO> {
  protected readonly tableName = 'compliance.vasp_registry';
  protected readonly primaryKey = 'id';

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: QueryResultRow): VASPTable {
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      lei: row['lei'] as string | null,
      registration_number: row['registration_number'] as string,
      address_street: row['address_street'] as string,
      address_city: row['address_city'] as string,
      address_country: row['address_country'] as string,
      address_postal_code: row['address_postal_code'] as string,
      jurisdiction: row['jurisdiction'] as string,
      website: row['website'] as string | null,
      compliance_contact_name: row['compliance_contact_name'] as string,
      compliance_contact_email: row['compliance_contact_email'] as string,
      compliance_contact_phone: row['compliance_contact_phone'] as string | null,
      did: row['did'] as string | null,
      public_key: row['public_key'] as string | null,
      status: row['status'] as 'active' | 'suspended' | 'inactive',
      created_at: new Date(row['created_at'] as string),
      updated_at: new Date(row['updated_at'] as string),
    };
  }

  /**
   * Map entity to database row for insert
   */
  protected mapEntityToInsertRow(entity: CreateVASPDTO): Record<string, unknown> {
    return {
      id: uuidv4(),
      name: entity.name,
      lei: entity.lei ?? null,
      registration_number: entity.registrationNumber,
      address_street: entity.address.street,
      address_city: entity.address.city,
      address_country: entity.address.country,
      address_postal_code: entity.address.postalCode,
      jurisdiction: entity.jurisdiction,
      website: entity.website ?? null,
      compliance_contact_name: entity.complianceContact.name,
      compliance_contact_email: entity.complianceContact.email,
      compliance_contact_phone: entity.complianceContact.phone ?? null,
      did: entity.did ?? null,
      public_key: entity.publicKey ?? null,
      status: entity.status ?? 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Map entity to database row for update
   */
  protected mapEntityToUpdateRow(entity: UpdateVASPDTO): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.name !== undefined) row['name'] = entity.name;
    if (entity.lei !== undefined) row['lei'] = entity.lei;
    if (entity.registrationNumber !== undefined) row['registration_number'] = entity.registrationNumber;
    if (entity.address?.street !== undefined) row['address_street'] = entity.address.street;
    if (entity.address?.city !== undefined) row['address_city'] = entity.address.city;
    if (entity.address?.country !== undefined) row['address_country'] = entity.address.country;
    if (entity.address?.postalCode !== undefined) row['address_postal_code'] = entity.address.postalCode;
    if (entity.jurisdiction !== undefined) row['jurisdiction'] = entity.jurisdiction;
    if (entity.website !== undefined) row['website'] = entity.website;
    if (entity.complianceContact?.name !== undefined) row['compliance_contact_name'] = entity.complianceContact.name;
    if (entity.complianceContact?.email !== undefined) row['compliance_contact_email'] = entity.complianceContact.email;
    if (entity.complianceContact?.phone !== undefined) row['compliance_contact_phone'] = entity.complianceContact.phone;
    if (entity.did !== undefined) row['did'] = entity.did;
    if (entity.publicKey !== undefined) row['public_key'] = entity.publicKey;
    if (entity.status !== undefined) row['status'] = entity.status;

    return row;
  }

  /**
   * Convert database table row to VASP domain object
   */
  tableToVASP(table: VASPTable): VASP {
    const vasp: VASP = {
      id: table.id,
      name: table.name,
      registrationNumber: table.registration_number,
      address: {
        street: table.address_street,
        city: table.address_city,
        country: table.address_country,
        postalCode: table.address_postal_code,
      },
      jurisdiction: table.jurisdiction,
      complianceContact: {
        name: table.compliance_contact_name,
        email: table.compliance_contact_email,
      },
      status: table.status,
      createdAt: table.created_at,
      updatedAt: table.updated_at,
    };

    // Add optional fields only if they have values
    if (table.lei !== null) vasp.lei = table.lei;
    if (table.website !== null) vasp.website = table.website;
    if (table.compliance_contact_phone !== null) vasp.complianceContact.phone = table.compliance_contact_phone;
    if (table.did !== null) vasp.did = table.did;
    if (table.public_key !== null) vasp.publicKey = table.public_key;

    return vasp;
  }

  /**
   * Find VASP by registration number
   */
  async findByRegistrationNumber(registrationNumber: string): Promise<VASPTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE registration_number = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [registrationNumber]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find VASP by LEI
   */
  async findByLEI(lei: string): Promise<VASPTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE lei = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [lei]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find VASP by DID
   */
  async findByDID(did: string): Promise<VASPTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE did = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [did]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find VASPs by jurisdiction
   */
  async findByJurisdiction(jurisdiction: string, options?: QueryOptions): Promise<PaginatedResult<VASPTable>> {
    const filters = options?.filters ?? [];
    filters.push({ field: 'jurisdiction', operator: '=', value: jurisdiction });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find active VASPs
   */
  async findActive(options?: QueryOptions): Promise<PaginatedResult<VASPTable>> {
    const filters = options?.filters ?? [];
    filters.push({ field: 'status', operator: '=', value: 'active' });
    return this.findAll({ ...options, filters });
  }

  /**
   * Search VASPs by name
   */
  async searchByName(searchTerm: string, options?: QueryOptions): Promise<PaginatedResult<VASPTable>> {
    const filters = options?.filters ?? [];
    filters.push({ field: 'name', operator: 'ILIKE', value: `%${searchTerm}%` });
    return this.findAll({ ...options, filters });
  }

  /**
   * Update VASP status
   */
  async updateStatus(id: string, status: 'active' | 'suspended' | 'inactive'): Promise<VASPTable | null> {
    return this.update(id, { status });
  }

  /**
   * Get VASP statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    suspended: number;
    inactive: number;
    byJurisdiction: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive
      FROM ${this.tableName}
    `;
    const result = await databaseService.queryOne<{
      total: string;
      active: string;
      suspended: string;
      inactive: string;
    }>(query);

    const jurisdictionQuery = `
      SELECT jurisdiction, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'active'
      GROUP BY jurisdiction
    `;
    const jurisdictionResult = await databaseService.queryAll<{
      jurisdiction: string;
      count: string;
    }>(jurisdictionQuery);

    const byJurisdiction: Record<string, number> = {};
    for (const row of jurisdictionResult) {
      byJurisdiction[row.jurisdiction] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(result?.total ?? '0', 10),
      active: parseInt(result?.active ?? '0', 10),
      suspended: parseInt(result?.suspended ?? '0', 10),
      inactive: parseInt(result?.inactive ?? '0', 10),
      byJurisdiction,
    };
  }

  /**
   * Verify VASP exists and is active
   */
  async verifyActive(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 AND status = 'active' LIMIT 1`;
    const result = await databaseService.queryOne(query, [id]);
    return result !== null;
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton VASP repository instance
 */
export const vaspRepository = new VASPRepository();
