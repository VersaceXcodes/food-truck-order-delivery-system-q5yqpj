/**
 * server.mjs
 *
 * StreetEats Hub - MVP Backend Server
 * Implements REST API and Realtime WebSocket features.
 */

// --- Imports ---
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios'; // For making HTTP requests to external APIs
import querystring from 'querystring'; // For Stripe's form encoding

// --- Configuration ---
dotenv.config(); // Load .env variables right at the start

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow all origins for development - Restrict in production!
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 1337;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_replace_in_prod'; // Use a strong secret in production!
const SALT_ROUNDS = 10;
const STORAGE_DIR = path.join(__dirname, 'storage');
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`; // Base URL for constructing file URLs
const STORAGE_URL_PREFIX = '/storage/'; // How files will be accessed via URL

// External API Config from .env
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_CONNECT_ACCOUNT_ID_PLACEHOLDER = process.env.STRIPE_CONNECT_ACCOUNT_ID_PLACEHOLDER; // Example, replace with real account finding logic
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

// --- Database Setup ---
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
  database: PGDATABASE || "neondb",
  user: PGUSER || "neondb_owner", // Corrected 'username' to 'user'
  password: PGPASSWORD || "npg_jAS3aITLC5DX",
  port: 5432,
  ssl: {
    require: true,
  },
});

// Test DB connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring DB client', err.stack);
    process.exit(1); // Exit if DB connection fails
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      console.error('Error executing DB query', err.stack);
      process.exit(1);
    }
    console.log('Database connected:', result.rows[0].now);
  });
});


// --- Middleware ---
app.use(cors()); // Enable CORS for all origins
app.use(morgan('dev')); // Log HTTP requests
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- Ensure Storage Directory Exists ---
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log(`Storage directory created at: ${STORAGE_DIR}`);
}

// --- Static File Serving ---
// Serve files from the ./storage directory at the /storage URL path
app.use(STORAGE_URL_PREFIX, express.static(STORAGE_DIR));
console.log(`Serving static files from ${STORAGE_DIR} at ${BASE_URL}${STORAGE_URL_PREFIX}`);

// --- File Upload Setup (Multer) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, STORAGE_DIR);
  },
  filename: function (req, file, cb) {
    const unique_suffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${unique_suffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        // Pass error to central handler
        return cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed!'), false);
    }
    cb(null, true);
  }
});


// --- Authentication Middleware ---

/**
 * Verifies the JWT token from the Authorization header.
 * Attaches the decoded user payload to req.user if valid.
 */
const authenticate_token = (req, res, next) => {
  const auth_header = req.headers['authorization'];
  const token = auth_header && auth_header.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.status(401).json({ error: 'Authentication required: No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user_payload) => {
    if (err) {
        console.error("JWT Verification Error:", err.message);
         if (err instanceof jwt.TokenExpiredError) {
             return res.status(401).json({ error: 'Authentication failed: Token expired.' });
         }
        return res.status(403).json({ error: 'Authentication failed: Invalid token.' });
    }
    req.user = user_payload; // Contains { uid, role, email, etc. }
    next();
  });
};

/**
 * Middleware factory to require a specific user role.
 * Must be used after authenticate_token.
 * @param {string} required_role - The role required ('customer' or 'operator').
 */
const require_role = (required_role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== required_role) {
      return res.status(403).json({ error: `Access denied: Requires '${required_role}' role.` });
    }
    next();
  };
};

// --- Helper Functions ---

/**
 * Generates a JWT token for a user.
 * @param {object} user - User object containing uid, role, email.
 * @returns {string} - The JWT token.
 */
const generate_auth_token = (user) => {
  const payload = {
    uid: user.uid,
    role: user.role,
    email: user.email,
    // Add food_truck_uid if operator
    ...(user.role === 'operator' && user.food_truck_uid && { food_truck_uid: user.food_truck_uid })
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }); // Token expires in 24 hours
};

/**
 * Calculates distance between two lat/lon points using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers.
 */
const calculate_distance_km = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
        return Infinity; // Cannot calculate if coords are missing
    }
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat)/2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon))/2;

    return R * 2 * Math.asin(Math.sqrt(a));
}

// --- Real External API Functions ---

/**
 * Sends an email using SendGrid API.
 * @param {object} params - Email details.
 * @param {string} params.to - Recipient email address.
 * @param {string} params.subject - Email subject.
 * @param {string} params.text_body - Plain text email body.
 * @param {string} [params.html_body] - HTML email body (optional).
 * @returns {object} Success indicator and potentially message ID.
 * @throws {Error} If sending fails.
 */
const send_email = async ({ to, subject, text_body, html_body }) => {
    if (!SENDGRID_API_KEY || !SENDER_EMAIL) {
        console.warn('SendGrid API Key or Sender Email not configured. Skipping real email send.');
        return { success: true, message_id: `skipped_${uuidv4()}` }; // Simulate success if not configured
    }
    const url = 'https://api.sendgrid.com/v3/mail/send';
    const content = [{ type: 'text/plain', value: text_body }];
    if (html_body) {
        content.push({ type: 'text/html', value: html_body });
    }
    const body = {
        personalizations: [{ to: [{ email: to }], subject: subject }],
        from: { email: SENDER_EMAIL },
        content: content,
    };
    try {
        const response = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        // SendGrid returns 202 Accepted on success
        if (response.status === 202) {
            console.log(`Email successfully queued via SendGrid to ${to}`);
            const messageIdHeader = response.headers['x-message-id'];
            return { success: true, message_id: messageIdHeader || `sendgrid_${Date.now()}` };
        } else {
            console.error(`SendGrid API Error (${response.status}): ${response.statusText}`, response.data);
            throw new Error(`Failed to send email via SendGrid: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error calling SendGrid API:', error.response?.data || error.message);
        throw new Error(`SendGrid API request failed: ${error.message}`);
    }
};

/**
 * Creates a Stripe PaymentIntent to authorize/charge a payment.
 * @param {object} params - Payment details.
 * @param {number} params.amount - Amount in cents/smallest unit.
 * @param {string} params.currency - Currency code (e.g., 'usd').
 * @param {string} params.payment_method_token - Stripe PaymentMethod ID (pm_...).
 * @param {string} [params.customer_id] - Stripe Customer ID (cus_...).
 * @param {boolean} [params.capture] - Whether to capture immediately (default true).
 * @returns {object} Object containing charge/intent details on success.
 * @throws {Error} If payment fails.
 */
const create_payment_charge = async ({ amount, currency, payment_method_token, customer_id, capture = true }) => {
    if (!STRIPE_SECRET_KEY) {
        console.warn('Stripe Secret Key not configured. Simulating successful payment.');
        // Simulate success but return mock IDs for testing flow
        const mockChargeId = `mock_ch_${uuidv4()}`;
        const mockIntentId = `mock_pi_${uuidv4()}`;
         return {
            success: true, charge_id: mockChargeId, payment_intent_id: mockIntentId,
            status: capture ? 'succeeded' : 'requires_capture', amount: amount, currency: currency,
            customer: customer_id, payment_method: payment_method_token, captured: capture
        };
    }
    const url = 'https://api.stripe.com/v1/payment_intents';
    const headers = {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = {
        amount: amount,
        currency: currency.toLowerCase(),
        payment_method: payment_method_token,
        confirm: true,
        capture_method: capture ? 'automatic' : 'manual',
        ...(customer_id && { customer: customer_id }),
        // Add 'setup_future_usage: 'off_session'' if saving card for later use without user
    };
    try {
        const response = await axios.post(url, querystring.stringify(data), { headers });
        const paymentIntent = response.data;
        console.log(`Stripe PaymentIntent: ${paymentIntent.id}, Status: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded' || (paymentIntent.status === 'requires_capture' && !capture)) {
            return {
                success: true, charge_id: paymentIntent.latest_charge, payment_intent_id: paymentIntent.id,
                status: paymentIntent.status, amount: paymentIntent.amount, currency: paymentIntent.currency,
                customer: paymentIntent.customer, payment_method: paymentIntent.payment_method, captured: paymentIntent.status === 'succeeded',
            };
        } else if (paymentIntent.status === 'requires_action') {
            throw new Error(`Payment requires further action (e.g., 3D Secure). Status: ${paymentIntent.status}`);
        } else {
            const declineCode = paymentIntent.last_payment_error?.decline_code;
            throw new Error(`Payment failed with status: ${paymentIntent.status}${declineCode ? ` (${declineCode})` : ''}`);
        }
    } catch (error) {
        console.error('Error calling Stripe API (PaymentIntents):', error.response?.data || error.message);
        const stripeError = error.response?.data?.error;
        throw new Error(stripeError?.message || 'Failed to create payment charge via Stripe');
    }
};

/**
 * Refunds a Stripe charge.
 * @param {object} params - Refund details.
 * @param {string} params.charge_id - The Stripe Charge ID (ch_...).
 * @param {number} [params.amount] - Amount to refund in cents (optional, defaults to full).
 * @returns {object} Refund details on success.
 * @throws {Error} If refund fails.
 */
const refund_payment_charge = async ({ charge_id, amount }) => {
     if (!STRIPE_SECRET_KEY) {
        console.warn(`Stripe Secret Key not configured. Simulating successful refund for charge ${charge_id}.`);
        return { success: true, refund_id: `mock_re_${uuidv4()}`, charge_id: charge_id, amount: amount || 'full', status: 'succeeded' };
    }
    if (!charge_id || !charge_id.startsWith('ch_')) {
         // If using PaymentIntents, the ID might be pi_... - need the charge ID from pi.latest_charge
         console.error(`Invalid charge_id provided for refund: ${charge_id}. Must be a 'ch_...' ID.`);
         throw new Error(`Invalid charge_id provided for refund.`);
    }
    const url = 'https://api.stripe.com/v1/refunds';
    const headers = {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = { charge: charge_id, ...(amount && { amount: amount }) };
    try {
        const response = await axios.post(url, querystring.stringify(data), { headers });
        const refund = response.data;
        console.log(`Stripe Refund: ${refund.id}, Status: ${refund.status}`);
        if (refund.status === 'succeeded' || refund.status === 'pending') {
            return { success: true, refund_id: refund.id, charge_id: refund.charge, amount: refund.amount, currency: refund.currency, status: refund.status };
        } else {
            throw new Error(`Refund failed with status: ${refund.status}`);
        }
    } catch (error) {
        console.error('Error calling Stripe API (Refunds):', error.response?.data || error.message);
        const stripeError = error.response?.data?.error;
        throw new Error(stripeError?.message || 'Failed to create refund via Stripe');
    }
};

/**
 * Attaches a Stripe PaymentMethod to a Stripe Customer.
 * @param {object} params - Details.
 * @param {string} params.customer_id - Stripe Customer ID (cus_...).
 * @param {string} params.payment_method_token - Stripe PaymentMethod ID (pm_...).
 * @returns {object} Attached PaymentMethod details.
 * @throws {Error} If attaching fails.
 */
const save_payment_method = async ({ customer_id, payment_method_token }) => {
     if (!STRIPE_SECRET_KEY) {
        console.warn('Stripe Secret Key not configured. Simulating successful payment method save.');
        const mockSavedId = `mock_pm_${uuidv4()}`;
        return { id: mockSavedId, customer: customer_id, type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2025 }};
    }
    const payment_method_id = payment_method_token;
    const url = `https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach`;
    const headers = {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = { customer: customer_id };
    try {
        const response = await axios.post(url, querystring.stringify(data), { headers });
        const attachedPaymentMethod = response.data;
        console.log(`Stripe PaymentMethod attached: ${attachedPaymentMethod.id} to Customer: ${attachedPaymentMethod.customer}`);
        return {
            id: attachedPaymentMethod.id, customer: attachedPaymentMethod.customer, type: attachedPaymentMethod.type,
            ...(attachedPaymentMethod.card && { card: { brand: attachedPaymentMethod.card.brand, last4: attachedPaymentMethod.card.last4, exp_month: attachedPaymentMethod.card.exp_month, exp_year: attachedPaymentMethod.card.exp_year } }),
        };
    } catch (error) {
        console.error('Error calling Stripe API (Attach PaymentMethod):', error.response?.data || error.message);
        const stripeError = error.response?.data?.error;
        throw new Error(stripeError?.message || 'Failed to attach payment method via Stripe');
    }
};

/**
 * Detaches a Stripe PaymentMethod from its customer.
 * @param {object} params - Details.
 * @param {string} params.payment_method_id - Stripe PaymentMethod ID (pm_...).
 * @returns {object} Detachment confirmation.
 * @throws {Error} If detaching fails.
 */
const delete_payment_method = async ({ payment_method_id }) => {
     if (!STRIPE_SECRET_KEY) {
        console.warn(`Stripe Secret Key not configured. Simulating successful payment method deletion for ${payment_method_id}.`);
        return { id: payment_method_id, deleted: true };
    }
    const url = `https://api.stripe.com/v1/payment_methods/${payment_method_id}/detach`;
    const headers = { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` };
    try {
        const response = await axios.post(url, null, { headers });
        if (response.status === 200) {
           const detachedPaymentMethod = response.data;
           console.log(`Stripe PaymentMethod detached: ${detachedPaymentMethod.id}`);
           return { id: detachedPaymentMethod.id, deleted: true };
        } else {
           throw new Error(`Failed to detach payment method, status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error calling Stripe API (Detach PaymentMethod):', error.response?.data || error.message);
        const stripeError = error.response?.data?.error;
        throw new Error(stripeError?.message || 'Failed to detach payment method via Stripe');
    }
};

/**
 * Placeholder/Mock for getting or creating a Stripe Connect Account ID.
 * In a real app, this needs DB lookup and/or Stripe API calls.
 */
const getOrCreateStripeAccount = async (email, client) => {
    console.warn(`Using placeholder logic for getOrCreateStripeAccount for email: ${email}`);
    // 1. Check local DB if you store mapping of operator_user_uid to acct_...
    // 2. If not found, potentially call Stripe API: GET /v1/accounts?email={email}&limit=1
    // 3. If still not found, call Stripe API: POST /v1/accounts { type: 'express', email: email }
    // 4. Store the new acct_... in your DB linked to the operator_user_uid
    // Using placeholder from .env for now:
    if (!STRIPE_CONNECT_ACCOUNT_ID_PLACEHOLDER) {
        throw new Error("Stripe Connect Account ID placeholder not configured in .env");
    }
    return STRIPE_CONNECT_ACCOUNT_ID_PLACEHOLDER;
};

/**
 * Creates a Stripe Connect Account Link for onboarding/updating payout details.
 * @param {object} params - Details.
 * @param {string} params.operator_email - Operator's email.
 * @param {string} params.return_url - URL to redirect back to.
 * @param {string} params.refresh_url - URL if link expires.
 * @returns {object} Contains the onboarding URL.
 * @throws {Error} If link creation fails.
 */
const initiate_payout_onboarding = async ({ operator_email, return_url, refresh_url }, dbClient) => {
     if (!STRIPE_SECRET_KEY) {
        console.warn('Stripe Secret Key not configured. Simulating successful payout onboarding initiation.');
        const mockUrl = `https://mock-connect.stripe.com/onboarding/${uuidv4()}`;
        return { onboarding_url: mockUrl };
    }
    // Get the Stripe Account ID (acct_...) - requires implementation/placeholder
    const accountId = await getOrCreateStripeAccount(operator_email, dbClient);
    if (!accountId) { throw new Error(`Could not find or create Stripe account for email: ${operator_email}`); }

    const url = 'https://api.stripe.com/v1/account_links';
    const headers = {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = {
        account: accountId,
        refresh_url: refresh_url,
        return_url: return_url,
        type: 'account_onboarding', // Or 'account_update' based on real account status check
    };
    try {
        const response = await axios.post(url, querystring.stringify(data), { headers });
        const accountLink = response.data;
        console.log(`Stripe Account Link created: Expires at ${new Date(accountLink.expires_at * 1000)}`);
        return { onboarding_url: accountLink.url };
    } catch (error) {
        console.error('Error calling Stripe API (Account Links):', error.response?.data || error.message);
        const stripeError = error.response?.data?.error;
        throw new Error(stripeError?.message || 'Failed to initiate payout onboarding via Stripe');
    }
};

/**
 * Geocodes an address string to coordinates using Mapbox API.
 * @param {object} params - Details.
 * @param {string} params.address - The address string.
 * @returns {object} Contains latitude and longitude.
 * @throws {Error} If geocoding fails.
 */
const geocode_address = async ({ address }) => {
    if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('Mapbox Access Token not configured. Returning mock coordinates.');
        return { latitude: 34.0522 + (Math.random() - 0.5) * 0.1, longitude: -118.2437 + (Math.random() - 0.5) * 0.1 };
    }
    if (!address) { throw new Error("Address cannot be empty for geocoding."); }
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
    try {
        const response = await axios.get(url);
        const data = response.data;
        if (data && data.features && data.features.length > 0) {
            const [longitude, latitude] = data.features[0].geometry.coordinates;
            console.log(`Geocoded "${address}" to [Lat: ${latitude}, Lon: ${longitude}]`);
            return { latitude, longitude };
        } else {
            throw new Error("Geocoding failed: No results found for address");
        }
    } catch (error) {
        console.error('Error calling Mapbox Geocoding API:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to geocode address via Mapbox');
    }
};

/**
 * Reverse geocodes coordinates to an address string using Mapbox API.
 * @param {object} params - Details.
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @returns {object} Contains the address string.
 * @throws {Error} If reverse geocoding fails.
 */
const reverse_geocode_coords = async ({ latitude, longitude }) => {
    if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('Mapbox Access Token not configured. Returning mock address.');
        return { address: `${Math.round(Math.random()*1000)} Mock St, Mock City, MC 12345` };
    }
    if (latitude == null || longitude == null) { throw new Error("Latitude and Longitude are required for reverse geocoding."); }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=address`;
    try {
        const response = await axios.get(url);
        const data = response.data;
        if (data && data.features && data.features.length > 0) {
            const address = data.features[0].place_name;
            console.log(`Reverse Geocoded [Lat: ${latitude}, Lon: ${longitude}] to "${address}"`);
            return { address: address };
        } else {
            console.log(`No reverse geocoding results found for coords: ${latitude}, ${longitude}`);
            return { address: "Address not found" }; // Return default instead of throwing error?
        }
    } catch (error) {
        console.error('Error calling Mapbox Reverse Geocoding API:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to reverse geocode coordinates via Mapbox');
    }
};


// --- Socket.IO Setup ---

// Socket Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log("Socket connection rejected: No token provided.");
    return next(new Error("Authentication error: No token provided."));
  }

  jwt.verify(token, JWT_SECRET, (err, user_payload) => {
    if (err) {
      console.log("Socket connection rejected: Invalid token.");
      return next(new Error("Authentication error: Invalid token."));
    }
    // Attach user info to the socket instance
    socket.data.user = user_payload;
    console.log(`Socket authenticated: User ${user_payload.uid} (${user_payload.role})`);
    next();
  });
});

// Socket Connection Handler
io.on('connection', (socket) => {
  const user = socket.data.user;
  if (!user) {
      console.error("Socket connected without user data after auth middleware. Disconnecting.");
      socket.disconnect(true);
      return;
  }
  console.log(`User connected: ${user.uid} (${user.role}) - Socket ID: ${socket.id}`);

  // Join a room based on user UID for targeted messaging
  // Use separate prefixes for roles to avoid potential clashes if UIDs were ever reused across types (unlikely with UUIDs)
  const user_room = `${user.role}_${user.uid}`;
  socket.join(user_room);
  console.log(`User ${user.uid} joined room: ${user_room}`);

  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${user.uid} (${user.role}) - Socket ID: ${socket.id}. Reason: ${reason}`);
  });

  // Example: Handle a client event (if needed later)
  // socket.on('client_event_name', (data) => {
  //   console.log(`Received client_event_name from ${user.uid}:`, data);
  //   // Process event...
  // });
});

