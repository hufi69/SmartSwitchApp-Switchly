# Security Setup Guide

## ⚠️ IMPORTANT: API Key Security

Your Firebase API key has been moved to environment variables for security. Follow these steps to complete the setup:

## 🔐 Step-by-Step Security Fix

### 1. **Revoke the Old API Key (DO THIS FIRST!)**

1. Go to [Google Cloud Console - API Credentials](https://console.cloud.google.com/apis/credentials)
2. Find the API key: `AIzaSyBajwnFuLDUY1ioE7Q7U7jiwtnrFMJ1_Zs`
3. **Delete/Revoke it immediately** to prevent unauthorized use

### 2. **Create a New API Key**

1. In Google Cloud Console, click **"Create Credentials"** → **"API Key"**
2. Copy your **NEW** API key
3. **Configure Restrictions:**
   - **Application restrictions**: Restrict to your app (Android package name or iOS bundle ID)
   - **API restrictions**: Restrict to **Firebase APIs only** (not all APIs)

### 3. **Update Your .env File**

1. Open `.env` file in the project root
2. Replace `EXPO_PUBLIC_FIREBASE_API_KEY` with your **NEW** API key:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_new_api_key_here
```

3. Save the file

### 4. **Restart Your Expo App**

After updating `.env`, restart Expo to load the new environment variables:

```bash
# Stop current Expo server (Ctrl+C)
# Then restart:
npx expo start --clear
```

### 5. **Verify It's Working**

- Check that your app connects to Firebase
- Verify device control still works
- Check that realtime database updates work

### 6. **Commit and Push**

```bash
git add .
git commit -m "Security: Move Firebase config to environment variables"
git push origin main
```

### 7. **Close GitHub Security Alert**

1. Go to your GitHub repository's security tab
2. Find the secret scanning alert
3. Click **"Close as"** → Select **"Revoked"** or **"False positive"**

---

## 📁 File Structure

- **`.env`** - Your actual secrets (DO NOT COMMIT - already in .gitignore)
- **`.env.example`** - Template file (safe to commit, no secrets)
- **`src/config/firebase.js`** - Now uses environment variables

---

## ✅ Security Checklist

- [ ] Old API key revoked in Google Cloud Console
- [ ] New API key created with restrictions
- [ ] `.env` file updated with new API key
- [ ] Expo app restarted and tested
- [ ] Code committed and pushed
- [ ] GitHub security alert closed

---

## 🛡️ Future Security Tips

1. **Never hardcode secrets** in your source code
2. **Always use environment variables** for API keys, passwords, etc.
3. **Check `.gitignore`** before committing (ensure `.env` is listed)
4. **Review GitHub's secret scanning alerts** regularly
5. **Rotate keys periodically** for better security

---

## 🆘 Troubleshooting

### App won't connect to Firebase?

- Check `.env` file exists and has correct values
- Restart Expo with `--clear` flag
- Verify environment variable names start with `EXPO_PUBLIC_`
- Check that `.env` file is in project root (not in `src/` folder)

### Environment variables not loading?

- Expo only reads `.env` at startup - restart Expo
- Variables must start with `EXPO_PUBLIC_` prefix for Expo
- Check file is named exactly `.env` (not `.env.local` or `.env.production`)

---

**Your app is now more secure! 🔒**

