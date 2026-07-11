# OAuth Configuration Guide

Complete guide for configuring Google OAuth and Pi Network Sign-in for Concetto Blinds application.

## Google OAuth Setup

### 1. Create Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named "Concetto Blinds App"
3. Select the project after creation

### 2. Enable Required APIs

1. Navigate to "APIs & Services" → "Library"
2. Search for and enable:
   - Google+ API (or Google Identity API)
   - Google Identity Services API

### 3. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (for production) or "Internal" (for testing)
3. Fill required fields:
   - **App name**: Concetto Blinds
   - **App logo**: (optional) Upload your logo
   - **User support email**: Your support email
   - **Developer contact**: Your email

4. Scopes to add:
   - `openid`
   - `email` 
   - `profile`

5. Add test users (for external setup) or skip for internal

### 4. Create OAuth Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"

4. Configure:
   - **Name**: Concetto Blinds Web
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/callback/google
     https://yourdomain.com/api/auth/callback/google
     ```

5. Save and copy your credentials

### 5. Configure Environment Variables

Add to your `.env.local`:

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

## Pi Network Sign-in Setup

### 1. Create Pi Developer Account

1. Visit [Pi Developer Portal](https://developers.pi.com/)
2. Sign in with your Pi Network account
3. Create a new developer account if needed

### 2. Create Your App

1. Navigate to "Your Apps" → "Create App"
2. Fill app details:
   - **App name**: Concetto Blinds
   - **App description**: Window blinds management system
   - **App category**: Business/Productivity

### 3. Configure App Domain

1. Go to "Configuration" in your app
2. Set "Your App's URL":
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

3. Complete domain verification:
   - Create `validation-key.txt` in your public directory
   - Add the verification key provided by Pi
   - Upload to `https://yourdomain.com/validation-key.txt`
   - Click "Verify Domain"

### 4. Enable Pi Sign-in

1. In your app dashboard, go to "Pi Sign-in"
2. Toggle "Enabled" to ON
3. Copy your **OAuth Client ID** (this is public, no secret needed)

### 5. Register Redirect URIs

Add these redirect URIs in "Pi Sign-in" → "Redirect URIs":

```
http://localhost:3000/auth/pi/callback
https://yourdomain.com/auth/pi/callback
```

### 6. Configure Environment Variables

Add to your `.env.local`:

```bash
NEXT_PUBLIC_PI_CLIENT_ID=your_pi_client_id
```

## Testing Configuration

### Google OAuth Test

```bash
# Start development server
npm run dev

# Visit login page
http://localhost:3000/login

# Click "Sign in with Google"
# Should redirect to Google OAuth consent screen
```

### Pi Network Test

```bash
# Start development server  
npm run dev

# Visit login page
http://localhost:3000/login

# Click "Sign in with Pi Network"
# Should redirect to /auth/pi/signin with proper loading
```

## Troubleshooting

### Google OAuth Issues

**Error: redirect_uri_mismatch**
- Check that redirect URI in Google Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- Ensure no trailing slashes
- Check protocol (http vs https)

**Error: invalid_client**
- Verify GOOGLE_CLIENT_ID is correct
- Check for typos in environment variable
- Ensure Google+ API is enabled

### Pi Network Issues

**SDK not loading**
- Check browser console for errors
- Verify network connectivity
- Ensure `https://sdk.minepi.com/pi-sdk.js` is accessible

**Configuration error**
- Verify NEXT_PUBLIC_PI_CLIENT_ID is set
- Check that client ID matches Pi Developer Portal
- Ensure redirect URIs are registered in Pi Portal

**State mismatch error**
- Clear browser storage/session
- Check that state parameter is being generated correctly
- Verify CSRF protection is working

## Production Checklist

Before going live:

### Google OAuth
- [ ] Update redirect URIs to production domain
- [ ] Change OAuth consent screen to "External" if needed
- [ ] Add production domain to authorized JavaScript origins
- [ ] Test with real Google accounts

### Pi Network
- [ ] Verify domain ownership in Pi Portal
- [ ] Update redirect URIs to production domain
- [ ] Remove test users from OAuth consent screen
- [ ] Test with Pi Browser app

### Environment Variables
- [ ] Update all localhost URLs to production domain
- [ ] Never commit `.env.local` to version control
- [ ] Use strong, unique secrets in production
- [ ] Enable HTTPS for production (required)

## Security Best Practices

1. **Environment Variables**: Never commit `.env.local` to git
2. **HTTPS**: Always use HTTPS in production
3. **Redirect URIs**: Be specific with redirect URIs to prevent phishing
4. **Domain Verification**: Complete all domain verification steps
5. **Secrets Management**: Use proper secrets management in production
6. **Monitoring**: Monitor OAuth callback rates for abuse
7. **Token Storage**: Store tokens securely with encryption

## Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Pi Network Sign-in Guide](https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [OAuth 2.0 Specification](https://oauth.net/2/)