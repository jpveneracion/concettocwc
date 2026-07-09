/**
 * Utility functions for managing wizard localStorage drafts
 */

import { WIZARD_DRAFT_KEY, WIZARD_DRAFT_BACKUP_KEY } from '../types/wizard';

/**
 * Clear a specific wizard draft from localStorage
 * @param quoteNumber - The quote number to clear the draft for
 */
export function clearDraft(quoteNumber: string): void {
  try {
    if (typeof window !== 'undefined') {
      // Clear the main draft
      localStorage.removeItem(`${WIZARD_DRAFT_KEY}_${quoteNumber}`);
      // Clear any backup draft
      localStorage.removeItem(`${WIZARD_DRAFT_BACKUP_KEY}_${quoteNumber}`);
    }
  } catch (error) {
    console.warn(`Error clearing wizard draft for quote ${quoteNumber}:`, error);
  }
}

/**
 * Clear all wizard drafts from localStorage (useful for testing/maintenance)
 */
export function clearAllWizardDrafts(): void {
  try {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(WIZARD_DRAFT_KEY) || key.startsWith(WIZARD_DRAFT_BACKUP_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn('Error clearing all wizard drafts:', error);
  }
}

/**
 * Backup current wizard draft before making major changes
 * @param quoteNumber - The quote number to backup
 */
export function backupDraft(quoteNumber: string): void {
  try {
    if (typeof window !== 'undefined') {
      const draftKey = `${WIZARD_DRAFT_KEY}_${quoteNumber}`;
      const backupKey = `${WIZARD_DRAFT_BACKUP_KEY}_${quoteNumber}`;
      const draftData = localStorage.getItem(draftKey);

      if (draftData) {
        localStorage.setItem(backupKey, draftData);
      }
    }
  } catch (error) {
    console.warn(`Error backing up wizard draft for quote ${quoteNumber}:`, error);
  }
}

/**
 * Check if a draft exists for a specific quote
 * @param quoteNumber - The quote number to check
 * @returns true if a draft exists, false otherwise
 */
export function hasDraft(quoteNumber: string): boolean {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`${WIZARD_DRAFT_KEY}_${quoteNumber}`) !== null;
    }
    return false;
  } catch (error) {
    console.warn(`Error checking wizard draft for quote ${quoteNumber}:`, error);
    return false;
  }
}

/**
 * Get all draft quote numbers (useful for showing restore options)
 * @returns Array of quote numbers that have drafts
 */
export function getAllDraftQuoteNumbers(): string[] {
  try {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      const draftKeys = keys.filter(key => key.startsWith(WIZARD_DRAFT_KEY) && !key.includes('backup'));
      return draftKeys.map(key => key.replace(`${WIZARD_DRAFT_KEY}_`, ''));
    }
    return [];
  } catch (error) {
    console.warn('Error getting all draft quote numbers:', error);
    return [];
  }
}