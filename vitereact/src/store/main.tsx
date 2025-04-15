import { configureStore, createSlice, PayloadAction, combineReducers, Middleware } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // For notification IDs

// --- Interfaces & Types ---

// User structure based on Backend/Architecture docs
interface CurrentUser {
  uid: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'customer' | 'operator';
  phone_number: string | null;
  food_truck_uid?: string; // Only if role is 'operator'
}

// Auth Slice State
interface AuthState {
  auth_token: string | null;
  current_user: CurrentUser | null;
  auth_status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  auth_error: string | null;
}

// Cart Slice State
interface CartItemOption {
  option_uid: string;
  modifier_group_name_snapshot: string;
  option_name_snapshot: string;
  price_adjustment_snapshot: number;
}

interface CartItem {
  cart_item_id: string; // Local unique ID
  menu_item_uid: string;
  food_truck_uid: string;
  item_name_snapshot: string;
  quantity: number;
  base_price_snapshot: number;
  total_item_price: number;
  special_instructions: string | null;
  selected_options: CartItemOption[];
}

interface CartState {
  items: CartItem[];
  cart_metadata: {
    food_truck_uid: string | null;
    food_truck_name: string | null;
  };
}

// Notifications Slice State
interface AppNotification {
  id: string; // Use UUID string
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface NotificationsState {
  app_notifications: AppNotification[];
  websocket_status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

// Root State Type
interface RootState {
  auth: AuthState;
  cart: CartState;
  notifications: NotificationsState;
}

// --- Initial States ---

const initial_auth_state: AuthState = {
  auth_token: null,
  current_user: null,
  auth_status: 'idle',
  auth_error: null,
};

const initial_cart_state: CartState = {
  items: [],
  cart_metadata: {
    food_truck_uid: null,
    food_truck_name: null,
  },
};

const initial_notifications_state: NotificationsState = {
  app_notifications: [],
  websocket_status: 'disconnected',
};

// --- Auth Slice ---

const auth_slice = createSlice({
  name: 'auth',
  initialState: initial_auth_state,
  reducers: {
    set_auth_loading: (state) => {
      state.auth_status = 'loading';
      state.auth_error = null;
    },
    login_success: (state, action: PayloadAction<{ user: CurrentUser; auth_token: string }>) => {
      state.auth_token = action.payload.auth_token;
      state.current_user = action.payload.user;
      state.auth_status = 'authenticated';
      state.auth_error = null;
    },
    login_failure: (state, action: PayloadAction<string>) => {
      state.auth_token = null;
      state.current_user = null;
      state.auth_status = 'error';
      state.auth_error = action.payload;
    },
    logout: (state) => {
      state.auth_token = null;
      state.current_user = null;
      state.auth_status = 'unauthenticated';
      state.auth_error = null;
    },
    update_current_user: (state, action: PayloadAction<Partial<CurrentUser>>) => {
        if (state.current_user) {
            state.current_user = { ...state.current_user, ...action.payload };
        }
    },
    // Action to handle state after rehydration if token exists but user data might be missing initially
    set_authenticated_on_load: (state, action: PayloadAction<{ user: CurrentUser; auth_token: string }>) => {
        state.auth_token = action.payload.auth_token;
        state.current_user = action.payload.user;
        state.auth_status = 'authenticated';
        state.auth_error = null;
    },
    set_unauthenticated: (state) => { // Useful for explicit unauth state without logout logic
        state.auth_token = null;
        state.current_user = null;
        state.auth_status = 'unauthenticated';
        state.auth_error = null;
    },
  },
});

// --- Cart Slice ---

const cart_slice = createSlice({
  name: 'cart',
  initialState: initial_cart_state,
  reducers: {
    add_cart_item: (state, action: PayloadAction<CartItem>) => {
      const new_item = action.payload;
      // Check if cart belongs to a different truck
      if (state.cart_metadata.food_truck_uid && state.cart_metadata.food_truck_uid !== new_item.food_truck_uid) {
        // Clear cart if adding item from a different truck
        state.items = [new_item];
        // Need truck name - assume it's passed or fetched separately when adding first item
        // For simplicity, let's assume it might be added later or fetched by component
        state.cart_metadata = { food_truck_uid: new_item.food_truck_uid, food_truck_name: 'Truck Name Placeholder' };
      } else {
        // Add item to existing cart or initialize cart
        state.items.push(new_item);
        if (!state.cart_metadata.food_truck_uid) {
          state.cart_metadata = { food_truck_uid: new_item.food_truck_uid, food_truck_name: 'Truck Name Placeholder' };
        }
      }
    },
    update_cart_item: (state, action: PayloadAction<{ cart_item_id: string; updates: Partial<Pick<CartItem, 'quantity' | 'special_instructions' | 'selected_options' | 'total_item_price'>> }>) => {
      const index = state.items.findIndex(item => item.cart_item_id === action.payload.cart_item_id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload.updates };
      }
    },
    remove_cart_item: (state, action: PayloadAction<string>) => { // Payload is cart_item_id
      state.items = state.items.filter(item => item.cart_item_id !== action.payload);
      if (state.items.length === 0) {
        state.cart_metadata = { food_truck_uid: null, food_truck_name: null };
      }
    },
    clear_cart: (state) => {
      state.items = [];
      state.cart_metadata = { food_truck_uid: null, food_truck_name: null };
    },
     // Action to update truck name if needed separately
    set_cart_truck_name: (state, action: PayloadAction<string>) => {
        if (state.cart_metadata.food_truck_uid) {
            state.cart_metadata.food_truck_name = action.payload;
        }
    }
  },
});

// --- Notifications Slice ---

const notifications_slice = createSlice({
  name: 'notifications',
  initialState: initial_notifications_state,
  reducers: {
    add_notification: (state, action: PayloadAction<Omit<AppNotification, 'id'>>) => {
      const new_notification: AppNotification = {
        id: uuidv4(), // Generate unique ID
        ...action.payload,
      };
      state.app_notifications.push(new_notification);
    },
    remove_notification: (state, action: PayloadAction<string>) => { // Payload is notification id
      state.app_notifications = state.app_notifications.filter(n => n.id !== action.payload);
    },
    set_websocket_status: (state, action: PayloadAction<NotificationsState['websocket_status']>) => {
      state.websocket_status = action.payload;
    },
  },
});

// --- Combine Reducers ---

const root_reducer = combineReducers({
  auth: auth_slice.reducer,
  cart: cart_slice.reducer,
  notifications: notifications_slice.reducer,
});

// --- Persistence Configuration ---

const persist_config: PersistConfig<RootState> = {
  key: 'streeteats_root',
  storage,
  whitelist: ['auth', 'cart'], // Only persist auth and cart
  // Optional: Transform to reset transient auth states on rehydration
  transforms: [
    // You could create a custom transform here if needed, e.g., to reset auth_status
    // For now, we rely on initial load logic to check token and set status correctly
  ],
};

const persisted_reducer = persistReducer(persist_config, root_reducer);

// --- WebSocket Middleware ---

let socket: Socket | null = null;
const websocket_url = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:1337/ws'; // Use env var or default

const websocket_middleware: Middleware<{}, RootState> = store => next => action => {
  const result = next(action); // Pass action along first

  // Connect on successful login
  if (auth_slice.actions.login_success.match(action)) {
    const token = action.payload.auth_token;
    if (token && !socket) { // Connect only if token exists and not already connected
      console.log('Attempting WebSocket connection...');
      store.dispatch(notifications_slice.actions.set_websocket_status('connecting'));

      socket = io(websocket_url, {
        auth: { token },
        transports: ['websocket'] // Force WebSocket transport
      });

      socket.on('connect', () => {
        console.log('WebSocket connected successfully. Socket ID:', socket?.id);
        store.dispatch(notifications_slice.actions.set_websocket_status('connected'));
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected. Reason:', reason);
        store.dispatch(notifications_slice.actions.set_websocket_status('disconnected'));
        socket = null; // Clear socket instance
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err.message);
        store.dispatch(notifications_slice.actions.set_websocket_status('error'));
        socket = null; // Clear socket instance on auth or connection failure
      });

      // --- Handle Server-Sent Events based on AsyncAPI ---

        // Event: new_order_for_operator
        socket.on('new_order_for_operator', (payload: { event: string; data: any }) => {
            console.log('Received event: new_order_for_operator', payload.data);
            const orderData = payload.data;
            store.dispatch(notifications_slice.actions.add_notification({
                type: 'info',
                message: `New Order #${orderData.order_number} from ${orderData.customer_name} (${orderData.fulfillment_type}).`,
                // duration: 10000 // Optional: Longer duration for important alerts
            }));
            // Note: Frontend component (OperatorDashboard) should handle audible alert based on its state + this notification
        });

        // Event: order_status_update_for_customer
        socket.on('order_status_update_for_customer', (payload: { event: string; data: any }) => {
            console.log('Received event: order_status_update_for_customer', payload.data);
            const orderUpdate = payload.data;
            let message = `Order #${orderUpdate.order_number} status updated to: ${orderUpdate.new_status}.`;
            let type: AppNotification['type'] = 'info';

            if (orderUpdate.new_status === 'rejected') {
                message = `Order #${orderUpdate.order_number} was rejected. Reason: ${orderUpdate.rejection_reason || 'Not specified'}.`;
                type = 'error';
            } else if (orderUpdate.new_status === 'cancelled') {
                message = `Order #${orderUpdate.order_number} was cancelled. Reason: ${orderUpdate.cancellation_reason || 'Not specified'}.`;
                type = 'warning';
            } else if (orderUpdate.new_status === 'ready_for_pickup') {
                message = `Order #${orderUpdate.order_number} is ready for pickup!`;
                type = 'success';
            } else if (orderUpdate.new_status === 'out_for_delivery') {
                message = `Order #${orderUpdate.order_number} is out for delivery!`;
                type = 'success';
            }
             else if (orderUpdate.new_status === 'delivered' || orderUpdate.new_status === 'completed') {
                message = `Order #${orderUpdate.order_number} is ${orderUpdate.new_status}.`;
                type = 'success';
            }

            store.dispatch(notifications_slice.actions.add_notification({ type, message }));
        });

         // Event: customer_cancellation_request
        socket.on('customer_cancellation_request', (payload: { event: string; data: any }) => {
            console.log('Received event: customer_cancellation_request', payload.data);
            const requestData = payload.data;
             store.dispatch(notifications_slice.actions.add_notification({
                type: 'warning',
                message: `Customer requested cancellation for Order #${requestData.order_number}. Please review.`,
                duration: 15000 // Longer duration
            }));
        });

    }
  }