/**
 * Emits a WebSocket event to a specific user's room.
 * @param {string} user_role - 'customer' or 'operator'.
 * @param {string} user_uid - The UID of the target user.
 * @param {string} event_name - The name of the event to emit (e.g., 'new_order_for_operator').
 * @param {object} data - The payload data for the event.
 */
const emit_to_user = (user_role, user_uid, event_name, data) => {
  const room_name = `${user_role}_${user_uid}`;
  console.log(`Emitting event '${event_name}' to room '${room_name}'`);
  // Structure matches AsyncAPI spec: top-level 'event' and 'data' keys
  io.to(room_name).emit(event_name, { event: event_name, data: data });
};


// --- REST API Endpoints ---

// --- II.B.1. Authentication ---

// 1. POST /auth/signup/customer
app.post('/auth/signup/customer', async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields: first_name, last_name, email, password.' });
  }
  // Basic email format check
  if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
  }
  // Basic password length check (add more rules in production)
   if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
   }

  let client;
  try {
    const uid = uuidv4();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = Date.now();

    client = await pool.connect();
    const insert_query = `
      INSERT INTO users (uid, first_name, last_name, email, password_hash, role, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'customer', TRUE, $6, $7)
      RETURNING uid, first_name, last_name, email, role, phone_number, email_verified;
    `; // Setting email_verified=TRUE for MVP simplicity
    const values = [uid, first_name, last_name, email.toLowerCase(), password_hash, now, now];

    const result = await client.query(insert_query, values);
    const new_user = result.rows[0];

    const auth_token = generate_auth_token(new_user);

    res.status(201).json({
      user: { // Ensure response matches BRD schema
          uid: new_user.uid,
          first_name: new_user.first_name,
          last_name: new_user.last_name,
          email: new_user.email,
          role: new_user.role,
          phone_number: new_user.phone_number,
          email_verified: new_user.email_verified
      },
      auth_token: auth_token
    });

  } catch (err) {
    console.error("Error during customer signup:", err);
    if (err.code === '23505' && err.constraint === 'users_email_key') { // Unique violation on email
      res.status(409).json({ error: 'Email address already in use.' });
    } else {
      res.status(500).json({ error: 'Failed to create customer account.' });
    }
  } finally {
    if (client) client.release();
  }
});

// 2. POST /auth/signup/operator
app.post('/auth/signup/operator', async (req, res) => {
  const { operator_first_name, operator_last_name, email, password, food_truck_name, cuisine_type } = req.body;

  if (!operator_first_name || !operator_last_name || !email || !password || !food_truck_name || !cuisine_type) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
   if (!/\S+@\S+\.\S+/.test(email)) { return res.status(400).json({ error: 'Invalid email format.' }); }
   if (password.length < 6) { return res.status(400).json({ error: 'Password must be at least 6 characters long.' }); }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction

    // Insert User
    const user_uid = uuidv4();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = Date.now();
    const insert_user_query = `
      INSERT INTO users (uid, first_name, last_name, email, password_hash, role, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'operator', FALSE, $6, $7);
    `;
    await client.query(insert_user_query, [user_uid, operator_first_name, operator_last_name, email.toLowerCase(), password_hash, now, now]);

    // Insert Food Truck (with defaults from schema where needed)
    const truck_uid = uuidv4();
    const insert_truck_query = `
      INSERT INTO food_trucks
      (uid, operator_user_uid, name, cuisine_type, current_status, payout_configured_status, average_preparation_minutes, delivery_enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'offline', 'not_configured', 15, FALSE, $5, $6);
    `; // Using schema defaults
    await client.query(insert_truck_query, [truck_uid, user_uid, food_truck_name, cuisine_type, now, now]);

    await client.query('COMMIT'); // Commit transaction

    // Send verification email (using the real function now)
    const verification_token = jwt.sign({ uid: user_uid, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '1h' }); // Simple token for mock verification link
    // Construct the verification URL based on your frontend setup
    const verification_link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verification_token}`;
    await send_email({
        to: email.toLowerCase(),
        subject: 'Verify Your StreetEats Hub Operator Account',
        text_body: `Welcome to StreetEats Hub! Please verify your email address by clicking this link: ${verification_link}\n\nIf you did not sign up, please ignore this email.`,
        html_body: `<p>Welcome to StreetEats Hub!</p><p>Please verify your email address by clicking this link:</p><p><a href="${verification_link}">${verification_link}</a></p><p>If you did not sign up, please ignore this email.</p>`
    });

    res.status(201).json({
      message: "Operator account created. Please check your email to verify your account."
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK'); // Rollback on error
    console.error("Error during operator signup:", err);
    if (err.code === '23505') { // Unique violation
      if (err.constraint === 'users_email_key') {
          res.status(409).json({ error: 'Email address already in use.' });
      } else if (err.constraint === 'food_trucks_operator_user_uid_key') {
          res.status(409).json({ error: 'An operator account already exists for this user.' }); // Should be rare
      } else {
           res.status(409).json({ error: 'A conflict occurred. Please try again.' }); // Generic conflict
      }
    } else {
      res.status(500).json({ error: 'Failed to create operator account.' });
    }
  } finally {
    if (client) client.release();
  }
});

// 3. POST /auth/verify_email (Receives token from frontend after user clicks link)
app.post('/auth/verify_email', async (req, res) => {
  const { token } = req.body; // Expect token in body now

  if (!token) {
    return res.status(400).json({ error: 'Verification token is missing.' });
  }

  let client;
  try {
    // Verify the token structure and expiry
    const decoded = jwt.verify(token, JWT_SECRET);
    // Optionally check token purpose if you add one during generation
    const user_uid = decoded.uid;

    client = await pool.connect();
    // Update user only if they are an operator and not yet verified
    const update_query = `
      UPDATE users SET email_verified = TRUE, updated_at = $1
      WHERE uid = $2 AND role = 'operator' AND email_verified = FALSE
      RETURNING uid;
    `;
    const now = Date.now();
    const result = await client.query(update_query, [now, user_uid]);

    if (result.rowCount === 0) {
      // Check if already verified or not found/not operator
      const check_user = await client.query('SELECT email_verified FROM users WHERE uid = $1 AND role = \'operator\'', [user_uid]);
      if (check_user.rowCount > 0 && check_user.rows[0].email_verified) {
          return res.status(200).json({ message: 'Email already verified. You can now log in.' });
      } else {
          return res.status(400).json({ error: 'Invalid or expired token, or user not found/not an operator.' });
      }
    }

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });

  } catch (err) {
    console.error("Error verifying email:", err);
     if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
        res.status(400).json({ error: 'Invalid or expired verification token.' });
    } else {
        res.status(500).json({ error: 'Failed to verify email.' });
    }
  } finally {
    if (client) client.release();
  }
});

// 4. POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  let client;
  try {
    client = await pool.connect();
    // Fetch user and potentially truck_uid
    const query = `
      SELECT u.uid, u.first_name, u.last_name, u.email, u.role, u.password_hash, u.phone_number, u.email_verified, ft.uid as food_truck_uid
      FROM users u
      LEFT JOIN food_trucks ft ON u.uid = ft.operator_user_uid AND u.role = 'operator'
      WHERE u.email = $1;
    `;
    const result = await client.query(query, [email.toLowerCase()]);

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if operator email is verified
    if (user.role === 'operator' && !user.email_verified) {
      return res.status(403).json({ error: 'Email not verified. Please check your email.' });
    }

    // Prepare user object for token and response (matching BRD)
    const user_for_response = {
        uid: user.uid,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        phone_number: user.phone_number,
        ...(user.role === 'operator' && { food_truck_uid: user.food_truck_uid }) // Include truck_uid for operator
    };

    const auth_token = generate_auth_token(user_for_response);

    res.status(200).json({
      user: user_for_response,
      auth_token: auth_token
    });

  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: 'Login failed.' });
  } finally {
    if (client) client.release();
  }
});

// 5. POST /auth/logout
app.post('/auth/logout', authenticate_token, (req, res) => {
  // For stateless JWT, logout is client-side. Server-side blocklist is optional/advanced.
  console.log(`User ${req.user.uid} logged out (token invalidation is client-side).`);
  res.status(200).json({ message: 'Logged out successfully.' });
});

// 6. POST /auth/forgot_password
app.post('/auth/forgot_password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  let client;
  try {
    client = await pool.connect();
    const query = 'SELECT uid FROM users WHERE email = $1;';
    const result = await client.query(query, [email.toLowerCase()]);

    if (result.rowCount > 0) {
      const user_uid = result.rows[0].uid;
      // Generate a short-lived token specifically for password reset
      const reset_token = jwt.sign({ uid: user_uid, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '15m' });
      const reset_link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${reset_token}`;

      // Send reset email (using real function)
      await send_email({
        to: email.toLowerCase(),
        subject: 'Reset Your StreetEats Hub Password',
        text_body: `Someone requested a password reset for your StreetEats Hub account.\nClick this link to reset your password (valid for 15 minutes): ${reset_link}\nIf you didn't request this, please ignore this email.`,
        html_body: `<p>Someone requested a password reset for your StreetEats Hub account.</p><p>Click this link to reset your password (valid for 15 minutes): <a href="${reset_link}">${reset_link}</a></p><p>If you didn't request this, please ignore this email.</p>`
      });
    } else {
        console.log(`Password reset requested for non-existent email: ${email}`);
    }

    // Always return success to prevent email enumeration
    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (err) {
    console.error("Error during forgot password:", err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  } finally {
    if (client) client.release();
  }
});

// 7. POST /auth/reset_password
app.post('/auth/reset_password', async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }
   if (new_password.length < 6) { return res.status(400).json({ error: 'Password must be at least 6 characters long.' }); }

  let client;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check if the token's purpose is correct
    if (decoded.purpose !== 'password_reset') {
      throw new Error('Invalid token purpose');
    }
    const user_uid = decoded.uid;

    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    const now = Date.now();

    client = await pool.connect();
    const update_query = `
      UPDATE users SET password_hash = $1, updated_at = $2
      WHERE uid = $3
      RETURNING uid;
    `;
    const result = await client.query(update_query, [password_hash, now, user_uid]);

    if (result.rowCount === 0) {
      // User might have been deleted between token generation and use
      return res.status(400).json({ error: 'Invalid token or user not found.' });
    }

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });

  } catch (err) {
    console.error("Error resetting password:", err);
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
        res.status(400).json({ error: 'Invalid or expired password reset token.' });
    } else if (err.message === 'Invalid token purpose') {
        res.status(400).json({ error: 'Invalid token type provided.' });
    }
     else {
        res.status(500).json({ error: 'Failed to reset password.' });
    }
  } finally {
    if (client) client.release();
  }
});


