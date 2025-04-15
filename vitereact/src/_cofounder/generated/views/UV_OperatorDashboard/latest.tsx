import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Howl } from 'howler'; // Using howler for sound

import {
    RootState,
    api_client,
    add_notification,
    // Import types if needed, e.g., CurrentUser
} from '@/store/main';

// Define Order Summary types based on schema
interface NewOrderSummary {
  order_uid: string;
  order_number: string;
  customer_name: string; // e.g., "Chloe D."
  status: 'pending_confirmation';
  fulfillment_type: 'pickup' | 'delivery';
  total_amount: number;
  order_time: number; // timestamp
  delivery_address_snippet: string | null;
}

interface ActiveOrderSummary {
  order_uid: string;
  order_number: string;
  customer_name: string;
  status: 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'cancellation_requested';
  fulfillment_type: 'pickup' | 'delivery';
  total_amount: number;
  order_time: number;
  delivery_address_snippet: string | null;
}

// Define Full Order Details type (mirroring backend response for GET /operators/me/orders/{order_uid})
interface FullOrderDetails {
 order_uid: string;
 order_number: string;
 customer_details: { name: string; phone: string | null };
 status: 'pending_confirmation' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'delivered' | 'cancelled' | 'rejected' | 'cancellation_requested';
 fulfillment_type: 'pickup' | 'delivery';
 delivery_address_snapshot: { street_address: string; apt_suite: string | null; city: string; state: string; zip_code: string; } | null;
 pickup_location_address_snapshot: string | null;
 special_instructions: string | null;
 subtotal: number;
 tax_amount: number;
 delivery_fee_charged: number;
 total_amount: number;
 order_time: number;
 estimated_ready_time: number | null;
 estimated_delivery_time: number | null;
 preparation_started_at: number | null;
 ready_or_out_for_delivery_at: number | null;
 completed_or_delivered_at: number | null;
 rejection_reason: string | null;
 cancellation_reason: string | null;
 items: Array<{
    order_item_uid: string;
    item_name_snapshot: string;
    quantity: number;
    total_item_price: number;
    selected_options: Array<{
        option_name_snapshot: string;
        price_adjustment_snapshot: number;
    }>;
 }>;
}

type OrderActionStatus = Record<string, 'idle' | 'loading' | 'error'>;

// --- Internal Modal Component ---
interface OperatorOrderDetailsModalProps {
    order_details: FullOrderDetails | null;
    is_visible: boolean;
    on_close: () => void;
    action_status: 'idle' | 'loading' | 'error';
    error_message: string | null;
    rejection_reason: string;
    on_rejection_reason_change: (value: string) => void;
    estimated_time: string; // String input for minutes
    on_estimated_time_change: (value: string) => void;
    on_accept: (estimated_time_override?: number) => void;
    on_reject: () => void;
    on_update_status: (new_status: 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'delivered') => void;
    on_cancel_order: () => void;
    on_approve_cancellation: () => void;
    on_reject_cancellation: () => void;
}