  // Disconnect on logout
  if (auth_slice.actions.logout.match(action)) {
    if (socket) {
      console.log('Disconnecting WebSocket due to logout.');
      socket.disconnect();
      socket = null;
    }
    // Ensure status is disconnected after logout action is processed
    // Use setTimeout to dispatch after the current action cycle completes
    setTimeout(() => store.dispatch(notifications_slice.actions.set_websocket_status('disconnected')), 0);
  }

  return result;
};

// --- Axios Interceptor Setup ---

// Create an Axios instance
const api_client = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api', // Use env var or default relative path
});

// Add a request interceptor
api_client.interceptors.request.use(
  (config) => {
    // Get the token from the store state
    const token = store.getState().auth.auth_token;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Do something with request error
    return Promise.reject(error);
  }
);

// --- Store Configuration ---

const store = configureStore({
  reducer: persisted_reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER], // Ignored by redux-persist
      },
    }).concat(websocket_middleware), // Add WebSocket middleware
    devTools: process.env.NODE_ENV !== 'production', // Enable dev tools only in development
});

// --- Persistor ---

const persistor = persistStore(store);

// --- Exports ---

// Export store and persistor
export { store, persistor };

// Export types
export type { RootState, AppDispatch, AuthState, CartState, NotificationsState, CartItem, CurrentUser, AppNotification };

// Export actions for use in components/dispatching
export const {
  set_auth_loading,
  login_success,
  login_failure,
  logout,
  update_current_user,
  set_authenticated_on_load,
  set_unauthenticated
} = auth_slice.actions;

export const {
  add_cart_item,
  update_cart_item,
  remove_cart_item,
  clear_cart,
  set_cart_truck_name
} = cart_slice.actions;

export const {
  add_notification,
  remove_notification,
  set_websocket_status
} = notifications_slice.actions;

// Export the configured Axios instance
export { api_client };

// Default export (as requested) - export the store itself
export default store;