// --- II.B.2. Customer Profile & Settings ---

// 1. GET /users/me
app.get('/users/me', authenticate_token, async (req, res) => {
   let client;
   try {
       client = await pool.connect();
       // Fetch user data including truck_uid if operator
       const query = `
            SELECT u.uid, u.first_name, u.last_name, u.email, u.role, u.phone_number, ft.uid as food_truck_uid
            FROM users u
            LEFT JOIN food_trucks ft ON u.uid = ft.operator_user_uid AND u.role = 'operator'
            WHERE u.uid = $1;
        `;
       const result = await client.query(query, [req.user.uid]);
       if (result.rowCount === 0) {
           // This shouldn't happen if token is valid, but handle defensively
           return res.status(404).json({ error: 'User not found.' });
       }
       const user_data = result.rows[0];
       // Clean up response: remove null food_truck_uid if not operator
       if (user_data.role !== 'operator') {
           delete user_data.food_truck_uid;
       }
       res.status(200).json(user_data);
   } catch (err) {
       console.error("Error fetching user profile:", err);
       res.status(500).json({ error: 'Failed to retrieve user profile.' });
   } finally {
       if (client) client.release();
   }
});

// 2. PUT /users/me
app.put('/users/me', authenticate_token, async (req, res) => {
  const { first_name, last_name, phone_number } = req.body;
  const user_uid = req.user.uid;

  // Allow partial updates, check if anything was actually provided
  if (first_name === undefined && last_name === undefined && phone_number === undefined) {
      // Fetch current data and return 200 OK if nothing to update
       let client;
        try {
            client = await pool.connect();
            const current_data_res = await client.query('SELECT uid, first_name, last_name, email, role, phone_number FROM users WHERE uid=$1', [user_uid]);
            if (current_data_res.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
            return res.status(200).json(current_data_res.rows[0]);
        } catch (err) {
             console.error("Error fetching user profile during no-op update:", err);
             return res.status(500).json({ error: 'Failed to retrieve user profile.' });
        } finally {
             if (client) client.release();
        }
  }

  let client;
  try {
      client = await pool.connect();
      // Build query dynamically
      const fields_to_update = {};
      if (first_name !== undefined) fields_to_update.first_name = first_name;
      if (last_name !== undefined) fields_to_update.last_name = last_name;
      // Allow setting phone_number to null explicitly, or updating it
      if (phone_number !== undefined) fields_to_update.phone_number = phone_number;

      const set_clauses = Object.keys(fields_to_update).map((key, index) => `${key} = $${index + 1}`);
      const values = Object.values(fields_to_update);
      values.push(Date.now()); // For updated_at
      values.push(user_uid); // For WHERE clause

      const update_query = `
          UPDATE users
          SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1}
          WHERE uid = $${values.length}
          RETURNING uid, first_name, last_name, email, role, phone_number;
      `;

      const result = await client.query(update_query, values);

      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'User not found.' });
      }

      res.status(200).json(result.rows[0]);

  } catch (err) {
      console.error("Error updating user profile:", err);
      res.status(500).json({ error: 'Failed to update user profile.' });
  } finally {
      if (client) client.release();
  }
});

// 3. PUT /users/me/password
app.put('/users/me/password', authenticate_token, async (req, res) => {
  const { current_password, new_password } = req.body;
  const user_uid = req.user.uid;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (new_password.length < 6) { return res.status(400).json({ error: 'New password must be at least 6 characters long.' }); }

  let client;
  try {
    client = await pool.connect();

    // Get current hash
    const hash_result = await client.query('SELECT password_hash FROM users WHERE uid = $1;', [user_uid]);
    if (hash_result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const current_hash = hash_result.rows[0].password_hash;

    // Verify current password
    const match = await bcrypt.compare(current_password, current_hash);
    if (!match) {
      return res.status(403).json({ error: 'Incorrect current password.' });
    }

    // Hash new password and update
    const new_password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    const now = Date.now();
    const update_query = `
      UPDATE users SET password_hash = $1, updated_at = $2
      WHERE uid = $3;
    `;
    await client.query(update_query, [new_password_hash, now, user_uid]);

    res.status(200).json({ message: 'Password updated successfully.' });

  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ error: 'Failed to update password.' });
  } finally {
    if (client) client.release();
  }
});

// 4. GET /users/me/addresses
app.get('/users/me/addresses', authenticate_token, require_role('customer'), async (req, res) => {
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT uid, nickname, street_address, apt_suite, city, state, zip_code, is_default
            FROM addresses
            WHERE customer_user_uid = $1
            ORDER BY is_default DESC, created_at ASC;
        `;
        const result = await client.query(query, [customer_user_uid]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching addresses:", err);
        res.status(500).json({ error: 'Failed to retrieve addresses.' });
    } finally {
        if (client) client.release();
    }
});

// 5. POST /users/me/addresses
app.post('/users/me/addresses', authenticate_token, require_role('customer'), async (req, res) => {
    const { nickname, street_address, apt_suite, city, state, zip_code, is_default = false } = req.body;
    const customer_user_uid = req.user.uid;

    if (!nickname || !street_address || !city || !state || !zip_code) {
        return res.status(400).json({ error: 'Missing required address fields (nickname, street_address, city, state, zip_code).' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const now = Date.now();

        // If setting as default, unset previous default
        if (is_default) {
            const unset_default_query = `
                UPDATE addresses SET is_default = FALSE, updated_at = $1
                WHERE customer_user_uid = $2 AND is_default = TRUE;
            `;
            await client.query(unset_default_query, [now, customer_user_uid]);
        }

        // Insert new address
        const uid = uuidv4();
        const insert_query = `
            INSERT INTO addresses (uid, customer_user_uid, nickname, street_address, apt_suite, city, state, zip_code, is_default, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING uid, nickname, street_address, apt_suite, city, state, zip_code, is_default;
        `;
        const values = [uid, customer_user_uid, nickname, street_address, apt_suite || null, city, state, zip_code, !!is_default, now, now];
        const result = await client.query(insert_query, values);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error adding address:", err);
        res.status(500).json({ error: 'Failed to add address.' });
    } finally {
        if (client) client.release();
    }
});

// 6. PUT /users/me/addresses/{address_uid}
app.put('/users/me/addresses/:address_uid', authenticate_token, require_role('customer'), async (req, res) => {
    const { address_uid } = req.params;
    const { nickname, street_address, apt_suite, city, state, zip_code, is_default } = req.body;
    const customer_user_uid = req.user.uid;

    const update_fields = {};
    if (nickname !== undefined) update_fields.nickname = nickname;
    if (street_address !== undefined) update_fields.street_address = street_address;
    if (apt_suite !== undefined) update_fields.apt_suite = apt_suite; // Allow null
    if (city !== undefined) update_fields.city = city;
    if (state !== undefined) update_fields.state = state;
    if (zip_code !== undefined) update_fields.zip_code = zip_code;
    if (is_default !== undefined) update_fields.is_default = !!is_default;

    if (Object.keys(update_fields).length === 0) {
        // Fetch current data and return 200 OK if nothing to update
         let client;
         try {
            client = await pool.connect();
            const current_data_res = await client.query('SELECT uid, nickname, street_address, apt_suite, city, state, zip_code, is_default FROM addresses WHERE uid=$1 AND customer_user_uid=$2', [address_uid, customer_user_uid]);
            if (current_data_res.rowCount === 0) return res.status(404).json({ error: 'Address not found or permission denied.' });
            return res.status(200).json(current_data_res.rows[0]);
         } catch(err) { /* handle error below */ }
         finally { if(client) client.release(); }
    }


    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const now = Date.now();

        // Check if address exists and belongs to user
        const check_query = 'SELECT is_default FROM addresses WHERE uid = $1 AND customer_user_uid = $2;';
        const check_result = await client.query(check_query, [address_uid, customer_user_uid]);
        if (check_result.rowCount === 0) {
             await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Address not found or permission denied.' });
        }
        const current_is_default = check_result.rows[0].is_default;

        // If changing to default=true, unset previous default
        if (update_fields.is_default === true && !current_is_default) {
            const unset_default_query = `
                UPDATE addresses SET is_default = FALSE, updated_at = $1
                WHERE customer_user_uid = $2 AND is_default = TRUE AND uid != $3;
            `;
            await client.query(unset_default_query, [now, customer_user_uid, address_uid]);
        }
        // Note: Logic potentially needed to prevent unsetting the *only* default address if required.

        // Build update query
        const set_clauses = Object.keys(update_fields).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(update_fields);
        values.push(now); // updated_at
        values.push(address_uid); // WHERE uid
        values.push(customer_user_uid); // WHERE customer_user_uid

        const update_query = `
            UPDATE addresses
            SET ${set_clauses.join(', ')}, updated_at = $${values.length - 2}
            WHERE uid = $${values.length -1} AND customer_user_uid = $${values.length}
            RETURNING uid, nickname, street_address, apt_suite, city, state, zip_code, is_default;
        `;

        const result = await client.query(update_query, values);
        if (result.rowCount === 0) { // Should not happen after check, but safeguard
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Address not found or update failed unexpectedly.' });
        }

        await client.query('COMMIT');
        res.status(200).json(result.rows[0]);

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error updating address:", err);
        res.status(500).json({ error: 'Failed to update address.' });
    } finally {
        if (client) client.release();
    }
});

// 7. DELETE /users/me/addresses/{address_uid}
app.delete('/users/me/addresses/:address_uid', authenticate_token, require_role('customer'), async (req, res) => {
    const { address_uid } = req.params;
    const customer_user_uid = req.user.uid;

    let client;
    try {
        client = await pool.connect();
        const delete_query = `
            DELETE FROM addresses
            WHERE uid = $1 AND customer_user_uid = $2;
        `;
        const result = await client.query(delete_query, [address_uid, customer_user_uid]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Address not found or permission denied.' });
        }

        res.status(200).json({ message: 'Address deleted successfully.' });

    } catch (err) {
        console.error("Error deleting address:", err);
        res.status(500).json({ error: 'Failed to delete address.' });
    } finally {
        if (client) client.release();
    }
});

// 8. GET /users/me/payment_methods
app.get('/users/me/payment_methods', authenticate_token, require_role('customer'), async (req, res) => {
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT uid, card_type, last_4_digits, expiry_month, expiry_year
            FROM payment_methods
            WHERE customer_user_uid = $1
            ORDER BY created_at DESC;
        `;
        const result = await client.query(query, [customer_user_uid]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching payment methods:", err);
        res.status(500).json({ error: 'Failed to retrieve payment methods.' });
    } finally {
        if (client) client.release();
    }
});

// 9. DELETE /users/me/payment_methods/{payment_method_uid}
app.delete('/users/me/payment_methods/:payment_method_uid', authenticate_token, require_role('customer'), async (req, res) => {
    const { payment_method_uid } = req.params; // This is our local DB UID
    const customer_user_uid = req.user.uid;

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Find the payment method and its gateway ID
        const find_query = `
            SELECT payment_gateway_method_id FROM payment_methods
            WHERE uid = $1 AND customer_user_uid = $2;
        `;
        const find_result = await client.query(find_query, [payment_method_uid, customer_user_uid]);

        if (find_result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payment method not found or permission denied.' });
        }
        const gateway_method_id = find_result.rows[0].payment_gateway_method_id;

        // Call Payment Gateway to detach/delete the method (using real function)
        await delete_payment_method({ payment_method_id: gateway_method_id });

        // Delete from our local DB
        const delete_query = `
            DELETE FROM payment_methods WHERE uid = $1;
        `;
        await client.query(delete_query, [payment_method_uid]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Payment method deleted successfully.' });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error deleting payment method:", err);
        // Check if error came from the gateway delete function
        if (err.message.includes("Failed to detach payment method via Stripe")) {
             res.status(502).json({ error: err.message }); // Bad Gateway for external failure
        } else {
             res.status(500).json({ error: 'Failed to delete payment method.' });
        }
    } finally {
        if (client) client.release();
    }
});


// --- II.B.3. Food Truck Discovery & Menu ---

// 1. GET /food_trucks
app.get('/food_trucks', async (req, res) => {
    const { latitude, longitude, radius_km, cuisine_type, search_term, status = 'online' } = req.query;

    let client;
    try {
        client = await pool.connect();
        let base_query = `
            SELECT
                uid, name, cuisine_type, current_status, location_latitude, location_longitude, logo_url
            FROM food_trucks
        `;
        const conditions = [];
        const values = [];
        let value_index = 1;

        // Filter by status (must be 'online', 'offline', or 'paused')
        const valid_statuses = ['online', 'offline', 'paused'];
        if (valid_statuses.includes(status)) {
            conditions.push(`current_status = $${value_index++}`);
            values.push(status);
        } else {
             // Default to 'online' if invalid status provided
            conditions.push(`current_status = $${value_index++}`);
            values.push('online');
        }

         // Filter by cuisine type (case-insensitive, supports multiple comma-separated)
        if (cuisine_type) {
            const cuisines = cuisine_type.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
            if (cuisines.length > 0) {
                // Use LOWER() on DB column for case-insensitivity
                conditions.push(`LOWER(cuisine_type) = ANY($${value_index++})`);
                values.push(cuisines);
            }
        }

        // Filter by search term (case-insensitive on name or cuisine)
        if (search_term) {
            conditions.push(`(LOWER(name) LIKE $${value_index} OR LOWER(cuisine_type) LIKE $${value_index})`);
            values.push(`%${search_term.toLowerCase().trim()}%`);
            value_index++;
        }

        // Add WHERE clause if conditions exist
        if (conditions.length > 0) {
            base_query += ' WHERE ' + conditions.join(' AND ');
        }
        base_query += ' ORDER BY name ASC;'; // Default sort by name

        // Execute query
        const result = await client.query(base_query, values);
        let trucks = result.rows;

        // Post-filter by distance if location provided & valid
        let location_filter_applied = false;
        if (latitude !== undefined && longitude !== undefined && radius_km !== undefined) {
            const lat = parseFloat(latitude);
            const lon = parseFloat(longitude);
            const radius = parseFloat(radius_km);
             if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius) && radius >= 0) {
                 location_filter_applied = true;
                 trucks = trucks
                    .map(truck => {
                        const dist = calculate_distance_km(lat, lon, truck.location_latitude, truck.location_longitude);
                        // Assign distance only if calculable
                        truck.distance_km = isFinite(dist) ? parseFloat(dist.toFixed(2)) : null;
                        return truck;
                    })
                    .filter(truck => truck.distance_km !== null && truck.distance_km <= radius);

                 // Sort by distance
                 trucks.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
             } else {
                  console.warn("Received invalid location parameters (lat, lon, radius). Ignoring for filtering.");
             }
        }

        res.status(200).json(trucks);

    } catch (err) {
        console.error("Error fetching food trucks:", err);
        res.status(500).json({ error: 'Failed to retrieve food trucks.' });
    } finally {
        if (client) client.release();
    }
});

