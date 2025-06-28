# 🚀 Vercel Frontend + Render Backend Deployment Guide

This guide explains how to coordinate the Vercel frontend deployment with the Render backend deployment for the Scotland Yard game.

## 📋 Overview

- **Frontend**: Deployed on Vercel (React/Vite)
- **Backend**: Deployed on Render (Node.js/Fastify)
- **Database**: PostgreSQL (can be on Render or external)

## 🔧 Step-by-Step Setup

### 1. Backend Deployment on Render

#### A. Create Render Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `scotland-yard-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:backend`
   - **Start Command**: `npm run start:backend`
   - **Root Directory**: Leave empty (monorepo setup)

#### B. Set Environment Variables on Render
```bash
# Required Environment Variables
NODE_ENV=production
DATABASE_URL=your_postgresql_connection_string
OPENROUTER_API_KEY=your_openrouter_api_key

# CORS Configuration (IMPORTANT!)
FRONTEND_URL=https://your-vercel-app.vercel.app
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://yard-git-feature-comprehensive-improvements-waland1510.vercel.app

# Optional Performance Settings
CACHE_TTL=600000
RATE_LIMIT_MAX=1000
LOG_LEVEL=info
```

#### C. Get Your Render Backend URL
After deployment, your backend will be available at:
```
https://scotland-yard-backend.onrender.com
```
(Replace `scotland-yard-backend` with your actual service name)

### 2. Frontend Deployment on Vercel

#### A. Set Environment Variables in Vercel
1. Go to your Vercel project dashboard
2. Navigate to "Settings" → "Environment Variables"
3. Add the following variables:

```bash
# Backend Configuration
VITE_API_URL=https://scotland-yard-backend.onrender.com
VITE_WS_URL=wss://scotland-yard-backend.onrender.com/wss

# Optional Debug Settings
VITE_DEBUG=false
```

#### B. Build Settings (if needed)
- **Build Command**: `npm run build:frontend`
- **Output Directory**: `apps/frontend/dist`
- **Install Command**: `npm install`

### 3. Update Backend CORS for Your Vercel URL

Once you have your Vercel deployment URL, update the backend environment variables:

```bash
# On Render, update these environment variables:
FRONTEND_URL=https://your-actual-vercel-url.vercel.app
ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app,https://yard-git-feature-comprehensive-improvements-waland1510.vercel.app
```

## 🧪 Testing the Connection

### 1. Use the Built-in CORS Test Tool
1. Visit your Vercel deployment
2. Click "Test API Connection" button (bottom right)
3. Run "Quick Connectivity Test"
4. Check that both API and WebSocket show "Connected"

### 2. Manual Testing
```bash
# Test API endpoint
curl https://scotland-yard-backend.onrender.com/health

# Test CORS from browser console (on your Vercel site)
fetch('https://scotland-yard-backend.onrender.com/cors-test')
  .then(r => r.json())
  .then(console.log)
```

## 🔄 Auto-Configuration

The frontend now includes smart environment detection:

### Automatic URL Detection
If you don't set environment variables, the frontend will try to:
1. Use environment variables if set
2. Auto-detect Render backend URL patterns
3. Fall back to development defaults

### Common Patterns Detected
- `yard-frontend-xxx` → `yard-backend-xxx`
- `scotland-yard-xxx` → `scotland-yard-backend-xxx`
- Generic pattern matching for Render URLs

## 🚨 Troubleshooting

### Common Issues

#### 1. CORS Errors
**Symptoms**: "Access to fetch blocked by CORS policy"
**Solutions**:
- Verify `FRONTEND_URL` is set correctly on Render
- Add your exact Vercel URL to `ALLOWED_ORIGINS`
- Check that backend is deployed and accessible

#### 2. Network Errors
**Symptoms**: "Failed to fetch" or "Network Error"
**Solutions**:
- Verify `VITE_API_URL` points to correct Render URL
- Check that Render backend is running (not sleeping)
- Test backend URL directly in browser

#### 3. WebSocket Connection Fails
**Symptoms**: WebSocket connection errors in console
**Solutions**:
- Verify `VITE_WS_URL` uses `wss://` (not `ws://`)
- Check that Render supports WebSocket connections
- Ensure WebSocket endpoint is `/wss` on backend

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   # In browser console on Vercel site
   console.log('API URL:', import.meta.env.VITE_API_URL)
   console.log('WS URL:', import.meta.env.VITE_WS_URL)
   ```

2. **Test Backend Directly**:
   ```bash
   # Should return health status
   curl https://your-backend.onrender.com/health
   ```

3. **Check Render Logs**:
   - Go to Render dashboard
   - Check service logs for errors
   - Look for CORS rejection messages

## 📝 Example Configuration

### Render Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
OPENROUTER_API_KEY=sk-or-v1-xxxxx
FRONTEND_URL=https://yard-waland1510.vercel.app
ALLOWED_ORIGINS=https://yard-waland1510.vercel.app,https://yard-git-feature-comprehensive-improvements-waland1510.vercel.app
CACHE_TTL=600000
RATE_LIMIT_MAX=1000
LOG_LEVEL=info
```

### Vercel Environment Variables
```bash
VITE_API_URL=https://scotland-yard-backend.onrender.com
VITE_WS_URL=wss://scotland-yard-backend.onrender.com/wss
VITE_DEBUG=false
```

## 🔄 Deployment Workflow

### For Updates
1. **Push to GitHub** (triggers both deployments)
2. **Render** rebuilds backend automatically
3. **Vercel** rebuilds frontend automatically
4. **Test connectivity** using the built-in tool

### For Environment Changes
1. **Update Render environment variables**
2. **Restart Render service** (if needed)
3. **Update Vercel environment variables**
4. **Redeploy Vercel** (or wait for next push)

## ✅ Verification Checklist

- [ ] Backend deployed on Render and accessible
- [ ] Frontend deployed on Vercel
- [ ] Environment variables set correctly on both platforms
- [ ] CORS test shows successful API connection
- [ ] CORS test shows successful WebSocket connection
- [ ] Game functionality works end-to-end
- [ ] No CORS errors in browser console

## 🎯 Performance Tips

### Render Backend
- Use at least "Starter" plan to avoid cold starts
- Enable "Auto-Deploy" for automatic updates
- Monitor service health and logs

### Vercel Frontend
- Use "Pro" plan for better performance
- Enable "Edge Functions" if needed
- Monitor Core Web Vitals

## 📞 Support

If you encounter issues:

1. **Use the CORS test tool** first to identify the problem
2. **Check both Render and Vercel logs**
3. **Verify environment variables** are set correctly
4. **Test backend endpoints directly**
5. **Check browser network tab** for detailed error messages

The configuration is designed to be robust and handle most deployment scenarios automatically, but manual verification is always recommended.
