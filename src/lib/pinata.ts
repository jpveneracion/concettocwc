// src/lib/pinata.ts

import { create } from 'ipfs-http-client';
import type { APISignature } from '@pinata/sdk';

// Pinata configuration
const PINATA_CONFIG = {
  apiKey: process.env.PINATA_API_KEY || '',
  apiSecret: process.env.PINATA_SECRET_API_KEY || '',
  gatewayUrl: process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
  jwtKey: process.env.PINATA_JWT_KEY || ''
};

/**
 * Validate Pinata configuration
 */
export function validatePinataConfig(): { valid: boolean; error?: string } {
  if (!PINATA_CONFIG.apiKey || !PINATA_CONFIG.apiSecret) {
    return { valid: false, error: 'Pinata API credentials not configured' };
  }

  if (!PINATA_CONFIG.jwtKey) {
    return { valid: false, error: 'Pinata JWT key not configured' };
  }

  return { valid: true };
}

/**
 * Upload file to Pinata IPFS
 */
export async function uploadToPinata(
  file: File | Buffer,
  options?: {
    name?: string;
    keyvalues?: Record<string, string>;
  }
): Promise<{ success: boolean; cid?: string; error?: string }> {
  try {
    const validation = validatePinataConfig();
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Prepare form data
    const formData = new FormData();

    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file]), 'screenshot.png');
    }

    // Add metadata
    const metadata = {
      name: options?.name || `payment-proof-${Date.now()}`,
      keyvalues: options?.keyvalues || {
        purpose: 'payment_verification',
        timestamp: new Date().toISOString()
      }
    };

    formData.append('pinataMetadata', JSON.stringify(metadata));

    // Pinata options for better persistence
    const pinataOptions = {
      cidVersion: 1,
      wrapWithDirectory: false,
      pinataOptions: {
        pinToIPFS: true,
        customPinPolicy: {
          regions: [
            {
              id: 'FRA1', // Frankfurt region
              desiredReplicationCount: 1
            },
            {
              id: 'NYC1', // New York region
              desiredReplicationCount: 1
            }
          ]
        }
      }
    };

    formData.append('pinataOptions', JSON.stringify(pinataOptions));

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_CONFIG.jwtKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Pinata upload failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return {
      success: true,
      cid: data.IpfsHash
    };

  } catch (error) {
    console.error('Pinata upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload to Pinata'
    };
  }
}

/**
 * Get Pinata gateway URL for CID
 */
export function getPinataUrl(cid: string): string {
  return `${PINATA_CONFIG.gatewayUrl}${cid}`;
}

/**
 * Validate file before upload
 */
export function validateScreenshotFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PNG and JPEG images are allowed' };
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  return { valid: true };
}

/**
 * Delete file from Pinata (unpin)
 */
export async function deleteFromPinata(cid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validatePinataConfig();
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${PINATA_CONFIG.jwtKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to unpin: ${response.statusText}`);
    }

    return { success: true };

  } catch (error) {
    console.error('Pinata delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete from Pinata'
    };
  }
}