-- Migration: Add configurable cost categories and cost breakdown
-- Run this in Neon's SQL Editor

-- Add cost_categories to company table
ALTER TABLE company
ADD COLUMN cost_categories JSONB DEFAULT '["materials", "labor", "overhead", "shipping"]';

-- Add cost_breakdown to quote_items table
ALTER TABLE quote_items
ADD COLUMN cost_breakdown JSONB DEFAULT '{}';

-- Migration complete
