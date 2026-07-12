import { describe, it, expect } from '@jest/globals';
import { POST } from '@/app/api/auth/pi/callback/route';

describe('Pi Sign-in Callback', () => {
  it('should reject request without access token', async () => {
    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Access token required');
  });

  it('should reject invalid Pi token', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_token' })
    }));

    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({ access_token: 'invalid_token' })
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should process valid Pi token', async () => {
    const mockPiUser = { uid: 'test-pi-uid', username: 'testuser' };

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPiUser)
    }));

    const request = new Request('http://localhost:3000/api/auth/pi/callback', {
      method: 'POST',
      body: JSON.stringify({ access_token: 'valid_token' })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('redirect');
  });
});