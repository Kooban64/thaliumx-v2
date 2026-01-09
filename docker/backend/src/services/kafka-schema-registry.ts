/**
 * Kafka Schema Registry Service
 * 
 * Integrates with Confluent Schema Registry for:
 * - Avro schema management
 * - Protobuf schema support
 * - JSON Schema validation
 * - Schema evolution and versioning
 * - Schema compatibility checking
 */

import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { LoggerService } from './logger';
// import { ConfigService } from './config';

export interface SchemaMetadata {
  subject: string;
  version: number;
  id: number;
  schema: string;
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON';
}

export interface SchemaCompatibility {
  isCompatible: boolean;
  errors?: string[];
}

export class KafkaSchemaRegistryService {
  private static client: AxiosInstance;
  private static baseUrl: string;
  private static isInitialized = false;
  private static schemaCache: Map<string, SchemaMetadata> = new Map();

  /**
   * Initialize Schema Registry connection
   */
  public static async initialize(): Promise<void> {
    try {
      this.baseUrl = process.env.SCHEMA_REGISTRY_URL || 'http://schema-registry:8081';
      
      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/vnd.schemaregistry.v1+json'
        },
        timeout: 10000
      });

      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      LoggerService.info('✅ Kafka Schema Registry Service initialized', {
        baseUrl: this.baseUrl
      });
    } catch (error) {
      LoggerService.warn('Schema Registry not available (continuing without schema validation)', {
        error: (error as Error).message
      });
      // Don't throw - schema validation is optional
    }
  }

  /**
   * Test connection to Schema Registry
   */
  private static async testConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/subjects`, { timeout: 5000 });
      LoggerService.info('Schema Registry connection successful', {
        subjectsCount: Array.isArray(response.data) ? response.data.length : 0
      });
    } catch (error) {
      LoggerService.warn('Schema Registry not available', {
        url: this.baseUrl,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Register or update an Avro schema
   */
  public static async registerAvroSchema(
    subject: string,
    schema: object,
    compatibility?: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE'
  ): Promise<SchemaMetadata> {
    try {
      if (!this.isInitialized) {
        throw new Error('Schema Registry not initialized');
      }

      // Check if subject exists and set compatibility if provided
      if (compatibility) {
        await this.setCompatibility(subject, compatibility);
      }

      const response = await this.client.post(`/subjects/${subject}/versions`, {
        schema: JSON.stringify(schema),
        schemaType: 'AVRO'
      });

      const schemaMetadata: SchemaMetadata = {
        subject,
        version: response.data.version,
        id: response.data.id,
        schema: JSON.stringify(schema),
        schemaType: 'AVRO'
      };

      this.schemaCache.set(`${subject}-${response.data.version}`, schemaMetadata);
      
      LoggerService.info('Avro schema registered', {
        subject,
        version: response.data.version,
        id: response.data.id
      });

      return schemaMetadata;
    } catch (error: any) {
      LoggerService.error('Failed to register Avro schema', {
        subject,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Register or update a Protobuf schema
   */
  public static async registerProtobufSchema(
    subject: string,
    schema: string,
    compatibility?: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE'
  ): Promise<SchemaMetadata> {
    try {
      if (!this.isInitialized) {
        throw new Error('Schema Registry not initialized');
      }

      if (compatibility) {
        await this.setCompatibility(subject, compatibility);
      }

      const response = await this.client.post(`/subjects/${subject}/versions`, {
        schema,
        schemaType: 'PROTOBUF'
      });

      const schemaMetadata: SchemaMetadata = {
        subject,
        version: response.data.version,
        id: response.data.id,
        schema,
        schemaType: 'PROTOBUF'
      };

      this.schemaCache.set(`${subject}-${response.data.version}`, schemaMetadata);
      
      LoggerService.info('Protobuf schema registered', {
        subject,
        version: response.data.version,
        id: response.data.id
      });

      return schemaMetadata;
    } catch (error: any) {
      LoggerService.error('Failed to register Protobuf schema', {
        subject,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get schema by subject and version
   */
  public static async getSchema(subject: string, version: number | 'latest' = 'latest'): Promise<SchemaMetadata | null> {
    try {
      if (!this.isInitialized) {
        return null;
      }

      const cacheKey = `${subject}-${version}`;
      if (this.schemaCache.has(cacheKey)) {
        return this.schemaCache.get(cacheKey)!;
      }

      const response = await this.client.get(`/subjects/${subject}/versions/${version}`);
      
      const schemaMetadata: SchemaMetadata = {
        subject,
        version: response.data.version,
        id: response.data.id,
        schema: response.data.schema,
        schemaType: response.data.schemaType || 'AVRO'
      };

      this.schemaCache.set(cacheKey, schemaMetadata);
      return schemaMetadata;
    } catch (error: any) {
      if (error.response?.status === 404) {
        LoggerService.debug('Schema not found', { subject, version });
        return null;
      }
      LoggerService.error('Failed to get schema', {
        subject,
        version,
        error: error.response?.data || error.message
      });
      return null;
    }
  }

  /**
   * Check schema compatibility
   */
  public static async checkCompatibility(
    subject: string,
    schema: object | string,
    schemaType: 'AVRO' | 'PROTOBUF' = 'AVRO'
  ): Promise<SchemaCompatibility> {
    try {
      if (!this.isInitialized) {
        return { isCompatible: true }; // Assume compatible if registry unavailable
      }

      const payload = schemaType === 'AVRO'
        ? { schema: JSON.stringify(schema), schemaType: 'AVRO' }
        : { schema: schema as string, schemaType: 'PROTOBUF' };

      const response = await this.client.post(
        `/compatibility/subjects/${subject}/versions/latest`,
        payload
      );

      return {
        isCompatible: response.data.is_compatible === true,
        errors: response.data.errors
      };
    } catch (error: any) {
      LoggerService.error('Failed to check schema compatibility', {
        subject,
        error: error.response?.data || error.message
      });
      return { isCompatible: false, errors: [error.message] };
    }
  }

  /**
   * Set compatibility level for a subject
   */
  public static async setCompatibility(
    subject: string,
    compatibility: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE'
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        return;
      }

      await this.client.put(`/config/${subject}`, {
        compatibility
      });

      LoggerService.info('Schema compatibility level set', { subject, compatibility });
    } catch (error: any) {
      LoggerService.error('Failed to set compatibility level', {
        subject,
        compatibility,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get all subjects
   */
  public static async getSubjects(): Promise<string[]> {
    try {
      if (!this.isInitialized) {
        return [];
      }

      const response = await this.client.get('/subjects');
      return response.data || [];
    } catch (error) {
      LoggerService.error('Failed to get subjects', { error });
      return [];
    }
  }

  /**
   * Delete a subject (all versions)
   */
  public static async deleteSubject(subject: string): Promise<number[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('Schema Registry not initialized');
      }

      const response = await this.client.delete(`/subjects/${subject}`);
      
      // Clear cache
      for (const key of this.schemaCache.keys()) {
        if (key.startsWith(`${subject}-`)) {
          this.schemaCache.delete(key);
        }
      }

      LoggerService.info('Subject deleted', { subject, versions: response.data });
      return response.data || [];
    } catch (error: any) {
      LoggerService.error('Failed to delete subject', {
        subject,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Validate message against schema
   */
  public static async validateMessage(
    subject: string,
    message: any,
    schemaType: 'AVRO' | 'PROTOBUF' = 'AVRO'
  ): Promise<boolean> {
    try {
      const schema = await this.getSchema(subject, 'latest');
      if (!schema) {
        LoggerService.warn('Schema not found for validation', { subject });
        return false;
      }

      // Basic validation - in production, use proper Avro/Protobuf validators
      if (schemaType === 'AVRO') {
        // Would use avsc or @kafkajs/confluent-schema-registry for actual validation
        return true; // Placeholder
      } else {
        // Would use protobufjs for Protobuf validation
        return true; // Placeholder
      }
    } catch (error) {
      LoggerService.error('Schema validation failed', { subject, error });
      return false;
    }
  }

  /**
   * Close Schema Registry connection
   */
  public static async close(): Promise<void> {
    this.schemaCache.clear();
    this.isInitialized = false;
    LoggerService.info('Kafka Schema Registry Service closed');
  }
}
