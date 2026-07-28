/**
 * Type-safe database operations for product review system
 */

import { sql } from '@/lib/db';
import type {
  ProductLookupResult,
  UserRole,
  ProductUnit
} from '@/types/product';
import { ProductSource } from '@/types/product';
import type { CompanyProductDefinition } from '@/types/company-product';

