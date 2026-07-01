-- Migration: Add configurable cost categories and cost breakdown
-- Run this in Neon's SQL Editor
-- Purpose: Enable dashboard cost breakdown by category (materials, labor, overhead, shipping)

-- Add cost_categories to company table
ALTER TABLE company
ADD COLUMN IF NOT EXISTS cost_categories JSONB DEFAULT '["materials", "labor", "overhead", "shipping"]'::jsonb;

-- Add cost_breakdown to quote_items table
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '{}'::jsonb;

-- Migration complete
