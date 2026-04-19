# CORS Configuration Fix for Vercel Deployment

## 🚨 Issue
The Vercel preview deployment cannot make network requests to the backend due to CORS (Cross-Origin Resource Sharing) restrictions.

## ✅ Solution Implemented

### 1. Dynamic CORS Configuration
Updated `apps/backend/src/main.ts` to handle dynamic origins:

```typescript
// Automatically allows:
// - Configured frontend URLs
// - All Vercel preview URLs (*.vercel.app)
// - Localhost for development
// - Custom domains from environment variables
```

### 2. Environment Variables Support
Added flexible environment configuration in `apps/backend/src/app/helpers/env.ts`:

```bash
# Backend Environment Variables
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://domain1.com,https://domain2.com,https://preview.vercel.app
NODE_ENV=production
```

### 3. CORS Debug Endpoints
Added debugging endpoints to help troubleshoot CORS issues:

- `GET /cors-test` - Test CORS functionality
- `GET /health-cors` - Health check with CORS info

### 4. Frontend CORS Test Tool
Added a CORS testing component accessible via "Test API Connection" button on the setup page.

## 🚀 Deployment Instructions

### For Vercel Frontend Deployment:

1. **Set Environment Variables in Vercel Dashboard:**
   ```bash
   VITE_API_URL=https://your-backend-url.com
   VITE_WS_URL=wss://your-backend-url.com/wss
   ```

2. **Backend Environment Variables:**
   ```bash
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ALLOWED_ORIGINS=https://yard-git-feature-comprehensive-improvements-waland1510.vercel.app,https://yard-waland1510.vercel.app
   NODE_ENV=production
   DATABASE_URL=your_database_url
   OPENROUTER_API_KEY=your_api_key
   ```

### For Backend Deployment:

1. **Railway/Heroku/Other Platform:**
   - Set the environment variables above
   - The CORS configuration will automatically allow Vercel preview URLs

2. **Custom Domain:**
   - Add your custom domain to `ALLOWED_ORIGINS`
   - Update `FRONTEND_URL` to your production domain

## 🔧 Testing CORS

### 1. Use the Built-in Test Tool:
- Visit your deployed frontend
- Click "Test API Connection" button (bottom right)
- Check which endpoints are working

### 2. Manual Testing:
```bash
# Test CORS from browser console
fetch('https://your-backend-url.com/cors-test')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### 3. Check Browser Network Tab:
- Look for CORS errors in browser console
- Check if preflight OPTIONS requests are successful
- Verify response headers include CORS headers

## 🐛 Troubleshooting

### Common Issues:

1. **"Access to fetch at '...' from origin '...' has been blocked by CORS policy"**
   - Backend needs to allow your frontend domain
   - Check `ALLOWED_ORIGINS` environment variable
   - Verify backend is running and accessible

2. **"Failed to fetch" or Network Error**
   - Backend might not be running
   - Check `VITE_API_URL` environment variable
   - Verify backend URL is correct and accessible

3. **Preflight Request Failed**
   - Backend needs to handle OPTIONS requests
   - Check if security plugin is properly configured
   - Verify CORS middleware is registered

### Debug Steps:

1. **Check Environment Variables:**
   ```bash
   # In browser console on frontend
   console.log('API URL:', import.meta.env.VITE_API_URL)
   console.log('Current Origin:', window.location.origin)
   ```

2. **Test Backend Directly:**
   ```bash
   curl -H "Origin: https://your-frontend-domain.com" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://your-backend-url.com/cors-test
   ```

3. **Check Backend Logs:**
   - Look for CORS rejection messages
   - Verify which origins are being allowed/rejected

## 📝 Configuration Examples

### Vercel Preview URL Pattern:
```typescript
// These patterns are automatically allowed:
// https://yard-*.vercel.app
// https://*-waland1510.vercel.app
// https://*.vercel.app (containing 'yard' or 'waland1510')
```

### Production Configuration:
```bash
# Backend (.env.production)
FRONTEND_URL=https://scotland-yard-game.com
ALLOWED_ORIGINS=https://scotland-yard-game.com,https://www.scotland-yard-game.com
NODE_ENV=production

# Frontend (.env.production)
VITE_API_URL=https://api.scotland-yard-game.com
VITE_WS_URL=wss://api.scotland-yard-game.com/wss
```

### Development Configuration:
```bash
# Backend (.env.development)
FRONTEND_URL=http://localhost:4200
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:3000
NODE_ENV=development

# Frontend (.env.development)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/wss
```

## 🔄 Quick Fix for Current Deployment

If you need an immediate fix for the current Vercel preview:

1. **Get the exact Vercel preview URL** from the deployment
2. **Add it to backend environment variables:**
   ```bash
   ALLOWED_ORIGINS=https://yard-git-feature-comprehensive-improvements-waland1510.vercel.app
   ```
3. **Redeploy the backend** with the new environment variable
4. **Test the connection** using the CORS test tool

## ✅ Verification Checklist

- [ ] Backend allows Vercel preview URLs
- [ ] Frontend has correct API URL configured
- [ ] CORS test tool shows successful connections
- [ ] Browser console shows no CORS errors
- [ ] API requests work in the application
- [ ] WebSocket connections work (if applicable)

## 📞 Support

If CORS issues persist:

1. Use the built-in CORS test tool to identify specific failing endpoints
2. Check browser console for detailed error messages
3. Verify environment variables are set correctly
4. Test backend endpoints directly with curl
5. Check backend logs for CORS rejection messages

The CORS configuration is now flexible and should automatically handle most deployment scenarios, including Vercel preview URLs.