// 2. GET /food_trucks/{truck_uid}
app.get('/food_trucks/:truck_uid', async (req, res) => {
    const { truck_uid } = req.params;
    const include_unavailable = req.query.include_unavailable === 'true';

    let client;
    try {
        client = await pool.connect();

        // 1. Get Truck Details
        const truck_query = `
            SELECT
                uid, name, description, cuisine_type, logo_url, standard_operating_hours,
                current_status, current_location_address, delivery_enabled, delivery_fee,
                delivery_minimum_order_value, delivery_radius_km, average_preparation_minutes,
                customer_support_phone_number
            FROM food_trucks
            WHERE uid = $1;
        `;
        const truck_result = await client.query(truck_query, [truck_uid]);
        if (truck_result.rowCount === 0) {
            return res.status(404).json({ error: 'Food truck not found.' });
        }
        const truck_data = truck_result.rows[0];

        // Format basic truck data
        const response_data = {
            uid: truck_data.uid, name: truck_data.name, description: truck_data.description, cuisine_type: truck_data.cuisine_type, logo_url: truck_data.logo_url,
             standard_operating_hours: truck_data.standard_operating_hours ? JSON.parse(truck_data.standard_operating_hours) : null, // Parse JSON string
             current_status: truck_data.current_status, current_location_address: truck_data.current_location_address,
             delivery_settings: {
                enabled: truck_data.delivery_enabled,
                fee: truck_data.delivery_fee ? parseFloat(truck_data.delivery_fee) : null,
                minimum_order_value: truck_data.delivery_minimum_order_value ? parseFloat(truck_data.delivery_minimum_order_value) : null,
                radius_km: truck_data.delivery_radius_km ? parseFloat(truck_data.delivery_radius_km) : null
             },
             average_preparation_minutes: truck_data.average_preparation_minutes,
             customer_support_phone_number: truck_data.customer_support_phone_number,
             menu: [] // Initialize menu array
        };

        // 2. Get Menu Structure
        const menu_query = `
            SELECT
                mc.uid as category_uid, mc.name as category_name, mc.display_order as category_order, mc.is_available as category_available,
                mi.uid as item_uid, mi.name as item_name, mi.description as item_description, mi.base_price as item_base_price,
                mi.photo_url as item_photo_url, mi.is_available as item_available, mi.display_order as item_order,
                mg.uid as group_uid, mg.name as group_name, mg.selection_type as group_selection_type, mg.is_required as group_is_required,
                mo.uid as option_uid, mo.name as option_name, mo.price_adjustment as option_price_adjustment
            FROM menu_categories mc
            LEFT JOIN menu_items mi ON mc.uid = mi.menu_category_uid
            LEFT JOIN modifier_groups mg ON mi.uid = mg.menu_item_uid
            LEFT JOIN modifier_options mo ON mg.uid = mo.modifier_group_uid
            WHERE mc.food_truck_uid = $1
            ORDER BY mc.display_order, mc.name, mi.display_order, mi.name, mg.uid, mo.name; -- Order groups by uid for consistent option grouping
        `;
        const menu_result = await client.query(menu_query, [truck_uid]);

        // Process into nested structure
         const menu_map = {};
         for (const row of menu_result.rows) {
             // Filter based on include_unavailable flag
            if (!include_unavailable && (!row.category_available || (row.item_uid && !row.item_available))) {
                continue; // Skip unavailable category or item if flag is false
            }

             // Category
             if (!menu_map[row.category_uid]) {
                 menu_map[row.category_uid] = { category_uid: row.category_uid, category_name: row.category_name, is_available: row.category_available, display_order: row.category_order, items_map: {} };
             }
             const category = menu_map[row.category_uid];

             // Item
             if (row.item_uid && !category.items_map[row.item_uid]) {
                 category.items_map[row.item_uid] = { item_uid: row.item_uid, item_name: row.item_name, description: row.item_description, base_price: parseFloat(row.item_base_price), photo_url: row.item_photo_url, is_available: row.item_available, display_order: row.item_order, modifier_groups_map: {} };
             }
              if (!row.item_uid) continue; // Skip row if no item data (e.g., category exists but has no items)
             const item = category.items_map[row.item_uid];

             // Modifier Group
             if (row.group_uid && !item.modifier_groups_map[row.group_uid]) {
                 item.modifier_groups_map[row.group_uid] = { group_uid: row.group_uid, group_name: row.group_name, selection_type: row.group_selection_type, is_required: row.group_is_required, options: [] };
             }
             if (!row.group_uid) continue; // Skip row if no group data
             const group = item.modifier_groups_map[row.group_uid];

             // Modifier Option
             if (row.option_uid && !group.options.find(opt => opt.option_uid === row.option_uid)) { // Avoid duplicates
                 group.options.push({ option_uid: row.option_uid, option_name: row.option_name, price_adjustment: parseFloat(row.option_price_adjustment) });
             }
         }

         // Convert maps to arrays for final response structure
         response_data.menu = Object.values(menu_map)
            .sort((a, b) => a.display_order - b.display_order) // Sort categories
            .map(cat => ({
                 category_uid: cat.category_uid,
                 category_name: cat.category_name,
                 is_available: cat.is_available,
                 items: Object.values(cat.items_map)
                    .sort((a, b) => a.display_order - b.display_order) // Sort items
                    .map(item => ({
                         item_uid: item.item_uid,
                         item_name: item.item_name,
                         description: item.description,
                         base_price: item.base_price,
                         photo_url: item.photo_url,
                         is_available: item.is_available,
                         modifier_groups: Object.values(item.modifier_groups_map)
                            // Optional: sort groups if needed
                            .map(group => ({
                                ...group,
                                // Optional: sort options if needed
                                // options: group.options.sort(...)
                            }))
                    }))
             }));

        res.status(200).json(response_data);

    } catch (err) {
        console.error("Error fetching truck details:", err);
         if (err instanceof SyntaxError) { // JSON parsing error for hours
            res.status(500).json({ error: 'Failed to parse truck operating hours data.' });
        } else {
            res.status(500).json({ error: 'Failed to retrieve truck details.' });
        }
    } finally {
        if (client) client.release();
    }
});


// --- II.B.4. Ordering & Checkout ---