const OperatorOrderDetailsModal: React.FC<OperatorOrderDetailsModalProps> = ({
    order_details, is_visible, on_close, action_status, error_message,
    rejection_reason, on_rejection_reason_change,
    estimated_time, on_estimated_time_change,
    on_accept, on_reject, on_update_status, on_cancel_order,
    on_approve_cancellation, on_reject_cancellation
}) => {
    if (!is_visible || !order_details) return null;

    const format_currency = (amount: number) => `$${amount.toFixed(2)}`;
    const format_timestamp = (ts: number | null) => ts ? new Date(ts).toLocaleString() : 'N/A';

    const loading = action_status === 'loading';

    const render_actions = () => {
        switch (order_details.status) {
            case 'pending_confirmation':
                return (
                    <>
                        <div className="mt-4">
                            <label htmlFor="estimated_time_override" className="block text-sm font-medium text-gray-700">
                                Adjust Prep Time (Optional - Mins, e.g., 20):
                            </label>
                            <input
                                type="number"
                                id="estimated_time_override"
                                value={estimated_time}
                                onChange={(e) => on_estimated_time_change(e.target.value)}
                                disabled={loading}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                                placeholder={`${order_details.estimated_ready_time ? Math.round((order_details.estimated_ready_time - order_details.order_time) / 60000) : '15'}`} // Show default/estimate
                            />
                        </div>
                        <div className="mt-4 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const timeOverrideMins = parseInt(estimated_time, 10);
                                    const timeOverrideMs = !isNaN(timeOverrideMins) && timeOverrideMins > 0 ? order_details.order_time + (timeOverrideMins * 60000) : undefined;
                                    on_accept(timeOverrideMs);
                                }}
                                disabled={loading}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                {loading ? 'Accepting...' : 'Accept Order'}
                            </button>
                            <button
                                type="button"
                                onClick={on_reject}
                                disabled={loading || !rejection_reason.trim()}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Rejecting...' : 'Reject Order'}
                            </button>
                        </div>
                        <div className="mt-2">
                             <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700">Rejection Reason (Required):</label>
                             <input
                                id="rejection_reason"
                                type="text"
                                value={rejection_reason}
                                onChange={(e) => on_rejection_reason_change(e.target.value)}
                                disabled={loading}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                                placeholder="e.g., Too busy, Item unavailable"
                             />
                        </div>
                    </>
                );
            case 'accepted':
                return (
                    <div className="mt-4 flex justify-between items-center">
                         <button
                            type="button" onClick={() => on_update_status('preparing')} disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                         > {loading ? '...' : 'Mark as Preparing'} </button>
                         <button type="button" onClick={on_cancel_order} disabled={loading || !rejection_reason.trim()} className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Cancel Order</button>
                         {/* Reason input needed for cancellation */}
                         <input type="text" value={rejection_reason} onChange={(e) => on_rejection_reason_change(e.target.value)} placeholder="Cancellation Reason" className="ml-2 flex-grow px-2 py-1 border rounded text-sm" disabled={loading}/>
                    </div>
                );
            case 'preparing':
                 const next_prep_status = order_details.fulfillment_type === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery';
                 const next_prep_label = order_details.fulfillment_type === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery';
                 return (
                      <div className="mt-4 flex justify-between items-center">
                         <button
                            type="button" onClick={() => on_update_status(next_prep_status)} disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                         > {loading ? '...' : `Mark as ${next_prep_label}`} </button>
                         <button type="button" onClick={on_cancel_order} disabled={loading || !rejection_reason.trim()} className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Cancel Order</button>
                         <input type="text" value={rejection_reason} onChange={(e) => on_rejection_reason_change(e.target.value)} placeholder="Cancellation Reason" className="ml-2 flex-grow px-2 py-1 border rounded text-sm" disabled={loading}/>
                     </div>
                 );
            case 'ready_for_pickup':
                 return (
                     <div className="mt-4 flex justify-between items-center">
                         <button
                             type="button" onClick={() => on_update_status('completed')} disabled={loading}
                             className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                         > {loading ? '...' : 'Mark as Completed'} </button>
                         {/* Allow cancellation even if ready? Maybe not ideal. */}
                         {/* <button type="button" onClick={on_cancel_order} disabled={loading || !rejection_reason.trim()} className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Cancel Order</button> */}
                     </div>
                 );
            case 'out_for_delivery':
                 return (
                     <div className="mt-4 flex justify-between items-center">
                         <button
                             type="button" onClick={() => on_update_status('delivered')} disabled={loading}
                             className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                         > {loading ? '...' : 'Mark as Delivered'} </button>
                     </div>
                 );
             case 'cancellation_requested':
                 return (
                    <div className="mt-4 flex justify-end space-x-3">
                         <button
                             type="button" onClick={on_approve_cancellation} disabled={loading}
                             className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                         > {loading ? '...' : 'Approve Cancellation'} </button>
                         <button
                             type="button" onClick={on_reject_cancellation} disabled={loading}
                             className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                         > {loading ? '...' : 'Reject Cancellation'} </button>
                     </div>
                 );
            default:
                return <p className="text-sm text-gray-500 mt-4">No actions available for status: {order_details.status}</p>;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Order Details: #{order_details.order_number}
                                    <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order_details.status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-800' : order_details.status === 'accepted' ? 'bg-blue-100 text-blue-800' : order_details.status === 'preparing' ? 'bg-indigo-100 text-indigo-800' : order_details.status === 'ready_for_pickup' || order_details.status === 'out_for_delivery' ? 'bg-green-100 text-green-800' : order_details.status === 'cancellation_requested' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {order_details.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                </h3>
                                <div className="mt-4 space-y-3 text-sm text-gray-700">
                                    <p><strong>Customer:</strong> {order_details.customer_details.name} {order_details.customer_details.phone && `(${order_details.customer_details.phone})`}</p>
                                    <p><strong>Type:</strong> <span className={`font-semibold ${order_details.fulfillment_type === 'delivery' ? 'text-blue-600' : 'text-green-600'}`}>{order_details.fulfillment_type.toUpperCase()}</span></p>
                                    {order_details.fulfillment_type === 'delivery' && order_details.delivery_address_snapshot && (
                                        <p><strong>Delivery Address:</strong> {`${order_details.delivery_address_snapshot.street_address}, ${order_details.delivery_address_snapshot.apt_suite ? order_details.delivery_address_snapshot.apt_suite + ', ' : ''}${order_details.delivery_address_snapshot.city}, ${order_details.delivery_address_snapshot.state} ${order_details.delivery_address_snapshot.zip_code}`}</p>
                                    )}
                                     {order_details.fulfillment_type === 'pickup' && (
                                        <p><strong>Pickup Location:</strong> {order_details.pickup_location_address_snapshot || 'Truck Location'}</p>
                                    )}
                                    <p><strong>Order Time:</strong> {format_timestamp(order_details.order_time)}</p>
                                    {order_details.estimated_ready_time && <p><strong>Est. Ready:</strong> {format_timestamp(order_details.estimated_ready_time)}</p>}
                                    {order_details.estimated_delivery_time && <p><strong>Est. Delivery:</strong> {format_timestamp(order_details.estimated_delivery_time)}</p>}

                                    <div className="mt-3 border-t pt-3">
                                        <h4 className="font-medium text-gray-800">Items:</h4>
                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                            {order_details.items.map(item => (
                                                <li key={item.order_item_uid}>
                                                    {item.quantity} x {item.item_name_snapshot} ({format_currency(item.total_item_price)})
                                                    {item.selected_options.length > 0 && (
                                                        <ul className="list-['\2023'] list-inside ml-4 text-xs text-gray-600">
                                                            {item.selected_options.map((opt, idx) => (
                                                                <li key={idx}>{opt.option_name_snapshot} (+{format_currency(opt.price_adjustment_snapshot)})</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {order_details.special_instructions && (
                                         <div className="mt-3 border-t pt-3">
                                             <h4 className="font-medium text-gray-800">Special Instructions:</h4>
                                             <p className="mt-1 text-gray-600">{order_details.special_instructions}</p>
                                         </div>
                                     )}

                                    <div className="mt-3 border-t pt-3 flex justify-between font-medium text-gray-800">
                                        <span>Subtotal:</span><span>{format_currency(order_details.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax:</span><span>{format_currency(order_details.tax_amount)}</span>
                                    </div>
                                    {order_details.fulfillment_type === 'delivery' && (
                                        <div className="flex justify-between text-gray-600">
                                            <span>Delivery Fee:</span><span>{format_currency(order_details.delivery_fee_charged)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-lg text-gray-900">
                                        <span>Total:</span><span>{format_currency(order_details.total_amount)}</span>
                                    </div>

                                    {/* Display Rejection/Cancellation Reason if applicable */}
                                    {order_details.rejection_reason && <p className="mt-2 text-red-600"><strong>Rejection Reason:</strong> {order_details.rejection_reason}</p>}
                                    {order_details.cancellation_reason && <p className="mt-2 text-orange-600"><strong>Cancellation Reason:</strong> {order_details.cancellation_reason}</p>}

                                     {/* Action Error Display */}
                                     {action_status === 'error' && error_message && (
                                         <p className="mt-2 text-red-600 text-sm">Error: {error_message}</p>
                                     )}

                                     {/* Action Buttons */}
                                     {render_actions()}

                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            onClick={on_close}
                            disabled={loading}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
// --- Main Dashboard Component ---

const UV_OperatorDashboard: React.FC = () => {
    const dispatch = useDispatch();
    const { auth_token, current_user } = useSelector((state: RootState) => state.auth);
    // const websocket_status_global = useSelector((state: RootState) => state.notifications.websocket_status); // Can use this for UI feedback

    const [truck_status, set_truck_status] = useState<'online' | 'offline' | 'paused'>('offline');
    const [current_location_address, set_current_location_address] = useState<string | null>(null);
    const [location_update_input, set_location_update_input] = useState<string>('');
    const [location_update_status, set_location_update_status] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const [new_orders_list, set_new_orders_list] = useState<NewOrderSummary[]>([]);
    const [active_orders_list, set_active_orders_list] = useState<ActiveOrderSummary[]>([]);

    const [is_loading_initial_data, set_is_loading_initial_data] = useState<boolean>(true);
    const [is_loading_orders, set_is_loading_orders] = useState<boolean>(false); // For refresh
    const [error_message, set_error_message] = useState<string | null>(null);

    const [selected_order_for_details, set_selected_order_for_details] = useState<FullOrderDetails | null>(null);
    const [is_details_modal_open, set_is_details_modal_open] = useState<boolean>(false);
    const [order_action_status, set_order_action_status] = useState<OrderActionStatus>({});
    const [modal_action_error, set_modal_action_error] = useState<string | null>(null);

    const [audible_alert_enabled, set_audible_alert_enabled] = useState<boolean>(true);
    const [rejection_reason_input, set_rejection_reason_input] = useState<string>('');
    const [estimated_time_input, set_estimated_time_input] = useState<string>(''); // For modal time override

    const socket_ref = useRef<Socket | null>(null);
    const refresh_interval_ref = useRef<NodeJS.Timeout | null>(null);
    const new_order_sound_ref = useRef<Howl | null>(null);

    const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:1337/ws';

    // --- Sound Initialization ---
    useEffect(() => {
        // Initialize Howler sound - replace with your actual sound file path
         // Use a placeholder sound URL if you don't have one locally
        const sound_url = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c64349.mp3?filename=short-success-sound-glockenspiel-treasure-video-game-6346.mp3';
        new_order_sound_ref.current = new Howl({
            src: [sound_url],
            volume: 0.7,
        });
         return () => {
            new_order_sound_ref.current?.unload();
         }
    }, []);

    // --- Fetch Initial Data ---
    const fetch_initial_dashboard_data = useCallback(async () => {
        set_is_loading_initial_data(true);
        set_error_message(null);
        try {
            const [truck_res, new_orders_res, active_orders_res] = await Promise.all([
                api_client.get('/operators/me/truck'),
                api_client.get('/operators/me/orders?status=pending_confirmation'),
                api_client.get('/operators/me/orders?status=active')
            ]);

            if (truck_res.data) {
                set_truck_status(truck_res.data.current_status);
                set_current_location_address(truck_res.data.location?.address || null);
                set_location_update_input(truck_res.data.location?.address || ''); // Pre-fill input
            }
            if (new_orders_res.data) {
                set_new_orders_list(new_orders_res.data.orders || []);
            }
            if (active_orders_res.data) {
                set_active_orders_list(active_orders_res.data.orders || []);
            }

        } catch (err: any) {
            console.error("Error fetching initial dashboard data:", err);
            set_error_message(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
            dispatch(add_notification({ type: 'error', message: 'Failed to load initial dashboard data.' }));
        } finally {
            set_is_loading_initial_data(false);
        }
    }, [dispatch]);

    useEffect(() => {
        fetch_initial_dashboard_data();
        // Clean up interval on unmount
        return () => {
            if (refresh_interval_ref.current) {
                clearInterval(refresh_interval_ref.current);
            }
        };
    }, [fetch_initial_dashboard_data]);

    // --- Fetch Orders periodically (Fallback) ---
    const fetch_orders = useCallback(async () => {
        if (is_loading_orders) return; // Prevent concurrent fetches
        set_is_loading_orders(true);
        // Don't clear main error message on refresh
        try {
            const [new_orders_res, active_orders_res] = await Promise.all([
                api_client.get('/operators/me/orders?status=pending_confirmation'),
                api_client.get('/operators/me/orders?status=active')
            ]);
            set_new_orders_list(new_orders_res.data.orders || []);
            set_active_orders_list(active_orders_res.data.orders || []);
        } catch (err: any) {
            console.error("Error refreshing orders:", err);
            // Maybe show a transient error?
            dispatch(add_notification({ type: 'warning', message: 'Failed to refresh orders.' }));
        } finally {
            set_is_loading_orders(false);
        }
    }, [dispatch, is_loading_orders]);

    // Setup periodic refresh interval
    useEffect(() => {
        // Clear previous interval if any
        if (refresh_interval_ref.current) {
            clearInterval(refresh_interval_ref.current);
        }
        // Set new interval (e.g., every 30 seconds)
        refresh_interval_ref.current = setInterval(fetch_orders, 30000);

        // Cleanup on unmount
        return () => {
            if (refresh_interval_ref.current) {
                clearInterval(refresh_interval_ref.current);
            }
        };
    }, [fetch_orders]);


    // --- WebSocket Connection & Handling ---
    useEffect(() => {
        if (auth_token && !socket_ref.current) {
            console.log('Dashboard attempting WebSocket connection...');
            const socket = io(WEBSOCKET_URL, {
                auth: { token: auth_token },
                transports: ['websocket']
            });
            socket_ref.current = socket;

            socket.on('connect', () => {
                console.log('Dashboard WebSocket connected.');
                dispatch(add_notification({ type: 'info', message: 'Real-time connection active.', duration: 3000 }));
                // Fetch orders on connect to ensure sync
                fetch_orders();
            });

            socket.on('disconnect', (reason) => {
                console.log('Dashboard WebSocket disconnected:', reason);
                dispatch(add_notification({ type: 'warning', message: 'Real-time connection lost. Reconnecting...' }));
                socket_ref.current = null;
            });

            socket.on('connect_error', (err) => {
                console.error('Dashboard WebSocket connection error:', err.message);
                dispatch(add_notification({ type: 'error', message: 'Real-time connection failed.' }));
                socket_ref.current = null;
            });

            // --- Event Listeners ---
            socket.on('new_order_for_operator', (payload: { event: string; data: NewOrderSummary }) => {
                console.log('WS: new_order_for_operator', payload.data);
                set_new_orders_list(prev => [payload.data, ...prev]); // Add to top
                if (audible_alert_enabled && new_order_sound_ref.current) {
                    new_order_sound_ref.current.play();
                }
                 dispatch(add_notification({ type: 'success', message: `New Order #${payload.data.order_number} Received!` }));
            });

            socket.on('customer_cancellation_request', (payload: { event: string; data: { order_uid: string; order_number: string } }) => {
                console.log('WS: customer_cancellation_request', payload.data);
                set_active_orders_list(prev => prev.map(order =>
                    order.order_uid === payload.data.order_uid
                        ? { ...order, status: 'cancellation_requested' }
                        : order
                ));
                 dispatch(add_notification({ type: 'warning', message: `Cancellation Requested for Order #${payload.data.order_number}` }));
            });

            // Add listener for status updates *originating from this operator's actions*
            // This helps keep the UI in sync immediately if the API call was slow
            // or if another dashboard instance made the change.
             socket.on('order_status_update_for_customer', (payload: { event: string; data: any }) => {
                 console.log('WS: order_status_update_for_customer (Operator Dashboard Check)', payload.data);
                 const updatedOrderData = payload.data;

                 // Check if it's moving out of 'new'
                 set_new_orders_list(prev => prev.filter(order => order.order_uid !== updatedOrderData.order_uid));

                 // Check if it's moving out of 'active'
                 const finalStatuses = ['completed', 'delivered', 'cancelled', 'rejected'];
                 if (finalStatuses.includes(updatedOrderData.new_status)) {
                     set_active_orders_list(prev => prev.filter(order => order.order_uid !== updatedOrderData.order_uid));
                 } else {
                    // Update status within active list or add if it just moved from new
                     set_active_orders_list(prev => {
                         const existingIndex = prev.findIndex(o => o.order_uid === updatedOrderData.order_uid);
                         if (existingIndex > -1) {
                             // Update existing
                             return prev.map(o => o.order_uid === updatedOrderData.order_uid ? { ...o, status: updatedOrderData.new_status } : o);
                         } else if (updatedOrderData.new_status === 'accepted') {
                             // Add newly accepted order (might be slightly delayed vs API response, but covers WS edge cases)
                             // Need to construct the ActiveOrderSummary from the payload
                             const newActiveOrder: ActiveOrderSummary = {
                                 order_uid: updatedOrderData.order_uid,
                                 order_number: updatedOrderData.order_number,
                                 customer_name: 'Customer', // Placeholder - WS payload might not have name
                                 status: 'accepted',
                                 fulfillment_type: updatedOrderData.fulfillment_type || 'pickup', // Need this info
                                 total_amount: updatedOrderData.total_amount || 0, // Need this info
                                 order_time: updatedOrderData.order_time || Date.now(), // Need this info
                                 delivery_address_snippet: updatedOrderData.delivery_address_snippet || null
                             };
                              // Fetch full active orders again for consistency if WS data is incomplete
                              fetch_orders();
                              return prev; // Avoid adding incomplete item
                             // return [newActiveOrder, ...prev];
                         }
                         return prev;
                     });
                 }
             });


        }

        // Cleanup on unmount or token change
        return () => {
            if (socket_ref.current) {
                console.log('Dashboard disconnecting WebSocket.');
                socket_ref.current.disconnect();
                socket_ref.current = null;
            }
        };
    }, [auth_token, WEBSOCKET_URL, dispatch, audible_alert_enabled, fetch_orders]); // Add dependencies

    // --- Action Handlers ---

    const handle_toggle_truck_status = useCallback(async () => {
        const target_status = truck_status === 'offline' ? 'online' : 'offline';
        set_error_message(null);
        try {
            const response = await api_client.put('/operators/me/truck/status', { status: target_status });
            set_truck_status(response.data.current_status);
            dispatch(add_notification({ type: 'success', message: `Truck status set to ${response.data.current_status}` }));
        } catch (err: any) {
            console.error("Error toggling truck status:", err);
            const error_msg = err.response?.data?.error || err.message || `Failed to set status to ${target_status}.`;
            set_error_message(error_msg);
            dispatch(add_notification({ type: 'error', message: error_msg }));
        }
    }, [truck_status, dispatch]);

    const handle_toggle_busy_mode = useCallback(async () => {
        if (truck_status === 'offline') return; // Cannot pause if offline
        const target_status = truck_status === 'paused' ? 'online' : 'paused';
         set_error_message(null);
        try {
            const response = await api_client.put('/operators/me/truck/status', { status: target_status });
            set_truck_status(response.data.current_status);
            dispatch(add_notification({ type: 'success', message: `Truck status set to ${response.data.current_status}` }));
        } catch (err: any) {
            console.error("Error toggling busy mode:", err);
            const error_msg = err.response?.data?.error || err.message || `Failed to set status to ${target_status}.`;
            set_error_message(error_msg);
            dispatch(add_notification({ type: 'error', message: error_msg }));
        }
    }, [truck_status, dispatch]);

    const handle_update_truck_location = useCallback(async () => {
        set_location_update_status('loading');
        set_error_message(null);
        try {
            const response = await api_client.put('/operators/me/truck/location', { address: location_update_input });
            set_current_location_address(response.data.location?.address || null);
            set_location_update_status('success');
             dispatch(add_notification({ type: 'success', message: 'Location updated successfully.' }));
             // Optionally clear success status after a delay
             setTimeout(() => set_location_update_status('idle'), 3000);
        } catch (err: any) {
            console.error("Error updating location:", err);
            const error_msg = err.response?.data?.error || err.message || 'Failed to update location.';
            set_error_message(error_msg);
            set_location_update_status('error');
            dispatch(add_notification({ type: 'error', message: error_msg }));
        }
    }, [location_update_input, dispatch]);

    const handle_open_order_details = useCallback(async (order_uid: string) => {
        set_is_details_modal_open(true);
        set_selected_order_for_details(null); // Clear previous details
        set_modal_action_error(null);
        set_order_action_status(prev => ({ ...prev, [order_uid]: 'loading' })); // Show loading in modal trigger
        try {
            const response = await api_client.get(`/operators/me/orders/${order_uid}`);
            set_selected_order_for_details(response.data);
             set_rejection_reason_input(''); // Clear reason input
             set_estimated_time_input(''); // Clear time input
        } catch (err: any) {
            console.error("Error fetching order details:", err);
            const error_msg = err.response?.data?.error || err.message || 'Failed to load order details.';
            dispatch(add_notification({ type: 'error', message: error_msg }));
            set_is_details_modal_open(false); // Close modal on error
        } finally {
             set_order_action_status(prev => ({ ...prev, [order_uid]: 'idle' }));
        }
    }, [dispatch]);

    const handle_close_order_details = useCallback(() => {
        set_is_details_modal_open(false);
        set_selected_order_for_details(null);
        set_modal_action_error(null);
        set_rejection_reason_input('');
        set_estimated_time_input('');
    }, []);

    // --- Modal Action Handlers ---
    const create_order_action_handler = useCallback((
        order_uid: string,
        api_payload: { new_status: string; reason?: string; updated_estimated_ready_time?: number; updated_estimated_delivery_time?: number }
    ) => async () => {
        if (!order_uid) return;
        set_order_action_status(prev => ({ ...prev, [order_uid]: 'loading' }));
        set_modal_action_error(null);
        try {
            await api_client.put(`/operators/me/orders/${order_uid}/status`, api_payload);
            // Update local state immediately based on expected outcome
            const finalStatuses = ['completed', 'delivered', 'cancelled', 'rejected'];
            if (api_payload.new_status === 'accepted') {
                set_new_orders_list(prev => prev.filter(o => o.order_uid !== order_uid));
                // Add to active list (or wait for WS/refresh) - let's wait for WS/refresh for simplicity
                fetch_orders(); // Trigger refresh
            } else if (finalStatuses.includes(api_payload.new_status)) {
                 set_new_orders_list(prev => prev.filter(o => o.order_uid !== order_uid));
                 set_active_orders_list(prev => prev.filter(o => o.order_uid !== order_uid));
            } else {
                // Update status in active list
                 set_active_orders_list(prev => prev.map(o => o.order_uid === order_uid ? { ...o, status: api_payload.new_status as ActiveOrderSummary['status'] } : o));
            }

            handle_close_order_details(); // Close modal on success
            dispatch(add_notification({ type: 'success', message: `Order status updated to ${api_payload.new_status}` }));

        } catch (err: any) {
            console.error(`Error performing action ${api_payload.new_status} on order ${order_uid}:`, err);
            const error_msg = err.response?.data?.error || err.message || `Failed to update order status.`;
            set_modal_action_error(error_msg); // Show error within modal
            set_order_action_status(prev => ({ ...prev, [order_uid]: 'error' }));
            dispatch(add_notification({ type: 'error', message: error_msg }));
        } finally {
            // Set back to idle only if not successful (modal closes on success)
             if (order_action_status[order_uid] !== 'idle') {
                  setTimeout(() => set_order_action_status(prev => ({ ...prev, [order_uid]: 'idle' })), 1500);
             }
        }
    }, [dispatch, handle_close_order_details, fetch_orders]); // Removed order_action_status dependency loop

    const handle_accept_order = (estimated_time_override?: number) => {
         if (!selected_order_for_details) return;
         const payload: any = { new_status: 'accepted' };
         if (estimated_time_override) {
             if (selected_order_for_details.fulfillment_type === 'pickup') {
                 payload.updated_estimated_ready_time = estimated_time_override;
             } else {
                 // Assume standard buffer for delivery estimate update
                 const delivery_buffer_ms = 15 * 60 * 1000;
                 payload.updated_estimated_delivery_time = estimated_time_override + delivery_buffer_ms;
             }
         }
         create_order_action_handler(selected_order_for_details.order_uid, payload)();
    };

    const handle_reject_order = () => {
        if (!selected_order_for_details || !rejection_reason_input.trim()) return;
         create_order_action_handler(selected_order_for_details.order_uid, { new_status: 'rejected', reason: rejection_reason_input.trim() })();
    };

     const handle_update_order_status = (new_status: 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'delivered') => {
         if (!selected_order_for_details) return;
          create_order_action_handler(selected_order_for_details.order_uid, { new_status })();
     };

     const handle_cancel_order = () => {
         if (!selected_order_for_details || !rejection_reason_input.trim()) return;
         create_order_action_handler(selected_order_for_details.order_uid, { new_status: 'cancelled', reason: rejection_reason_input.trim() })();
     };

     const handle_approve_cancellation = () => {
         if (!selected_order_for_details) return;
         create_order_action_handler(selected_order_for_details.order_uid, { new_status: 'cancelled', reason: 'Customer Request' })();
     };

     const handle_reject_cancellation = () => {
          if (!selected_order_for_details) return;
          // Revert status back to 'accepted' (or potentially 'preparing' if logic allowed it)
           create_order_action_handler(selected_order_for_details.order_uid, { new_status: 'accepted' })();
     };

    // --- Render Helper Functions ---
    const format_currency = (amount: number) => `$${amount.toFixed(2)}`;
    const format_time_ago = (ts: number): string => {
        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    // --- Main Render ---
    return (
        <>
            <div className="container mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Operator Dashboard</h1>

                {/* --- Loading State --- */}
                {is_loading_initial_data && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="ml-4 text-gray-600">Loading Dashboard...</p>
                    </div>
                )}

                {/* --- Error State --- */}
                {error_message && !is_loading_initial_data && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error_message}</span>
                        <button onClick={() => set_error_message(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                             <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </button>
                    </div>
                )}

                {/* --- Dashboard Controls (Only if not loading/error) --- */}
                {!is_loading_initial_data && !error_message && (
                    <div className="bg-white shadow rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            {/* Status Control */}
                            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                                <span className="font-medium text-gray-700">Truck Status:</span>
                                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${truck_status === 'online' ? 'bg-green-100 text-green-800' : truck_status === 'paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                    {truck_status.toUpperCase()}
                                </span>
                                <button
                                    onClick={handle_toggle_truck_status}
                                    className={`px-4 py-1 border rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${truck_status === 'offline' ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500' : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'}`}
                                >
                                    {truck_status === 'offline' ? 'Go Online' : 'Go Offline'}
                                </button>
                                {truck_status === 'online' && (
                                     <button
                                        onClick={handle_toggle_busy_mode}
                                        className="px-4 py-1 border rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400"
                                    >
                                        Pause New Orders
                                    </button>
                                )}
                                 {truck_status === 'paused' && (
                                     <button
                                        onClick={handle_toggle_busy_mode}
                                        className="px-4 py-1 border rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400"
                                    >
                                        Resume Orders
                                    </button>
                                )}
                            </div>

                            {/* Location Control */}
                            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                                <label htmlFor="location_update" className="font-medium text-gray-700 text-sm whitespace-nowrap">Quick Location:</label>
                                <input
                                    id="location_update"
                                    type="text"
                                    value={location_update_input}
                                    onChange={(e) => set_location_update_input(e.target.value)}
                                    placeholder="Enter new address"
                                    className="flex-grow px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                <button
                                    onClick={handle_update_truck_location}
                                    disabled={location_update_status === 'loading'}
                                    className="px-4 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {location_update_status === 'loading' ? 'Updating...' : 'Update'}
                                </button>
                                {location_update_status === 'success' && <span className="text-green-600 text-sm">✔</span>}
                                {location_update_status === 'error' && <span className="text-red-600 text-sm">✖</span>}
                            </div>
                             {/* Current Location Display & Settings Link */}
                             <div className="text-sm text-gray-600 md:text-right">
                                 <p>Current: {current_location_address || 'Not Set'}</p>
                                 <Link to="/operator/settings/truck#location" className="text-indigo-600 hover:text-indigo-800 text-xs">
                                     Edit Full Location Settings
                                 </Link>
                             </div>

                             {/* Sound Toggle */}
                              <div className="flex items-center space-x-2 col-span-1 md:col-span-3 justify-end">
                                <span className="text-sm font-medium text-gray-700">Order Alerts:</span>
                                <button onClick={() => set_audible_alert_enabled(!audible_alert_enabled)} className={`px-3 py-1 rounded-full text-xs font-semibold ${audible_alert_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {audible_alert_enabled ? 'Sound ON' : 'Sound OFF'}
                                </button>
                                <button onClick={fetch_orders} disabled={is_loading_orders} className="px-3 py-1 border rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                                    {is_loading_orders ? 'Refreshing...' : 'Refresh Orders'}
                                </button>
                             </div>
                        </div>
                    </div>
                )}

                 {/* --- Order Queues (Only if not loading initial) --- */}
                 {!is_loading_initial_data && (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         {/* New Orders Column */}
                         <div className="bg-white shadow rounded-lg p-4 flex flex-col">
                             <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                                 New Orders ({new_orders_list.length})
                             </h2>
                             <div className="flex-grow overflow-y-auto h-96 pr-2 space-y-3"> {/* Added scroll and height */}
                                 {new_orders_list.length === 0 ? (
                                     <p className="text-gray-500 text-center py-10">No new orders.</p>
                                 ) : (
                                     new_orders_list.map(order => (
                                         <div key={order.order_uid}
                                              className={`border rounded-md p-3 cursor-pointer hover:shadow-md transition-shadow ${order.fulfillment_type === 'delivery' ? 'border-blue-300 bg-blue-50' : 'border-green-300 bg-green-50'}`}
                                              onClick={() => handle_open_order_details(order.order_uid)}
                                              role="button"
                                              tabIndex={0}
                                              onKeyPress={(e) => e.key === 'Enter' && handle_open_order_details(order.order_uid)}
                                         >
                                             <div className="flex justify-between items-center mb-1">
                                                 <span className="font-bold text-gray-800">#{order.order_number}</span>
                                                 <span className={`text-xs font-semibold px-2 py-0.5 rounded ${order.fulfillment_type === 'delivery' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
                                                     {order.fulfillment_type.toUpperCase()}
                                                 </span>
                                             </div>
                                             <p className="text-sm text-gray-700">{order.customer_name}</p>
                                             <p className="text-sm text-gray-500">{format_time_ago(order.order_time)}</p>
                                             <p className="text-right font-semibold text-gray-800 mt-1">{format_currency(order.total_amount)}</p>
                                             {/* Quick Accept/Reject might be too complex for MVP, use modal */}
                                         </div>
                                     ))
                                 )}
                             </div>
                         </div>

                         {/* Active Orders Column */}
                         <div className="bg-white shadow rounded-lg p-4 flex flex-col">
                             <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                                 Active Orders ({active_orders_list.length})
                             </h2>
                             <div className="flex-grow overflow-y-auto h-96 pr-2 space-y-3"> {/* Added scroll and height */}
                                 {active_orders_list.length === 0 ? (
                                     <p className="text-gray-500 text-center py-10">No active orders.</p>
                                 ) : (
                                     active_orders_list.map(order => (
                                         <div key={order.order_uid}
                                              className={`border rounded-md p-3 cursor-pointer hover:shadow-md transition-shadow ${order.fulfillment_type === 'delivery' ? 'border-blue-300 bg-blue-50' : 'border-green-300 bg-green-50'} ${order.status === 'cancellation_requested' ? 'border-orange-400 bg-orange-50' : ''}`}
                                              onClick={() => handle_open_order_details(order.order_uid)}
                                               role="button"
                                               tabIndex={0}
                                               onKeyPress={(e) => e.key === 'Enter' && handle_open_order_details(order.order_uid)}
                                         >
                                             <div className="flex justify-between items-center mb-1">
                                                 <span className="font-bold text-gray-800">#{order.order_number}</span>
                                                 <span className={`text-xs font-semibold px-2 py-0.5 rounded ${order.fulfillment_type === 'delivery' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
                                                     {order.fulfillment_type.toUpperCase()}
                                                 </span>
                                             </div>
                                             <p className="text-sm text-gray-700">{order.customer_name}</p>
                                              {order.fulfillment_type === 'delivery' && order.delivery_address_snippet && (
                                                 <p className="text-xs text-gray-500 italic">To: {order.delivery_address_snippet}</p>
                                             )}
                                              <div className="flex justify-between items-center mt-1">
                                                  <span className={`text-sm font-medium ${order.status === 'cancellation_requested' ? 'text-orange-600 animate-pulse' : 'text-indigo-600'}`}>
                                                      {order.status.replace('_', ' ').toUpperCase()}
                                                  </span>
                                                  <span className="text-gray-500 text-sm">{format_time_ago(order.order_time)}</span>
                                              </div>
                                             <p className="text-right font-semibold text-gray-800 mt-1">{format_currency(order.total_amount)}</p>
                                             {/* Status update buttons could be here, but modal keeps card cleaner */}
                                         </div>
                                     ))
                                 )}
                             </div>
                         </div>
                     </div>
                 )}

            </div>

            {/* --- Render Modal Conditionally --- */}
             <OperatorOrderDetailsModal
                 order_details={selected_order_for_details}
                 is_visible={is_details_modal_open}
                 on_close={handle_close_order_details}
                 action_status={selected_order_for_details ? order_action_status[selected_order_for_details.order_uid] || 'idle' : 'idle'}
                 error_message={modal_action_error}
                 rejection_reason={rejection_reason_input}
                 on_rejection_reason_change={set_rejection_reason_input}
                 estimated_time={estimated_time_input}
                 on_estimated_time_change={set_estimated_time_input}
                 on_accept={handle_accept_order}
                 on_reject={handle_reject_order}
                 on_update_status={handle_update_order_status}
                 on_cancel_order={handle_cancel_order}
                 on_approve_cancellation={handle_approve_cancellation}
                 on_reject_cancellation={handle_reject_cancellation}
             />
        </>
    );
};

export default UV_OperatorDashboard;
