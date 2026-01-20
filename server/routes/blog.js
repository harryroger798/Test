const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const { getSetting } = require('../database/db');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { logger } = require('../middleware/errorHandler');
const mailgunService = require('../services/mailgunService');

// Hash email for logging to avoid PII exposure (GDPR/CCPA compliance)
function hashEmail(email) {
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 12);
}

const router = express.Router();

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID || '75uz5ykn';
const SANITY_DATASET = process.env.SANITY_DATASET || 'production';
const SANITY_API_VERSION = process.env.SANITY_API_VERSION || '2024-01-01';
const SANITY_TOKEN = process.env.SANITY_API_TOKEN;

// Only create sanityClient if token is available
const sanityClient = SANITY_TOKEN ? axios.create({
  baseURL: `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/mutate/${SANITY_DATASET}`,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SANITY_TOKEN}`
  }
}) : null;

if (!SANITY_TOKEN) {
  logger.warn('SANITY_API_TOKEN not set - blog comments will not be stored in Sanity');
}

router.post('/comments', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('content').trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be 10-1000 characters'),
  body('postId').notEmpty().withMessage('Post ID is required'),
  body('honeypot').optional()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { name, email, content, postId, honeypot } = req.body;

  if (honeypot) {
    logger.warn('Honeypot triggered - spam detected', { emailHash: hashEmail(email), ip: req.ip });
    return res.json({
      success: true,
      message: 'Comment submitted for review'
    });
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  if (!sanityClient) {
    logger.warn('Sanity client not configured - comment not stored', { name, postId });
    return res.json({
      success: true,
      message: 'Comment submitted for review. It will appear after approval.'
    });
  }

  try {
    const comment = {
      _type: 'comment',
      name,
      email,
      content,
      post: {
        _type: 'reference',
        _ref: postId
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      ipAddress,
      userAgent
    };

    const response = await sanityClient.post('', {
      mutations: [{ create: comment }]
    });

    logger.info('Comment submitted to Sanity', { 
      postId, 
      name, 
      transactionId: response.data?.transactionId 
    });

    res.json({
      success: true,
      message: 'Comment submitted for review. It will appear after approval.',
      data: {
        transactionId: response.data?.transactionId
      }
    });
  } catch (error) {
    logger.error('Failed to submit comment to Sanity', {
      error: error.message,
      postId,
      name
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to submit comment',
      message: 'Please try again later'
    });
  }
}));

router.get('/comments/:postId', asyncHandler(async (req, res) => {
  const { postId } = req.params;

  // Validate postId format for basic sanity check
  if (!postId || !/^[a-zA-Z0-9_-]+$/.test(postId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid post ID format'
    });
  }

  try {
    // Use parameterized query with POST to prevent GROQ injection
    const response = await axios.post(
      `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}`,
      {
        query: `*[_type == "comment" && post._ref == $postId && status == "approved"] | order(createdAt desc) { _id, name, content, createdAt }`,
        params: { postId }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    res.json({
      success: true,
      data: response.data?.result || []
    });
  } catch (error) {
    logger.error('Failed to fetch comments from Sanity', {
      error: error.message,
      postId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      data: []
    });
  }
}));

router.post('/newsletter/subscribe', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('honeypot').optional()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, honeypot } = req.body;

  if (honeypot) {
    logger.warn('Newsletter honeypot triggered - spam detected', { emailHash: hashEmail(email), ip: req.ip });
    return res.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  }

  try {
    const mailgunApiKey = getSetting('mailgun_api_key');
    const mailgunDomain = getSetting('mailgun_domain') || 'mail.bytecare.shop';
    
    if (!mailgunApiKey) {
      logger.warn('Mailgun not configured for newsletter');
      return res.json({
        success: true,
        message: 'Successfully subscribed to newsletter'
      });
    }

    const businessName = getSetting('business_name') || 'ByteCare';

    const client = axios.create({
      baseURL: `https://api.mailgun.net/v3/${mailgunDomain}`,
      timeout: 8000,
      auth: {
        username: 'api',
        password: mailgunApiKey
      }
    });

    const formData = new URLSearchParams();
    formData.append('from', `${businessName} Newsletter <newsletter@${mailgunDomain}>`);
    formData.append('to', email);
    formData.append('subject', `Welcome to ${businessName} Newsletter!`);
    formData.append('html', generateWelcomeEmail(businessName, email));
    formData.append('text', `Welcome to ${businessName} Newsletter! Thank you for subscribing. You'll receive the latest tech tips, repair guides, and exclusive offers directly in your inbox.`);

    await client.post('/messages', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    logger.info('Newsletter subscription welcome email sent', { emailHash: hashEmail(email) });

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter! Check your email for confirmation.'
    });
  } catch (error) {
    logger.error('Failed to send newsletter welcome email', {
      error: error.message,
      emailHash: hashEmail(email)
    });
    
    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  }
}));

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function sanitizeColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#0EA5E9';
}

function generateWelcomeEmail(businessName, email) {
  const themeColor = sanitizeColor(getSetting('theme_color') || '#0EA5E9');
  const safeName = escapeHtml(businessName);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${safeName} Newsletter</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, ${themeColor} 0%, #0369a1 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to ${safeName}!</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Thank you for subscribing to our newsletter</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Hi there! 
              </p>
              <p style="margin: 0 0 20px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                You've successfully subscribed to the ${safeName} newsletter. Here's what you can expect:
              </p>
              <ul style="margin: 0 0 25px 0; padding-left: 20px; color: #64748b; font-size: 15px; line-height: 1.8;">
                <li>Latest tech tips and repair guides</li>
                <li>Exclusive offers and discounts</li>
                <li>Industry news and updates</li>
                <li>Device maintenance tips</li>
              </ul>
              <p style="margin: 0 0 25px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                We promise not to spam you - only valuable content delivered to your inbox!
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: ${themeColor}; border-radius: 8px;">
                    <a href="https://bytecare.shop/blog" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">Read Our Blog</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; padding: 25px 30px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px;">
                ${safeName} - Your Trusted Repair Partner
              </p>
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                Barrackpore, West Bengal, India
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = router;