// 1. POST /orders
app.post('/orders', authenticate_token, require_role('customer'), async (req, res) => {
    const customer_user_uid = req.user.uid;
    const {
        food_truck_uid,
        fulfillment_type, // 'pickup' or 'delivery'
        delivery_address, // object: { address_uid } OR { street_address, ... }
        payment_method, // object: { payment_method_uid } OR { payment_method_token, save_method }
        items // array: [{ menu_item_uid, quantity, selected_options: [option_uid,...], special_instructions }]
    } = req.body;

    // --- 1. Basic Validation ---
    if (!food_truck_uid || !fulfillment_type || !payment_method || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing required order fields (truck, fulfillment, payment, items).' });
    }
    if (fulfillment_type === 'delivery' && !delivery_address) {
        return res.status(400).json({ error: 'Delivery address is required for delivery orders.' });
    }
     if (fulfillment_type !== 'pickup' && fulfillment_type !== 'delivery') {
        return res.status(400).json({ error: 'Invalid fulfillment type.' });
    }
    if (!payment_method.payment_method_uid && !payment_method.payment_method_token) {
        return res.status(400).json({ error: 'Payment method selection or token is required.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // --- 2. Fetch Truck & Check Status/Availability (Lock row) ---
        const truck_query = `
            SELECT uid, name, current_status, location_latitude, location_longitude, current_location_address,
                   delivery_enabled, delivery_fee, delivery_minimum_order_value, delivery_radius_km,
                   average_preparation_minutes, operator_user_uid -- Need operator UID for notification
            FROM food_trucks WHERE uid = $1 FOR UPDATE;
        `;
        const truck_result = await client.query(truck_query, [food_truck_uid]);
        if (truck_result.rowCount === 0) {
            await client.query('ROLLBACK'); return res.status(404).json({ error: 'Food truck not found.' });
        }
        const truck = truck_result.rows[0];
        if (truck.current_status !== 'online') {
            await client.query('ROLLBACK'); return res.status(409).json({ error: `Truck '${truck.name}' is currently ${truck.current_status} and not accepting orders.` });
        }

        // --- 3. Resolve & Validate Delivery Address ---
        let resolved_delivery_address = null;
        let delivery_address_snapshot_json = null;
        if (fulfillment_type === 'delivery') {
            if (!truck.delivery_enabled) {
                await client.query('ROLLBACK'); return res.status(400).json({ error: 'This truck does not offer delivery.' });
            }
            if (delivery_address.address_uid) {
                const addr_query = 'SELECT street_address, apt_suite, city, state, zip_code FROM addresses WHERE uid = $1 AND customer_user_uid = $2;';
                const addr_result = await client.query(addr_query, [delivery_address.address_uid, customer_user_uid]);
                if (addr_result.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Saved delivery address not found.' }); }
                resolved_delivery_address = addr_result.rows[0];
            } else if (delivery_address.street_address && delivery_address.city && delivery_address.state && delivery_address.zip_code) {
                resolved_delivery_address = { street_address: delivery_address.street_address, apt_suite: delivery_address.apt_suite || null, city: delivery_address.city, state: delivery_address.state, zip_code: delivery_address.zip_code };
            } else { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid or incomplete delivery address provided.' }); }

            // Geocode address (using real function) & Check delivery radius
            try {
                 const full_address_string = `${resolved_delivery_address.street_address}, ${resolved_delivery_address.city}, ${resolved_delivery_address.state} ${resolved_delivery_address.zip_code}`;
                 const coords = await geocode_address({ address: full_address_string });
                 resolved_delivery_address.latitude = coords.latitude;
                 resolved_delivery_address.longitude = coords.longitude;

                 if (truck.location_latitude == null || truck.location_longitude == null) { throw new Error('Truck location not set.'); }
                 const distance = calculate_distance_km(truck.location_latitude, truck.location_longitude, coords.latitude, coords.longitude);
                 if (!isFinite(distance) || distance > (truck.delivery_radius_km ?? Infinity)) {
                     throw new Error(`Delivery address is outside the truck's ${truck.delivery_radius_km}km delivery radius (distance: ${distance.toFixed(1)}km).`);
                 }
                 console.log(`Delivery distance calculated: ${distance.toFixed(1)}km`);
            } catch (geo_err) {
                 console.error("Geocoding/Distance check failed:", geo_err);
                 await client.query('ROLLBACK');
                 return res.status(400).json({ error: geo_err.message || 'Could not verify delivery address location or distance.' });
            }
            // Prepare snapshot (excluding coords)
             delivery_address_snapshot_json = JSON.stringify({ street_address: resolved_delivery_address.street_address, apt_suite: resolved_delivery_address.apt_suite, city: resolved_delivery_address.city, state: resolved_delivery_address.state, zip_code: resolved_delivery_address.zip_code });
        }

        // --- 4. Validate Items & Calculate Totals ---
        let calculated_subtotal = 0;
        const order_item_details = [];
        const item_ids = items.map(item => item.menu_item_uid).filter(Boolean);
        const all_option_ids = items.flatMap(item => item.selected_options || []).filter(Boolean);
        if (item_ids.length !== items.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid menu item UID found in request.' }); }

        const [items_result, options_result] = await Promise.all([
             client.query(`SELECT mi.uid, mi.name, mi.base_price, mi.is_available, mc.is_available as category_available FROM menu_items mi JOIN menu_categories mc ON mi.menu_category_uid = mc.uid WHERE mi.uid = ANY($1) AND mi.food_truck_uid = $2;`, [item_ids, food_truck_uid]),
             all_option_ids.length > 0 ? client.query(`SELECT mo.uid, mo.name, mo.price_adjustment, mg.name as group_name, mg.menu_item_uid FROM modifier_options mo JOIN modifier_groups mg ON mo.modifier_group_uid = mg.uid WHERE mo.uid = ANY($1);`, [all_option_ids]) : Promise.resolve({ rows: [] })
        ]);
        const db_items = items_result.rows.reduce((map, item) => { map[item.uid] = item; return map; }, {});
        const db_options = options_result.rows.reduce((map, opt) => { map[opt.uid] = opt; return map; }, {});

        // Validate items and options, calculate price
        for (const requested_item of items) {
            const db_item = db_items[requested_item.menu_item_uid];
            if (!db_item) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Menu item UID ${requested_item.menu_item_uid} not found for this truck.` }); }
            if (!db_item.is_available || !db_item.category_available) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Item '${db_item.name}' is currently unavailable.` }); }

            let item_base_price = parseFloat(db_item.base_price);
            let options_price = 0;
            const selected_option_details_for_db = [];
            if (requested_item.selected_options?.length > 0) {
                for (const option_uid of requested_item.selected_options) {
                    const db_option = db_options[option_uid];
                    if (!db_option) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Selected option UID ${option_uid} not found.` }); }
                    // Crucial check: Ensure the selected option actually belongs to the item being ordered
                    if (db_option.menu_item_uid !== requested_item.menu_item_uid) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Option '${db_option.name}' does not belong to item '${db_item.name}'.` }); }

                    options_price += parseFloat(db_option.price_adjustment);
                    selected_option_details_for_db.push({ modifier_option_uid: db_option.uid, modifier_group_name_snapshot: db_option.group_name, option_name_snapshot: db_option.name, price_adjustment_snapshot: parseFloat(db_option.price_adjustment) });
                }
            }
            const quantity = parseInt(requested_item.quantity, 10);
            if (isNaN(quantity) || quantity <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Invalid quantity for item '${db_item.name}'.` }); }

            const total_item_price = (item_base_price + options_price) * quantity;
            calculated_subtotal += total_item_price;
            order_item_details.push({ menu_item_uid: db_item.uid, item_name_snapshot: db_item.name, quantity: quantity, base_price_snapshot: item_base_price, total_item_price: total_item_price, special_instructions: requested_item.special_instructions || null, options_to_insert: selected_option_details_for_db });
        }

        // --- 5. Calculate Fees, Tax, Total & Check Min Order ---
        const delivery_fee_charged = (fulfillment_type === 'delivery') ? parseFloat(truck.delivery_fee || 0) : 0;
        if (fulfillment_type === 'delivery' && calculated_subtotal < parseFloat(truck.delivery_minimum_order_value || 0)) {
            await client.query('ROLLBACK'); return res.status(400).json({ error: `Order subtotal ($${calculated_subtotal.toFixed(2)}) is below the minimum of $${parseFloat(truck.delivery_minimum_order_value || 0).toFixed(2)} for delivery.` });
        }
        const tax_rate = 0.09; // Mock 9% tax
        const tax_amount = calculated_subtotal * tax_rate;
        const calculated_total_amount = calculated_subtotal + tax_amount + delivery_fee_charged;
        const total_amount_cents = Math.round(calculated_total_amount * 100);

         // --- 6. Resolve Payment Method & Customer ---
        let payment_method_token_to_use = null;
        let gateway_customer_id = null; // Stripe Customer ID
        let should_save_method = payment_method.save_method === true && payment_method.payment_method_token; // Only save if new token provided

        // Get Stripe Customer ID (essential for saving methods, good practice otherwise)
        // In real app, you'd store this mapping in your DB or fetch/create from Stripe
        const customer_stripe_id_result = await client.query('SELECT payment_gateway_customer_id FROM payment_methods WHERE customer_user_uid = $1 LIMIT 1', [customer_user_uid]);
        if (customer_stripe_id_result.rowCount > 0) {
           gateway_customer_id = customer_stripe_id_result.rows[0].payment_gateway_customer_id;
        } else {
           // Mock: Create/fetch Stripe customer ID if needed (replace with real Stripe API call)
           console.warn(`Stripe Customer ID not found for user ${customer_user_uid}, using mock.`);
           gateway_customer_id = `mock_cus_${customer_user_uid.substring(0, 8)}`;
        }

        if (payment_method.payment_method_uid) { // Using saved method
            const pm_query = 'SELECT payment_gateway_method_id, payment_gateway_customer_id FROM payment_methods WHERE uid = $1 AND customer_user_uid = $2;';
            const pm_result = await client.query(pm_query, [payment_method.payment_method_uid, customer_user_uid]);
            if (pm_result.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Saved payment method not found.' }); }
            payment_method_token_to_use = pm_result.rows[0].payment_gateway_method_id; // This is the Stripe pm_... ID
            // Ensure customer ID matches
            if (pm_result.rows[0].payment_gateway_customer_id !== gateway_customer_id) {
                 console.error(`Mismatch between found customer ID (${gateway_customer_id}) and payment method customer ID (${pm_result.rows[0].payment_gateway_customer_id})`);
                 await client.query('ROLLBACK'); return res.status(409).json({ error: 'Payment method customer mismatch.' });
            }
            should_save_method = false; // Already saved
        } else { // Using new token (pm_... from Stripe Elements/SDK)
            payment_method_token_to_use = payment_method.payment_method_token;
            if (should_save_method && !gateway_customer_id) {
                 // Need customer ID to save; if we couldn't get/create one, prevent saving
                 console.warn("Cannot save payment method as Stripe Customer ID is unavailable.");
                 should_save_method = false;
            }
        }
        if (!payment_method_token_to_use) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Could not resolve payment method ID.' }); }


        // --- 7. Process Payment (using real function) ---
        let payment_gateway_charge_id; // This will store the Stripe Charge ID (ch_...)
        let payment_intent_id; // Store the Payment Intent ID (pi_...)
        try {
             const charge_result = await create_payment_charge({
                 amount: total_amount_cents, currency: 'usd', payment_method_token: payment_method_token_to_use,
                 customer_id: gateway_customer_id, capture: true
             });
             payment_gateway_charge_id = charge_result.charge_id; // Store the ch_... ID from the PI
             payment_intent_id = charge_result.payment_intent_id; // Store the pi_... ID
             if(!payment_gateway_charge_id) {
                 // If capture failed or charge ID isn't available yet (async webhook needed?) - handle this state
                 console.error(`PaymentIntent ${payment_intent_id} succeeded but charge ID missing.`);
                 // For MVP, assume synchronous success provides charge ID. If not, need webhook handling.
                 throw new Error("Payment succeeded but charge confirmation is pending.");
             }
        } catch (payment_error) {
             console.error("Payment processing failed:", payment_error);
             await client.query('ROLLBACK');
             return res.status(402).json({ error: `Payment failed: ${payment_error.message}` });
        }

         // --- 7b. Save Payment Method if Requested (using real function) ---
        if (should_save_method && gateway_customer_id && payment_method_token_to_use) {
            try {
                // Note: Attaching usually happens *before* confirming the PaymentIntent or uses setup_future_usage.
                // Re-attaching after charge might work but check Stripe docs.
                // Alternative: Use 'setup_future_usage' on PaymentIntent creation.
                // For MVP simplicity, we save *after* successful charge.
                const saved_method_info = await save_payment_method({
                    customer_id: gateway_customer_id,
                    payment_method_token: payment_method_token_to_use // The pm_... ID
                });
                // Save reference in our DB
                const pm_uid = uuidv4();
                const pm_now = Date.now();
                const insert_pm_query = `INSERT INTO payment_methods (uid, customer_user_uid, payment_gateway_customer_id, payment_gateway_method_id, card_type, last_4_digits, expiry_month, expiry_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (payment_gateway_method_id) DO NOTHING;`; // Avoid duplicates
                await client.query(insert_pm_query, [ pm_uid, customer_user_uid, gateway_customer_id, saved_method_info.id, saved_method_info.card?.brand || 'unknown', saved_method_info.card?.last4 || '0000', saved_method_info.card?.exp_month || 0, saved_method_info.card?.exp_year || 0, pm_now, pm_now ]);
                console.log(`Successfully saved/updated payment method ref ${saved_method_info.id} in DB.`);
            } catch (save_err) {
                console.error("Failed to save payment method after successful charge:", save_err); // Log but don't fail order
            }
        }

        // --- 8. Insert Order Data into DB ---
        const order_uid = uuidv4();
        const order_number = `STX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`; // Slightly longer
        const now = Date.now();
        const avg_prep_time_ms = (parseInt(truck.average_preparation_minutes, 10) || 15) * 60 * 1000;
        const delivery_buffer_ms = 15 * 60 * 1000; // 15 min buffer

        const estimated_ready_time = (fulfillment_type === 'pickup') ? (now + avg_prep_time_ms) : null;
        const estimated_delivery_time = (fulfillment_type === 'delivery') ? (now + avg_prep_time_ms + delivery_buffer_ms) : null;
        const pickup_location_snapshot = (fulfillment_type === 'pickup') ? truck.current_location_address : null;
        const combined_special_instructions = order_item_details.map(i => i.special_instructions).filter(Boolean).join('; ');

        const insert_order_query = `
            INSERT INTO orders (uid, customer_user_uid, food_truck_uid, order_number, status, fulfillment_type, delivery_address_snapshot, pickup_location_address_snapshot, special_instructions, subtotal, tax_amount, delivery_fee_charged, total_amount, payment_gateway_charge_id, order_time, estimated_ready_time, estimated_delivery_time, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending_confirmation', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18);
        `;
        await client.query(insert_order_query, [ order_uid, customer_user_uid, food_truck_uid, order_number, fulfillment_type, delivery_address_snapshot_json, pickup_location_snapshot, combined_special_instructions || null, calculated_subtotal.toFixed(2), tax_amount.toFixed(2), delivery_fee_charged.toFixed(2), calculated_total_amount.toFixed(2), payment_gateway_charge_id, now, estimated_ready_time, estimated_delivery_time, now, now ]);

        // Insert Order Items and Options
        for (const item_detail of order_item_details) {
            const order_item_uid = uuidv4();
            const insert_item_query = `INSERT INTO order_items (uid, order_uid, menu_item_uid, item_name_snapshot, quantity, base_price_snapshot, total_item_price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
            await client.query(insert_item_query, [ order_item_uid, order_uid, item_detail.menu_item_uid, item_detail.item_name_snapshot, item_detail.quantity, item_detail.base_price_snapshot.toFixed(2), item_detail.total_item_price.toFixed(2), now, now ]);
            for (const option_detail of item_detail.options_to_insert) {
                 const order_item_option_uid = uuidv4();
                 const insert_option_query = `INSERT INTO order_item_options (uid, order_item_uid, modifier_option_uid, modifier_group_name_snapshot, option_name_snapshot, price_adjustment_snapshot, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
                 await client.query(insert_option_query, [ order_item_option_uid, order_item_uid, option_detail.modifier_option_uid, option_detail.modifier_group_name_snapshot, option_detail.option_name_snapshot, option_detail.price_adjustment_snapshot.toFixed(2), now, now ]);
            }
        }

        // --- 9. Commit Transaction ---
        await client.query('COMMIT');

        // --- 10. Post-Order Actions (Notifications) ---
        const customer_name_result = await client.query('SELECT first_name, last_name FROM users WHERE uid = $1', [customer_user_uid]);
        const customer_display_name = customer_name_result.rowCount > 0 ? `${customer_name_result.rows[0].first_name} ${customer_name_result.rows[0].last_name.charAt(0)}.` : 'Customer';

        // Emit WebSocket to Operator
        emit_to_user('operator', truck.operator_user_uid, 'new_order_for_operator', {
            order_uid: order_uid, order_number: order_number, customer_name: customer_display_name, status: 'pending_confirmation', fulfillment_type: fulfillment_type,
            total_amount: parseFloat(calculated_total_amount.toFixed(2)), order_time: now,
            delivery_address_snippet: fulfillment_type === 'delivery' ? resolved_delivery_address?.street_address : null
        });

        // Send Confirmation Email (using real function)
        try {
             await send_email({
                 to: req.user.email, subject: `Your StreetEats Hub Order #${order_number} Confirmed!`,
                 text_body: `Thank you for your order!\n\nOrder Number: ${order_number}\nTruck: ${truck.name}\nTotal: $${calculated_total_amount.toFixed(2)}\nType: ${fulfillment_type}\n\nYou can track your order status in the app.`
             });
        } catch (email_err) { console.error("Failed to send confirmation email:", email_err); }

        // --- 11. Send Response ---
        res.status(201).json({
            order_uid: order_uid, order_number: order_number, status: 'pending_confirmation',
            estimated_ready_time: estimated_ready_time, estimated_delivery_time: estimated_delivery_time,
            total_amount: parseFloat(calculated_total_amount.toFixed(2)), fulfillment_type: fulfillment_type,
            pickup_location_address_snapshot: pickup_location_snapshot,
            delivery_address_snapshot: fulfillment_type === 'delivery' ? JSON.parse(delivery_address_snapshot_json) : null
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK'); // Ensure rollback on any error
        console.error("Error creating order:", err);
        // Return specific error types based on messages
        if (err.message.includes("unavailable") || err.message.includes("delivery radius") || err.message.includes("minimum") || err.message.includes("does not belong to item")) {
             res.status(409).json({ error: err.message }); // Conflict/business rule
        } else if (err.message.includes("Payment failed")) {
             res.status(402).json({ error: err.message }); // Payment Required
        } else if (err.status === 404 || err.message.includes('not found')) {
             res.status(404).json({ error: err.message });
        } else if (err.status === 400 || err.message.includes('Invalid')) {
             res.status(400).json({ error: err.message });
        } else {
             res.status(500).json({ error: 'Failed to create order due to an internal error.' });
        }
    } finally {
        if (client) client.release();
    }
});


// --- II.B.5. Order Tracking & History (Customer) ---

// 1. GET /orders/me/active
app.get('/orders/me/active', authenticate_token, require_role('customer'), async (req, res) => {
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT
                o.uid as order_uid, o.order_number, o.status, o.total_amount, o.order_time,
                o.estimated_ready_time, o.estimated_delivery_time, o.fulfillment_type,
                ft.name as food_truck_name,
                CASE WHEN o.status >= 'accepted' THEN ft.customer_support_phone_number ELSE NULL END as support_phone_number
            FROM orders o
            JOIN food_trucks ft ON o.food_truck_uid = ft.uid
            WHERE o.customer_user_uid = $1
              AND o.status NOT IN ('completed', 'delivered', 'cancelled', 'rejected')
            ORDER BY o.order_time DESC;
        `;
        const result = await client.query(query, [customer_user_uid]);
        const orders = result.rows.map(order => ({
            ...order, total_amount: parseFloat(order.total_amount),
            estimated_ready_time: order.estimated_ready_time ? parseInt(order.estimated_ready_time, 10) : null,
            estimated_delivery_time: order.estimated_delivery_time ? parseInt(order.estimated_delivery_time, 10) : null,
            order_time: parseInt(order.order_time, 10)
        }));
        res.status(200).json(orders);
    } catch (err) {
        console.error("Error fetching active orders:", err);
        res.status(500).json({ error: 'Failed to retrieve active orders.' });
    } finally {
        if (client) client.release();
    }
});

// 2. GET /orders/me/history
app.get('/orders/me/history', authenticate_token, require_role('customer'), async (req, res) => {
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT
                o.uid as order_uid, o.order_number, o.status, o.total_amount, o.order_time,
                COALESCE(o.completed_or_delivered_at, o.updated_at) as finalized_time,
                ft.name as food_truck_name
            FROM orders o
            JOIN food_trucks ft ON o.food_truck_uid = ft.uid
            WHERE o.customer_user_uid = $1
              AND o.status IN ('completed', 'delivered', 'cancelled', 'rejected')
            ORDER BY o.order_time DESC;
        `;
        const result = await client.query(query, [customer_user_uid]);
         const orders = result.rows.map(order => ({
            ...order, total_amount: parseFloat(order.total_amount),
            order_time: parseInt(order.order_time, 10),
            finalized_time: order.finalized_time ? parseInt(order.finalized_time, 10) : null
        }));
        res.status(200).json(orders);
    } catch (err) {
        console.error("Error fetching order history:", err);
        res.status(500).json({ error: 'Failed to retrieve order history.' });
    } finally {
        if (client) client.release();
    }
});

// 3. GET /orders/me/{order_uid}
app.get('/orders/me/:order_uid', authenticate_token, require_role('customer'), async (req, res) => {
    const { order_uid } = req.params;
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const order_query = `
            SELECT o.*, ft.name as food_truck_name,
                   CASE WHEN o.status >= 'accepted' THEN ft.customer_support_phone_number ELSE NULL END as support_phone_number
            FROM orders o JOIN food_trucks ft ON o.food_truck_uid = ft.uid
            WHERE o.uid = $1 AND o.customer_user_uid = $2;
        `;
        const order_result = await client.query(order_query, [order_uid, customer_user_uid]);
        if (order_result.rowCount === 0) { return res.status(404).json({ error: 'Order not found or permission denied.' }); }
        const order_data = order_result.rows[0];

        const items_query = `
            SELECT oi.uid as order_item_uid, oi.item_name_snapshot, oi.quantity, oi.total_item_price,
                   oio.option_name_snapshot, oio.price_adjustment_snapshot
            FROM order_items oi LEFT JOIN order_item_options oio ON oi.uid = oio.order_item_uid
            WHERE oi.order_uid = $1 ORDER BY oi.created_at, oio.created_at;
        `;
        const items_result = await client.query(items_query, [order_uid]);
        const items_map = {};
        for (const row of items_result.rows) {
            if (!items_map[row.order_item_uid]) { items_map[row.order_item_uid] = { order_item_uid: row.order_item_uid, item_name_snapshot: row.item_name_snapshot, quantity: parseInt(row.quantity, 10), total_item_price: parseFloat(row.total_item_price), selected_options: [] }; }
            if (row.option_name_snapshot) { items_map[row.order_item_uid].selected_options.push({ option_name_snapshot: row.option_name_snapshot, price_adjustment_snapshot: parseFloat(row.price_adjustment_snapshot) }); }
        }

        const response = { ...order_data,
            subtotal: parseFloat(order_data.subtotal), tax_amount: parseFloat(order_data.tax_amount), delivery_fee_charged: parseFloat(order_data.delivery_fee_charged), total_amount: parseFloat(order_data.total_amount),
            delivery_address_snapshot: order_data.delivery_address_snapshot ? JSON.parse(order_data.delivery_address_snapshot) : null,
            order_time: parseInt(order_data.order_time, 10), estimated_ready_time: order_data.estimated_ready_time ? parseInt(order_data.estimated_ready_time, 10) : null, estimated_delivery_time: order_data.estimated_delivery_time ? parseInt(order_data.estimated_delivery_time, 10) : null,
            preparation_started_at: order_data.preparation_started_at ? parseInt(order_data.preparation_started_at, 10) : null, ready_or_out_for_delivery_at: order_data.ready_or_out_for_delivery_at ? parseInt(order_data.ready_or_out_for_delivery_at, 10) : null, completed_or_delivered_at: order_data.completed_or_delivered_at ? parseInt(order_data.completed_or_delivered_at, 10) : null,
            created_at: parseInt(order_data.created_at, 10), updated_at: parseInt(order_data.updated_at, 10),
            items: Object.values(items_map)
        };
        delete response.payment_gateway_charge_id; // Don't expose payment ID
        res.status(200).json(response);
    } catch (err) {
        console.error("Error fetching order details:", err);
        res.status(500).json({ error: 'Failed to retrieve order details.' });
    } finally {
        if (client) client.release();
    }
});

// 4. POST /orders/me/{order_uid}/request_cancellation
app.post('/orders/me/:order_uid/request_cancellation', authenticate_token, require_role('customer'), async (req, res) => {
    const { order_uid } = req.params;
    const customer_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const order_check_query = `SELECT status, food_truck_uid, order_number FROM orders WHERE uid = $1 AND customer_user_uid = $2 FOR UPDATE;`;
        const order_check_result = await client.query(order_check_query, [order_uid, customer_user_uid]);
        if (order_check_result.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found or permission denied.' }); }
        const { status: current_status, food_truck_uid, order_number } = order_check_result.rows[0];

        if (current_status !== 'accepted') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Order cannot be cancelled at this stage (status: ${current_status}).` }); }

        const now = Date.now();
        await client.query(`UPDATE orders SET status = 'cancellation_requested', updated_at = $1 WHERE uid = $2;`, [now, order_uid]);
        await client.query('COMMIT');

        // Notify operator
         const operator_uid_result = await client.query('SELECT operator_user_uid FROM food_trucks WHERE uid = $1', [food_truck_uid]);
         if (operator_uid_result.rowCount > 0) {
             emit_to_user('operator', operator_uid_result.rows[0].operator_user_uid, 'customer_cancellation_request', { order_uid: order_uid, order_number: order_number });
         }
        res.status(200).json({ message: 'Cancellation requested. The operator will be notified.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error requesting order cancellation:", err);
        res.status(500).json({ error: 'Failed to request order cancellation.' });
    } finally {
        if (client) client.release();
    }
});


// --- II.B.6. Operator Truck & Profile Management ---

// Helper to get operator's truck UID (reusable)
const get_operator_truck_uid = async (operator_user_uid, client) => {
    // Use the passed client if available, otherwise connect
    const use_external_client = !!client;
    let internal_client = client;
    try {
        if (!use_external_client) internal_client = await pool.connect();
        const truck_uid_query = 'SELECT uid FROM food_trucks WHERE operator_user_uid = $1;';
        const result = await internal_client.query(truck_uid_query, [operator_user_uid]);
        if (result.rowCount === 0) { throw new Error('Food truck not found for this operator.'); }
        return result.rows[0].uid;
    } finally {
        if (!use_external_client && internal_client) internal_client.release();
    }
};

// 1. GET /operators/me/truck
app.get('/operators/me/truck', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const query = `SELECT * FROM food_trucks WHERE operator_user_uid = $1;`; // Get all fields
        const result = await client.query(query, [operator_user_uid]);
        if (result.rowCount === 0) { return res.status(404).json({ error: 'Food truck not found for this operator.' }); }
        const truck_data = result.rows[0];
        const response_data = { // Format according to BRD
            uid: truck_data.uid, name: truck_data.name, description: truck_data.description, cuisine_type: truck_data.cuisine_type, logo_url: truck_data.logo_url,
            standard_operating_hours: truck_data.standard_operating_hours ? JSON.parse(truck_data.standard_operating_hours) : null,
            current_status: truck_data.current_status,
            location: { latitude: truck_data.location_latitude, longitude: truck_data.location_longitude, address: truck_data.current_location_address },
            delivery_settings: { enabled: truck_data.delivery_enabled, fee: truck_data.delivery_fee ? parseFloat(truck_data.delivery_fee) : null, minimum_order_value: truck_data.delivery_minimum_order_value ? parseFloat(truck_data.delivery_minimum_order_value) : null, radius_km: truck_data.delivery_radius_km ? parseFloat(truck_data.delivery_radius_km) : null },
            payout_configured_status: truck_data.payout_configured_status, average_preparation_minutes: parseInt(truck_data.average_preparation_minutes, 10), customer_support_phone_number: truck_data.customer_support_phone_number
        };
        res.status(200).json(response_data);
    } catch (err) {
        console.error("Error fetching operator truck:", err);
         if (err instanceof SyntaxError) { res.status(500).json({ error: 'Failed to parse truck operating hours data.' }); }
         else { res.status(500).json({ error: 'Failed to retrieve truck profile.' }); }
    } finally {
        if (client) client.release();
    }
});

// 2. PUT /operators/me/truck (Handles logo upload via multer 'logo' field)
app.put('/operators/me/truck', authenticate_token, require_role('operator'), upload.single('logo'), async (req, res, next) => { // Pass next for central error handler
    const operator_user_uid = req.user.uid;
    const { name, description, cuisine_type, customer_support_phone_number } = req.body;
    const logo_file = req.file;

    const update_fields = {};
    if (name !== undefined) update_fields.name = name;
    if (description !== undefined) update_fields.description = description;
    if (cuisine_type !== undefined) update_fields.cuisine_type = cuisine_type;
    if (customer_support_phone_number !== undefined) update_fields.customer_support_phone_number = customer_support_phone_number;
    if (logo_file) { update_fields.logo_url = `${BASE_URL}${STORAGE_URL_PREFIX}${logo_file.filename}`; }

    if (Object.keys(update_fields).length === 0) {
        return res.status(400).json({ error: 'No update fields provided.' });
    }

    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();

        const set_clauses = Object.keys(update_fields).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(update_fields);
        values.push(now); values.push(truck_uid);

        const update_query = `UPDATE food_trucks SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1} WHERE uid = $${values.length} RETURNING *;`;
        const result = await client.query(update_query, values);
        if (result.rowCount === 0) { return res.status(404).json({ error: 'Truck not found or update failed.' }); }

        // Return updated truck data using the GET endpoint's logic for consistency
        const updated_truck_res = await client.query(`SELECT * FROM food_trucks WHERE uid = $1;`, [truck_uid]);
        const truck_data = updated_truck_res.rows[0];
        const response_data = { /* ... format as in GET /operators/me/truck ... */
             uid: truck_data.uid, name: truck_data.name, description: truck_data.description, cuisine_type: truck_data.cuisine_type, logo_url: truck_data.logo_url,
             standard_operating_hours: truck_data.standard_operating_hours ? JSON.parse(truck_data.standard_operating_hours) : null,
             current_status: truck_data.current_status,
             location: { latitude: truck_data.location_latitude, longitude: truck_data.location_longitude, address: truck_data.current_location_address },
             delivery_settings: { enabled: truck_data.delivery_enabled, fee: truck_data.delivery_fee ? parseFloat(truck_data.delivery_fee) : null, minimum_order_value: truck_data.delivery_minimum_order_value ? parseFloat(truck_data.delivery_minimum_order_value) : null, radius_km: truck_data.delivery_radius_km ? parseFloat(truck_data.delivery_radius_km) : null },
             payout_configured_status: truck_data.payout_configured_status, average_preparation_minutes: parseInt(truck_data.average_preparation_minutes, 10), customer_support_phone_number: truck_data.customer_support_phone_number
        };
        res.status(200).json(response_data);
    } catch (err) {
        // Pass error to central handler if not handled by multer
        next(err); // Let central handler manage DB/other errors
    } finally {
        if (client) client.release();
    }
});

// 3. PUT /operators/me/truck/operating_hours
app.put('/operators/me/truck/operating_hours', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const hours_data = req.body;
    if (typeof hours_data !== 'object' || hours_data === null) { return res.status(400).json({ error: 'Invalid operating hours format. Expected JSON object.' }); }
    let hours_json_string;
    try { hours_json_string = JSON.stringify(hours_data); }
    catch { return res.status(400).json({ error: 'Invalid JSON format for operating hours.' }); }

    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();
        await client.query(`UPDATE food_trucks SET standard_operating_hours = $1, updated_at = $2 WHERE uid = $3;`, [hours_json_string, now, truck_uid]);
        res.status(200).json({ message: 'Operating hours updated successfully.' });
    } catch (err) {
        console.error("Error updating operating hours:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: 'Failed to update operating hours.' }); }
    } finally {
        if (client) client.release();
    }
});

// 4. PUT /operators/me/truck/status
app.put('/operators/me/truck/status', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const { status } = req.body;
    if (!status || !['online', 'offline', 'paused'].includes(status)) { return res.status(400).json({ error: "Invalid status value. Must be 'online', 'offline', or 'paused'." }); }
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();
        const result = await client.query(`UPDATE food_trucks SET current_status = $1, updated_at = $2 WHERE uid = $3 RETURNING uid, current_status;`, [status, now, truck_uid]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error updating truck status:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: 'Failed to update truck status.' }); }
    } finally {
        if (client) client.release();
    }
});

// 5. PUT /operators/me/truck/location
app.put('/operators/me/truck/location', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const { address, latitude, longitude } = req.body;
    if (!address && (latitude === undefined || longitude === undefined)) { return res.status(400).json({ error: 'Either address or both latitude and longitude are required.' }); }
    let client;
    let final_lat = latitude !== undefined ? parseFloat(latitude) : undefined;
    let final_lon = longitude !== undefined ? parseFloat(longitude) : undefined;
    let final_address = address;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();

        if (address && (final_lat === undefined || final_lon === undefined || isNaN(final_lat) || isNaN(final_lon))) {
            const coords = await geocode_address({ address }); // Use real geocoder
            final_lat = coords.latitude;
            final_lon = coords.longitude;
        } else if (!address && final_lat !== undefined && final_lon !== undefined && !isNaN(final_lat) && !isNaN(final_lon)) {
             const addr_info = await reverse_geocode_coords({ latitude: final_lat, longitude: final_lon }); // Use real reverse geocoder
             final_address = addr_info.address;
        }
        if (final_lat === undefined || final_lon === undefined || isNaN(final_lat) || isNaN(final_lon)) { throw new Error("Could not determine valid coordinates for location."); }

        const result = await client.query(`UPDATE food_trucks SET current_location_address = $1, location_latitude = $2, location_longitude = $3, updated_at = $4 WHERE uid = $5 RETURNING uid, current_location_address, location_latitude, location_longitude;`, [final_address || null, final_lat, final_lon, now, truck_uid]);
         res.status(200).json({ uid: result.rows[0].uid, location: { latitude: result.rows[0].location_latitude, longitude: result.rows[0].location_longitude, address: result.rows[0].current_location_address } });
    } catch (err) {
        console.error("Error updating truck location:", err);
        if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
        else if (err.message.includes('Geocoding failed') || err.message.includes('Mapbox')) { res.status(400).json({ error: 'Failed to verify address location.' }); }
        else { res.status(500).json({ error: 'Failed to update truck location.' }); }
    } finally {
        if (client) client.release();
    }
});

// 6. PUT /operators/me/truck/delivery_settings
app.put('/operators/me/truck/delivery_settings', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const { enabled, fee, minimum_order_value, radius_km } = req.body;
    if (enabled === undefined) { return res.status(400).json({ error: 'Missing required field: enabled (boolean).' }); }
    const is_enabled = !!enabled; // Ensure boolean
    const parsed_fee = is_enabled ? parseFloat(fee) : null;
    const parsed_min_order = is_enabled ? parseFloat(minimum_order_value) : null;
    const parsed_radius = is_enabled ? parseFloat(radius_km) : null;
    if (is_enabled && (isNaN(parsed_fee) || parsed_fee < 0 || isNaN(parsed_min_order) || parsed_min_order < 0 || isNaN(parsed_radius) || parsed_radius < 0)) {
        return res.status(400).json({ error: 'Invalid delivery settings: Fee, minimum order, and radius must be non-negative numbers when enabled.' });
    }
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();
        const result = await client.query(`UPDATE food_trucks SET delivery_enabled = $1, delivery_fee = $2, delivery_minimum_order_value = $3, delivery_radius_km = $4, updated_at = $5 WHERE uid = $6 RETURNING uid, delivery_enabled, delivery_fee, delivery_minimum_order_value, delivery_radius_km;`, [is_enabled, parsed_fee, parsed_min_order, parsed_radius, now, truck_uid]);
         res.status(200).json({ uid: result.rows[0].uid, delivery_settings: { enabled: result.rows[0].delivery_enabled, fee: result.rows[0].delivery_fee ? parseFloat(result.rows[0].delivery_fee) : null, minimum_order_value: result.rows[0].delivery_minimum_order_value ? parseFloat(result.rows[0].delivery_minimum_order_value) : null, radius_km: result.rows[0].delivery_radius_km ? parseFloat(result.rows[0].delivery_radius_km) : null } });
    } catch (err) {
        console.error("Error updating delivery settings:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: 'Failed to update delivery settings.' }); }
    } finally {
        if (client) client.release();
    }
});

// 7. PUT /operators/me/truck/preparation_time
app.put('/operators/me/truck/preparation_time', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const { minutes } = req.body;
    const prep_minutes = parseInt(minutes, 10);
    if (isNaN(prep_minutes) || prep_minutes <= 0) { return res.status(400).json({ error: 'Invalid preparation time: Minutes must be a positive integer.' }); }
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();
        const result = await client.query(`UPDATE food_trucks SET average_preparation_minutes = $1, updated_at = $2 WHERE uid = $3 RETURNING uid, average_preparation_minutes;`, [prep_minutes, now, truck_uid]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error updating preparation time:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: 'Failed to update preparation time.' }); }
    } finally {
        if (client) client.release();
    }
});

// 8. POST /operators/me/truck/payout_config
app.post('/operators/me/truck/payout_config', authenticate_token, require_role('operator'), async (req, res) => {
    const operator_user_uid = req.user.uid;
    const { return_url, refresh_url } = req.body;
    if (!return_url || !refresh_url) { return res.status(400).json({ error: 'Return URL and refresh URL are required.' }); }
    let client;
    try {
        client = await pool.connect(); // Needed for getOrCreateStripeAccount potentially
        // Initiate onboarding (using real function)
        const result = await initiate_payout_onboarding({ operator_email: req.user.email, return_url: return_url, refresh_url: refresh_url }, client);
        // Optionally update DB status to 'pending' here if needed
        // await client.query("UPDATE food_trucks SET payout_configured_status='pending', updated_at=$1 WHERE operator_user_uid=$2", [Date.now(), operator_user_uid]);
        res.status(200).json({ onboarding_url: result.onboarding_url });
    } catch (err) {
        console.error("Error initiating payout configuration:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: err.message || 'Failed to initiate payout configuration process.' }); }
    } finally {
        if (client) client.release();
    }
});


// --- II.B.7. Operator Menu Management ---

// 1. GET /operators/me/menu
app.get('/operators/me/menu', authenticate_token, require_role('operator'), async (req, res) => {
     const operator_user_uid = req.user.uid;
     let client;
     try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        // Fetch Menu Structure (including unavailable, same logic as GET /food_trucks/:truck_uid)
        const menu_query = `SELECT mc.uid as category_uid, mc.name as category_name, mc.display_order as category_order, mc.is_available as category_available, mi.uid as item_uid, mi.name as item_name, mi.description as item_description, mi.base_price as item_base_price, mi.photo_url as item_photo_url, mi.is_available as item_available, mi.display_order as item_order, mg.uid as group_uid, mg.name as group_name, mg.selection_type as group_selection_type, mg.is_required as group_is_required, mo.uid as option_uid, mo.name as option_name, mo.price_adjustment as option_price_adjustment FROM menu_categories mc LEFT JOIN menu_items mi ON mc.uid = mi.menu_category_uid LEFT JOIN modifier_groups mg ON mi.uid = mg.menu_item_uid LEFT JOIN modifier_options mo ON mg.uid = mo.modifier_group_uid WHERE mc.food_truck_uid = $1 ORDER BY mc.display_order, mc.name, mi.display_order, mi.name, mg.uid, mo.name;`;
        const menu_result = await client.query(menu_query, [truck_uid]);
        // Process into nested structure (same logic as GET /food_trucks/:truck_uid)
         const menu_map = {};
         for (const row of menu_result.rows) {
             if (!menu_map[row.category_uid]) { menu_map[row.category_uid] = { category_uid: row.category_uid, category_name: row.category_name, display_order: row.category_order, is_available: row.category_available, items_map: {} }; }
             const category = menu_map[row.category_uid];
             if (row.item_uid && !category.items_map[row.item_uid]) { category.items_map[row.item_uid] = { item_uid: row.item_uid, item_name: row.item_name, description: row.item_description, base_price: parseFloat(row.item_base_price), photo_url: row.item_photo_url, is_available: row.item_available, display_order: row.item_order, modifier_groups_map: {} }; }
             if (!row.item_uid) continue; const item = category.items_map[row.item_uid];
             if (row.group_uid && !item.modifier_groups_map[row.group_uid]) { item.modifier_groups_map[row.group_uid] = { group_uid: row.group_uid, group_name: row.group_name, selection_type: row.group_selection_type, is_required: row.group_is_required, options: [] }; }
             if (!row.group_uid) continue; const group = item.modifier_groups_map[row.group_uid];
             if (row.option_uid && !group.options.find(opt => opt.option_uid === row.option_uid)) { group.options.push({ option_uid: row.option_uid, option_name: row.option_name, price_adjustment: parseFloat(row.option_price_adjustment) }); }
         }
         const final_menu = Object.values(menu_map).sort((a,b) => a.display_order - b.display_order).map(cat => ({ ...cat, items: Object.values(cat.items_map).sort((a,b) => a.display_order - b.display_order).map(item => ({ ...item, modifier_groups: Object.values(item.modifier_groups_map) })) }));
         final_menu.forEach(cat => { delete cat.items_map; cat.items.forEach(item => delete item.modifier_groups_map); });
         res.status(200).json(final_menu);
     } catch (err) {
        console.error("Error fetching operator menu:", err);
         if (err.message.includes('Food truck not found')) { res.status(404).json({ error: err.message }); }
         else { res.status(500).json({ error: 'Failed to retrieve menu.' }); }
    } finally {
        if (client) client.release();
    }
});

// --- Menu Management CRUD Endpoints ---

// Helper to verify ownership before menu modifications
const verify_menu_ownership = async (client, operator_user_uid, { category_uid, item_uid, group_uid, option_uid }) => {
    let query = '';
    let values = [];
    if (option_uid) {
        query = `SELECT mc.food_truck_uid FROM modifier_options mo JOIN modifier_groups mg ON mo.modifier_group_uid = mg.uid JOIN menu_items mi ON mg.menu_item_uid = mi.uid JOIN menu_categories mc ON mi.menu_category_uid = mc.uid WHERE mo.uid = $1;`;
        values = [option_uid];
    } else if (group_uid) {
        query = `SELECT mc.food_truck_uid FROM modifier_groups mg JOIN menu_items mi ON mg.menu_item_uid = mi.uid JOIN menu_categories mc ON mi.menu_category_uid = mc.uid WHERE mg.uid = $1;`;
        values = [group_uid];
    } else if (item_uid) {
        query = `SELECT mc.food_truck_uid FROM menu_items mi JOIN menu_categories mc ON mi.menu_category_uid = mc.uid WHERE mi.uid = $1;`;
        values = [item_uid];
    } else if (category_uid) {
        query = `SELECT food_truck_uid FROM menu_categories WHERE uid = $1;`;
        values = [category_uid];
    } else {
        throw new Error("No UID provided for ownership check.");
    }
    const truck_uid_owner_result = await client.query(query, values);
    if (truck_uid_owner_result.rowCount === 0) throw new Error("Menu entity not found.");
    const owner_truck_uid = truck_uid_owner_result.rows[0].food_truck_uid;

    const operator_truck_uid = await get_operator_truck_uid(operator_user_uid, client);
    if (owner_truck_uid !== operator_truck_uid) throw new Error("Permission denied: Entity does not belong to this operator's truck.");
    return operator_truck_uid; // Return truck_uid for convenience
};

// 2. POST /operators/me/menu/categories
app.post('/operators/me/menu/categories', authenticate_token, require_role('operator'), async (req, res) => {
    const { name } = req.body;
    if (!name) { return res.status(400).json({ error: 'Category name is required.' }); }
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const now = Date.now();
        // Get next display order
        const order_res = await client.query('SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM menu_categories WHERE food_truck_uid = $1', [truck_uid]);
        const next_order = order_res.rows[0].next_order;

        const uid = uuidv4();
        const result = await client.query(`INSERT INTO menu_categories (uid, food_truck_uid, name, display_order, is_available, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, $5, $6) RETURNING uid as category_uid, name as category_name, display_order, is_available;`, [uid, truck_uid, name, next_order, now, now]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error creating category:", err);
        res.status(500).json({ error: 'Failed to create category.' });
    } finally { if (client) client.release(); }
});

// 3. PUT /operators/me/menu/categories/{category_uid}
app.put('/operators/me/menu/categories/:category_uid', authenticate_token, require_role('operator'), async (req, res) => {
    const { category_uid } = req.params;
    const { name, is_available /*, display_order */ } = req.body;
    if (name === undefined && is_available === undefined) return res.status(400).json({ error: 'No update fields provided (name, is_available).' });
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { category_uid }); // Verify ownership
        const now = Date.now();
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (is_available !== undefined) updates.is_available = !!is_available;
        // display_order update is complex, handle separately if needed

        const set_clauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates); values.push(now); values.push(category_uid);
        const result = await client.query(`UPDATE menu_categories SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1} WHERE uid = $${values.length} RETURNING uid as category_uid, name as category_name, display_order, is_available;`, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error updating category:", err);
        if (err.message.includes('Permission denied')) return res.status(403).json({ error: err.message });
        if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
        res.status(500).json({ error: 'Failed to update category.' });
    } finally { if (client) client.release(); }
});

// 4. DELETE /operators/me/menu/categories/{category_uid}
app.delete('/operators/me/menu/categories/:category_uid', authenticate_token, require_role('operator'), async (req, res) => {
    const { category_uid } = req.params;
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { category_uid }); // Verify ownership
        // Schema has ON DELETE CASCADE, so items/groups/options will be deleted too
        const result = await client.query('DELETE FROM menu_categories WHERE uid = $1;', [category_uid]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
        res.status(200).json({ message: 'Category deleted successfully (including items within).' });
    } catch (err) {
        console.error("Error deleting category:", err);
        if (err.message.includes('Permission denied')) return res.status(403).json({ error: err.message });
        if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
        res.status(500).json({ error: 'Failed to delete category.' });
    } finally { if (client) client.release(); }
});

// 5. POST /operators/me/menu/items
app.post('/operators/me/menu/items', authenticate_token, require_role('operator'), upload.single('photo'), async (req, res, next) => {
    const { menu_category_uid, name, description, base_price } = req.body;
    const photo_file = req.file;
    if (!menu_category_uid || !name || base_price === undefined) return res.status(400).json({ error: 'Missing required fields (menu_category_uid, name, base_price).' });
    const price = parseFloat(base_price);
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid base_price.' });
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await verify_menu_ownership(client, operator_user_uid, { category_uid: menu_category_uid }); // Verify category ownership
        const now = Date.now();
        const order_res = await client.query('SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM menu_items WHERE menu_category_uid = $1', [menu_category_uid]);
        const next_order = order_res.rows[0].next_order;
        const photo_url = photo_file ? `${BASE_URL}${STORAGE_URL_PREFIX}${photo_file.filename}` : null;

        const uid = uuidv4();
        const result = await client.query(`INSERT INTO menu_items (uid, food_truck_uid, menu_category_uid, name, description, base_price, photo_url, is_available, display_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10) RETURNING uid as item_uid, name as item_name, description, base_price, photo_url, is_available, display_order, menu_category_uid;`, [uid, truck_uid, menu_category_uid, name, description || null, price.toFixed(2), photo_url, next_order, now, now]);
        res.status(201).json({ ...result.rows[0], base_price: parseFloat(result.rows[0].base_price), modifier_groups: [] }); // Add empty groups array
    } catch (err) { next(err); } // Pass to central error handler
    finally { if (client) client.release(); }
});

// 6. PUT /operators/me/menu/items/{item_uid}
app.put('/operators/me/menu/items/:item_uid', authenticate_token, require_role('operator'), upload.single('photo'), async (req, res, next) => {
    const { item_uid } = req.params;
    const { menu_category_uid, name, description, base_price, is_available /*, display_order */ } = req.body;
    const photo_file = req.file;
    const operator_user_uid = req.user.uid;

    const updates = {};
    if (menu_category_uid !== undefined) updates.menu_category_uid = menu_category_uid;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (base_price !== undefined) { const price = parseFloat(base_price); if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid base_price.' }); updates.base_price = price.toFixed(2); }
    if (is_available !== undefined) updates.is_available = !!is_available;
    if (photo_file) { updates.photo_url = `${BASE_URL}${STORAGE_URL_PREFIX}${photo_file.filename}`; }
    // display_order update is complex

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No update fields provided.' });

    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { item_uid }); // Verify item ownership
        // If moving category, verify target category ownership
        if (updates.menu_category_uid) { await verify_menu_ownership(client, operator_user_uid, { category_uid: updates.menu_category_uid }); }
        const now = Date.now();

        const set_clauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates); values.push(now); values.push(item_uid);
        const result = await client.query(`UPDATE menu_items SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1} WHERE uid = $${values.length} RETURNING uid as item_uid, name as item_name, description, base_price, photo_url, is_available, display_order, menu_category_uid;`, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found.' });
        res.status(200).json({ ...result.rows[0], base_price: parseFloat(result.rows[0].base_price) });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 7. DELETE /operators/me/menu/items/{item_uid}
app.delete('/operators/me/menu/items/:item_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { item_uid } = req.params;
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { item_uid }); // Verify ownership
        // Schema has ON DELETE CASCADE for groups/options
        const result = await client.query('DELETE FROM menu_items WHERE uid = $1;', [item_uid]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found.' });
        res.status(200).json({ message: 'Menu item deleted successfully (including modifiers).' });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 8. POST /operators/me/menu/items/{item_uid}/modifier_groups
app.post('/operators/me/menu/items/:item_uid/modifier_groups', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { item_uid } = req.params;
    const { name, selection_type, is_required } = req.body;
    if (!name || !selection_type || !['single', 'multiple'].includes(selection_type) || is_required === undefined) return res.status(400).json({ error: 'Missing/invalid fields (name, selection_type, is_required).' });
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { item_uid }); // Verify item ownership
        const now = Date.now();
        const uid = uuidv4();
        const result = await client.query(`INSERT INTO modifier_groups (uid, menu_item_uid, name, selection_type, is_required, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING uid as group_uid, name as group_name, selection_type, is_required;`, [uid, item_uid, name, selection_type, !!is_required, now, now]);
        res.status(201).json({ ...result.rows[0], options: [] });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 9. PUT /operators/me/menu/modifier_groups/{group_uid}
app.put('/operators/me/menu/modifier_groups/:group_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { group_uid } = req.params;
    const { name, selection_type, is_required } = req.body;
    const operator_user_uid = req.user.uid;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (selection_type !== undefined) { if (!['single', 'multiple'].includes(selection_type)) return res.status(400).json({ error: 'Invalid selection_type.' }); updates.selection_type = selection_type; }
    if (is_required !== undefined) updates.is_required = !!is_required;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No update fields provided.' });
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { group_uid }); // Verify ownership
        const now = Date.now();
        const set_clauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates); values.push(now); values.push(group_uid);
        const result = await client.query(`UPDATE modifier_groups SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1} WHERE uid = $${values.length} RETURNING uid as group_uid, name as group_name, selection_type, is_required;`, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Modifier group not found.' });
        res.status(200).json(result.rows[0]);
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 10. DELETE /operators/me/menu/modifier_groups/{group_uid}
app.delete('/operators/me/menu/modifier_groups/:group_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { group_uid } = req.params;
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { group_uid }); // Verify ownership
        // Schema has ON DELETE CASCADE for options
        const result = await client.query('DELETE FROM modifier_groups WHERE uid = $1;', [group_uid]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Modifier group not found.' });
        res.status(200).json({ message: 'Modifier group deleted successfully (including options).' });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 11. POST /operators/me/menu/modifier_groups/{group_uid}/options
app.post('/operators/me/menu/modifier_groups/:group_uid/options', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { group_uid } = req.params;
    const { name, price_adjustment } = req.body;
    if (!name || price_adjustment === undefined) return res.status(400).json({ error: 'Missing required fields (name, price_adjustment).' });
    const price = parseFloat(price_adjustment);
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price_adjustment.' });
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { group_uid }); // Verify group ownership
        const now = Date.now();
        const uid = uuidv4();
        const result = await client.query(`INSERT INTO modifier_options (uid, modifier_group_uid, name, price_adjustment, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING uid as option_uid, name as option_name, price_adjustment;`, [uid, group_uid, name, price.toFixed(2), now, now]);
        res.status(201).json({ ...result.rows[0], price_adjustment: parseFloat(result.rows[0].price_adjustment) });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 12. PUT /operators/me/menu/modifier_options/{option_uid}
app.put('/operators/me/menu/modifier_options/:option_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { option_uid } = req.params;
    const { name, price_adjustment } = req.body;
    const operator_user_uid = req.user.uid;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price_adjustment !== undefined) { const price = parseFloat(price_adjustment); if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price_adjustment.' }); updates.price_adjustment = price.toFixed(2); }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No update fields provided.' });
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { option_uid }); // Verify ownership
        const now = Date.now();
        const set_clauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates); values.push(now); values.push(option_uid);
        const result = await client.query(`UPDATE modifier_options SET ${set_clauses.join(', ')}, updated_at = $${values.length - 1} WHERE uid = $${values.length} RETURNING uid as option_uid, name as option_name, price_adjustment;`, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Modifier option not found.' });
        res.status(200).json({ ...result.rows[0], price_adjustment: parseFloat(result.rows[0].price_adjustment) });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 13. DELETE /operators/me/menu/modifier_options/{option_uid}
app.delete('/operators/me/menu/modifier_options/:option_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { option_uid } = req.params;
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        await verify_menu_ownership(client, operator_user_uid, { option_uid }); // Verify ownership
        const result = await client.query('DELETE FROM modifier_options WHERE uid = $1;', [option_uid]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Modifier option not found.' });
        res.status(200).json({ message: 'Modifier option deleted successfully.' });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// --- II.B.8. Operator Order Management ---

// 1. GET /operators/me/orders
app.get('/operators/me/orders', authenticate_token, require_role('operator'), async (req, res, next) => {
    const operator_user_uid = req.user.uid;
    const { status, date_from, date_to, page = 1, limit = 20 } = req.query;
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        let base_query = `FROM orders o JOIN users u ON o.customer_user_uid = u.uid WHERE o.food_truck_uid = $1`;
        const conditions = []; const values = [truck_uid]; let value_index = 2;
        if (status) {
            let status_list = status.split(',').map(s => s.trim());
            if (status === 'active') status_list = ['accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'cancellation_requested'];
            else if (status === 'pending') status_list = ['pending_confirmation'];
            else if (status === 'completed') status_list = ['completed', 'delivered', 'cancelled', 'rejected'];
            conditions.push(`o.status = ANY($${value_index++})`); values.push(status_list);
        }
        if (date_from) { conditions.push(`o.order_time >= $${value_index++}`); values.push(parseInt(date_from, 10)); }
        if (date_to) { conditions.push(`o.order_time <= $${value_index++}`); values.push(parseInt(date_to, 10)); }
        if (conditions.length > 0) base_query += ' AND ' + conditions.join(' AND ');

        const count_query = `SELECT COUNT(*) ${base_query}`;
        const count_result = await client.query(count_query, values);
        const total_orders = parseInt(count_result.rows[0].count, 10);
        const total_pages = Math.ceil(total_orders / limit);
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let sort_order = status === 'completed' ? 'ORDER BY o.order_time DESC' : 'ORDER BY o.order_time ASC';
        const data_query = `SELECT o.uid as order_uid, o.order_number, o.status, o.fulfillment_type, o.total_amount, o.order_time, u.first_name as customer_first_name, u.last_name as customer_last_name, o.delivery_address_snapshot ${base_query} ${sort_order} LIMIT $${value_index++} OFFSET $${value_index++}`;
        values.push(parseInt(limit, 10)); values.push(offset);
        const result = await client.query(data_query, values);

        const orders = result.rows.map(row => {
            let address_snippet = null;
            if (row.fulfillment_type === 'delivery' && row.delivery_address_snapshot) { try { const addr = JSON.parse(row.delivery_address_snapshot); address_snippet = addr.street_address; } catch { /* ignore */ } }
            return { order_uid: row.order_uid, order_number: row.order_number, customer_name: `${row.customer_first_name} ${row.customer_last_name.charAt(0)}.`, status: row.status, fulfillment_type: row.fulfillment_type, total_amount: parseFloat(row.total_amount), order_time: parseInt(row.order_time, 10), delivery_address_snippet: address_snippet };
        });
        res.status(200).json({ orders: orders, pagination: { current_page: parseInt(page, 10), total_pages: total_pages, total_orders: total_orders, limit: parseInt(limit, 10) } });
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 2. GET /operators/me/orders/{order_uid}
app.get('/operators/me/orders/:order_uid', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { order_uid } = req.params;
    const operator_user_uid = req.user.uid;
    let client;
    try {
        client = await pool.connect();
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const order_query = `SELECT o.*, u.first_name, u.last_name, u.phone_number FROM orders o JOIN users u ON o.customer_user_uid = u.uid WHERE o.uid = $1 AND o.food_truck_uid = $2;`;
        const order_result = await client.query(order_query, [order_uid, truck_uid]);
        if (order_result.rowCount === 0) { return res.status(404).json({ error: 'Order not found or not assigned to this truck.' }); }
        const order_data = order_result.rows[0];
        // Fetch items/options (same logic as customer GET order details)
        const items_query = `SELECT oi.uid as order_item_uid, oi.item_name_snapshot, oi.quantity, oi.total_item_price, oio.option_name_snapshot, oio.price_adjustment_snapshot FROM order_items oi LEFT JOIN order_item_options oio ON oi.uid = oio.order_item_uid WHERE oi.order_uid = $1 ORDER BY oi.created_at, oio.created_at;`;
        const items_result = await client.query(items_query, [order_uid]);
        const items_map = {}; items_result.rows.forEach(row => { if (!items_map[row.order_item_uid]) items_map[row.order_item_uid] = { order_item_uid: row.order_item_uid, item_name_snapshot: row.item_name_snapshot, quantity: parseInt(row.quantity, 10), total_item_price: parseFloat(row.total_item_price), selected_options: [] }; if (row.option_name_snapshot) items_map[row.order_item_uid].selected_options.push({ option_name_snapshot: row.option_name_snapshot, price_adjustment_snapshot: parseFloat(row.price_adjustment_snapshot) }); });
        // Format response for operator
        const response = { /* ... format as in BRD ... */
             order_uid: order_data.uid, order_number: order_data.order_number, customer_details: { name: `${order_data.first_name} ${order_data.last_name}`, phone: order_data.phone_number || null }, status: order_data.status, fulfillment_type: order_data.fulfillment_type, delivery_address_snapshot: order_data.delivery_address_snapshot ? JSON.parse(order_data.delivery_address_snapshot) : null, pickup_location_address_snapshot: order_data.pickup_location_address_snapshot, special_instructions: order_data.special_instructions, subtotal: parseFloat(order_data.subtotal), tax_amount: parseFloat(order_data.tax_amount), delivery_fee_charged: parseFloat(order_data.delivery_fee_charged), total_amount: parseFloat(order_data.total_amount), order_time: parseInt(order_data.order_time, 10), estimated_ready_time: order_data.estimated_ready_time ? parseInt(order_data.estimated_ready_time, 10) : null, estimated_delivery_time: order_data.estimated_delivery_time ? parseInt(order_data.estimated_delivery_time, 10) : null, preparation_started_at: order_data.preparation_started_at ? parseInt(order_data.preparation_started_at, 10) : null, ready_or_out_for_delivery_at: order_data.ready_or_out_for_delivery_at ? parseInt(order_data.ready_or_out_for_delivery_at, 10) : null, completed_or_delivered_at: order_data.completed_or_delivered_at ? parseInt(order_data.completed_or_delivered_at, 10) : null, rejection_reason: order_data.rejection_reason, cancellation_reason: order_data.cancellation_reason, items: Object.values(items_map)
        };
        res.status(200).json(response);
    } catch (err) { next(err); }
    finally { if (client) client.release(); }
});

// 3. PUT /operators/me/orders/{order_uid}/status
app.put('/operators/me/orders/:order_uid/status', authenticate_token, require_role('operator'), async (req, res, next) => {
    const { order_uid } = req.params;
    const operator_user_uid = req.user.uid;
    const { new_status, reason, updated_estimated_ready_time, updated_estimated_delivery_time } = req.body;
    if (!new_status) return res.status(400).json({ error: 'Missing required field: new_status.' });
    if ((new_status === 'rejected' || new_status === 'cancelled') && !reason) return res.status(400).json({ error: `Reason is required for status '${new_status}'.` });
    const valid_statuses = ['accepted', 'rejected', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'delivered', 'cancelled'];
    if (!valid_statuses.includes(new_status)) return res.status(400).json({ error: `Invalid target status: ${new_status}` });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const truck_uid = await get_operator_truck_uid(operator_user_uid, client);
        const order_check = await client.query(`SELECT status, customer_user_uid, payment_gateway_charge_id, fulfillment_type, order_number FROM orders WHERE uid = $1 AND food_truck_uid = $2 FOR UPDATE;`, [order_uid, truck_uid]);
        if (order_check.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found or not assigned to this truck.' }); }
        const { status: current_status, customer_user_uid, payment_gateway_charge_id, fulfillment_type, order_number } = order_check.rows[0];

        // Status Transition Validation
        const transitions = { 'pending_confirmation': ['accepted', 'rejected'], 'accepted': ['preparing', 'cancelled'], 'preparing': ['ready_for_pickup', 'out_for_delivery', 'cancelled'], 'ready_for_pickup': ['completed', 'cancelled'], 'out_for_delivery': ['delivered', 'cancelled'], 'cancellation_requested': ['cancelled', 'accepted'] };
        if (fulfillment_type === 'pickup' && current_status === 'preparing') transitions.preparing = ['ready_for_pickup', 'cancelled'];
        else if (fulfillment_type === 'delivery' && current_status === 'preparing') transitions.preparing = ['out_for_delivery', 'cancelled'];
        if (!transitions[current_status]?.includes(new_status) && !(current_status === 'cancellation_requested' && new_status === 'accepted')) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Invalid status transition from '${current_status}' to '${new_status}'.` }); }

        // Prepare Update
        const now = Date.now(); const updates = { status: new_status, updated_at: now }; let needs_refund = false;
        if (new_status === 'preparing') updates.preparation_started_at = now;
        if (new_status === 'ready_for_pickup' || new_status === 'out_for_delivery') updates.ready_or_out_for_delivery_at = now;
        if (new_status === 'completed' || new_status === 'delivered') updates.completed_or_delivered_at = now;
        if (new_status === 'rejected') { updates.rejection_reason = reason; needs_refund = true; }
        if (new_status === 'cancelled') { updates.cancellation_reason = reason; needs_refund = true; }
        if (current_status === 'pending_confirmation' && new_status === 'accepted') {
            if (updated_estimated_ready_time) updates.estimated_ready_time = parseInt(updated_estimated_ready_time, 10);
            if (updated_estimated_delivery_time) updates.estimated_delivery_time = parseInt(updated_estimated_delivery_time, 10);
        }

        // Execute Update
        const set_clauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates); values.push(order_uid);
        await client.query(`UPDATE orders SET ${set_clauses.join(', ')} WHERE uid = $${values.length};`, values);

        // Process Refund if needed (using real function)
        if (needs_refund && payment_gateway_charge_id) {
            try { await refund_payment_charge({ charge_id: payment_gateway_charge_id }); }
            catch (refund_error) { await client.query('ROLLBACK'); console.error(`Refund failed for order ${order_uid}:`, refund_error); return res.status(502).json({ error: `Order status updated, but refund failed: ${refund_error.message}` }); }
        }
        await client.query('COMMIT');

        // Send Notifications (Fetch final state for accuracy)
        const final_state = await client.query('SELECT status, estimated_ready_time, estimated_delivery_time, rejection_reason, cancellation_reason FROM orders WHERE uid=$1', [order_uid]);
        const final_data = final_state.rows[0];
        emit_to_user('customer', customer_user_uid, 'order_status_update_for_customer', { order_uid: order_uid, order_number: order_number, new_status: final_data.status, rejection_reason: final_data.rejection_reason, cancellation_reason: final_data.cancellation_reason, updated_estimated_ready_time: final_data.estimated_ready_time ? parseInt(final_data.estimated_ready_time, 10) : null, updated_estimated_delivery_time: final_data.estimated_delivery_time ? parseInt(final_data.estimated_delivery_time, 10) : null });
        // Send Email notifications (using real function)
        const customer_email_res = await client.query('SELECT email FROM users WHERE uid = $1', [customer_user_uid]);
        if (customer_email_res.rowCount > 0) {
             const customer_email = customer_email_res.rows[0].email; let subject = null; let body = null;
             if (new_status === 'rejected') { subject=`Order #${order_number} Rejected`; body=`Unfortunately, your order was rejected. Reason: ${reason}`; }
             else if (new_status === 'cancelled') { subject=`Order #${order_number} Cancelled`; body=`Your order has been cancelled. Reason: ${reason}. A refund has been issued.`; }
             else if (new_status === 'ready_for_pickup') { subject=`Order #${order_number} Ready for Pickup!`; body=`Your order is now ready for pickup.`; }
             else if (new_status === 'out_for_delivery') { subject=`Order #${order_number} Out for Delivery!`; body=`Your order is on its way!`; }
             if (subject && body) { try { await send_email({ to: customer_email, subject: subject, text_body: body }); } catch (e) { console.error("Failed status email:", e); } }
        }

        res.status(200).json({ order_uid: order_uid, status: final_data.status, updated_at: now, estimated_ready_time: final_data.estimated_ready_time ? parseInt(final_data.estimated_ready_time, 10) : null, estimated_delivery_time: final_data.estimated_delivery_time ? parseInt(final_data.estimated_delivery_time, 10) : null });
    } catch (err) { if (client) await client.query('ROLLBACK'); next(err); }
    finally { if (client) client.release(); }
});

// --- Centralized Error Handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err.message);
  // Handle specific error types
    if (err instanceof multer.MulterError) { return res.status(400).json({ error: `File upload error: ${err.message}` }); }
    if (err.message.includes('Only image files') || err.message.includes('permission denied') || err.message.includes('Invalid token purpose')) { return res.status(403).json({ error: err.message }); }
    if (err.message.includes('not found')) { return res.status(404).json({ error: err.message }); }
    if (err.code === '23505') { return res.status(409).json({ error: 'Data conflict occurred (e.g., duplicate entry).' }); } // DB Unique constraint
    if (err instanceof SyntaxError) { return res.status(400).json({ error: 'Invalid JSON format in request.' }); }
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) { return res.status(401).json({ error: 'Invalid or expired authentication token.' }); }

  // Default internal server error
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server!' });
});


// --- Start Server ---
server.listen(PORT, () => {
  console.log(`StreetEats Hub server running on ${BASE_URL}`);
});