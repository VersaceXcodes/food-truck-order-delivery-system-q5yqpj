import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom'; // Import Link, though not strictly needed based on description
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';

import { api_client, RootState, add_notification } from '@/store/main';

// --- Interfaces (matching datamap) ---

interface ActiveOrder {
  order_uid: string;
  order_number: string;
  food_truck_name: string;
  status: 'pending_confirmation' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'cancellation_requested';
  total_amount: number;
  order_time: number; // Timestamp (ms)
  estimated_ready_time: number | null; // Timestamp (ms)
  estimated_delivery_time: number | null; // Timestamp (ms)
  fulfillment_type: 'pickup' | 'delivery';
  support_phone_number: string | null;
}

interface PastOrder {
  order_uid: string;
  order_number: string;
  food_truck_name: string;
  status: 'completed' | 'delivered' | 'cancelled' | 'rejected';
  total_amount: number;
  order_time: number; // Timestamp (ms)
  finalized_time: number | null; // Timestamp (ms)
}

interface OrderDetails {
  order_uid: string;
  order_number: string;
  food_truck_name: string;
  status: string;
  fulfillment_type: string;
  delivery_address_snapshot: {
    street_address: string;
    apt_suite: string | null;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  pickup_location_address_snapshot: string | null;
  special_instructions: string | null;
  subtotal: number;
  tax_amount: number;
  delivery_fee_charged: number;
  total_amount: number;
  order_time: number;
  estimated_ready_time: number | null;
  estimated_delivery_time: number | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  support_phone_number: string | null;
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
  // Add other timestamps if needed from backend response
  preparation_started_at?: number | null;
  ready_or_out_for_delivery_at?: number | null;
  completed_or_delivered_at?: number | null;
  created_at?: number;
  updated_at?: number;
}

type CancellationStatus = 'idle' | 'loading' | 'success' | 'error';

// --- Helper Functions ---

const format_timestamp = (timestamp: number | null, include_time = true): string => {
  if (!timestamp) return 'N/A';
  try {
    const format_string = include_time ? 'MMM d, yyyy, h:mm a' : 'MMM d, yyyy';
    return format(new Date(timestamp), format_string);
  } catch (e) {
    console.error("Error formatting timestamp:", timestamp, e);
    return 'Invalid Date';
  }
};

const get_status_text = (status: string): string => {
  const status_map: Record<string, string> = {
    pending_confirmation: 'Pending Confirmation',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready for Pickup',
    out_for_delivery: 'Out for Delivery',
    completed: 'Completed',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    cancellation_requested: 'Cancellation Requested',
  };
  return status_map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const get_status_progress = (status: ActiveOrder['status']): number => {
  const progress_map: Record<ActiveOrder['status'], number> = {
    pending_confirmation: 10,
    accepted: 25,
    cancellation_requested: 25, // Same as accepted visually
    preparing: 50,
    ready_for_pickup: 85,
    out_for_delivery: 85,
  };
  return progress_map[status] || 0;
};

const get_status_color_class = (status: string): string => {
    switch (status) {
        case 'rejected':
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        case 'completed':
        case 'delivered':
            return 'bg-green-100 text-green-800';
        case 'ready_for_pickup':
        case 'out_for_delivery':
            return 'bg-blue-100 text-blue-800';
        case 'preparing':
            return 'bg-yellow-100 text-yellow-800';
         case 'cancellation_requested':
            return 'bg-orange-100 text-orange-800';
        default: // pending_confirmation, accepted
            return 'bg-gray-100 text-gray-800';
    }
};


// --- Component ---

const UV_CustomerOrderTracking: React.FC = () => {
  const dispatch = useDispatch();
  const auth_token = useSelector((state: RootState) => state.auth.auth_token);

  const [activeOrdersList, setActiveOrdersList] = useState<ActiveOrder[]>([]);
  const [pastOrdersList, setPastOrdersList] = useState<PastOrder[]>([]);
  const [selectedTab, setSelectedTab] = useState<'active' | 'past'>('active');
  const [isLoadingActive, setIsLoadingActive] = useState<boolean>(false);
  const [isLoadingPast, setIsLoadingPast] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderDetailsToView, setOrderDetailsToView] = useState<OrderDetails | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [cancellationRequestStatus, setCancellationRequestStatus] = useState<Record<string, CancellationStatus>>({});

  const socket_ref = useRef<Socket | null>(null);

  // --- Data Fetching Callbacks ---

  const fetchActiveOrders = useCallback(async () => {
    setIsLoadingActive(true);
    setErrorMessage(null);
    try {
      const response = await api_client.get<ActiveOrder[]>('/orders/me/active');
      setActiveOrdersList(response.data);
    } catch (error: any) {
      console.error("Error fetching active orders:", error);
      const message = error.response?.data?.error || error.message || 'Failed to fetch active orders.';
      setErrorMessage(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      setIsLoadingActive(false);
    }
  }, [dispatch]);

  const fetchPastOrders = useCallback(async () => {
    setIsLoadingPast(true);
    setErrorMessage(null);
    try {
      const response = await api_client.get<PastOrder[]>('/orders/me/history');
      setPastOrdersList(response.data);
    } catch (error: any) {
      console.error("Error fetching past orders:", error);
      const message = error.response?.data?.error || error.message || 'Failed to fetch past orders.';
      setErrorMessage(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      setIsLoadingPast(false);
    }
  }, [dispatch]);

  // --- Tab Switching ---

  const handle_switch_tab = (tab: 'active' | 'past') => {
    setSelectedTab(tab);
    // Fetch data when switching tabs
    if (tab === 'active') {
      fetchActiveOrders();
    } else {
      fetchPastOrders();
    }
  };

  // --- Cancellation ---

  const handle_request_cancellation = async (order_uid: string) => {
    if (!window.confirm('Are you sure you want to request cancellation for this order? This requires operator approval.')) {
      return;
    }

    setCancellationRequestStatus(prev => ({ ...prev, [order_uid]: 'loading' }));
    try {
      await api_client.post(`/orders/me/${order_uid}/request_cancellation`);
      setCancellationRequestStatus(prev => ({ ...prev, [order_uid]: 'success' }));
      // Update local state immediately for UI feedback
      setActiveOrdersList(prev =>
        prev.map(order =>
          order.order_uid === order_uid ? { ...order, status: 'cancellation_requested' } : order
        )
      );
      dispatch(add_notification({ type: 'success', message: 'Cancellation requested successfully.' }));
    } catch (error: any) {
      console.error("Error requesting cancellation:", error);
      const message = error.response?.data?.error || error.message || 'Failed to request cancellation.';
      setCancellationRequestStatus(prev => ({ ...prev, [order_uid]: 'error' }));
      dispatch(add_notification({ type: 'error', message }));
    }
  };

  // --- Past Order Details ---

  const handle_fetch_and_show_details = async (order_uid: string) => {
    setIsDetailsModalOpen(true);
    setOrderDetailsToView(null); // Clear previous details, indicate loading maybe
    try {
      const response = await api_client.get<OrderDetails>(`/orders/me/${order_uid}`);
      setOrderDetailsToView(response.data);
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      const message = error.response?.data?.error || error.message || 'Failed to load order details.';
      dispatch(add_notification({ type: 'error', message }));
      setIsDetailsModalOpen(false); // Close modal on error
    }
  };

  const handle_close_details_modal = () => {
    setIsDetailsModalOpen(false);
    setOrderDetailsToView(null);
  };

  // --- WebSocket Listener ---

  useEffect(() => {
    if (!auth_token) {
      if (socket_ref.current) {
        console.log("Disconnecting WebSocket due to missing auth token.");
        socket_ref.current.disconnect();
        socket_ref.current = null;
      }
      return;
    }

    if (socket_ref.current) { // Already connected
        return;
    }

    console.log("Setting up WebSocket connection for order tracking...");
    const websocket_url = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:1337/ws';
    const socket = io(websocket_url, {
      auth: { token: auth_token },
      transports: ['websocket']
    });
    socket_ref.current = socket;

    socket.on('connect', () => console.log('Order Tracking WebSocket connected.'));
    socket.on('disconnect', (reason) => console.log('Order Tracking WebSocket disconnected:', reason));
    socket.on('connect_error', (err) => console.error('Order Tracking WebSocket connection error:', err.message));

    const handle_order_update = (payload: { data: any }) => {
        console.log('Received order_status_update_for_customer:', payload.data);
        const update_data = payload.data;
        const { order_uid, new_status } = update_data;

        setActiveOrdersList(prev_list => {
            const index = prev_list.findIndex(order => order.order_uid === order_uid);
            if (index === -1) return prev_list; // Order not found in active list

            // Check if status is terminal
            const is_terminal = ['completed', 'delivered', 'cancelled', 'rejected'].includes(new_status);

            if (is_terminal) {
                // Remove from active list
                console.log(`Order ${order_uid} moved to terminal state: ${new_status}. Removing from active list.`);
                 // Trigger refresh of past orders after a short delay
                 setTimeout(() => {
                     if (selectedTab === 'past') { // Only refetch if past tab is active
                        fetchPastOrders();
                     }
                 }, 500);
                return prev_list.filter(order => order.order_uid !== order_uid);
            } else {
                // Update the existing order in the active list
                return prev_list.map(order =>
                    order.order_uid === order_uid
                        ? {
                            ...order,
                            status: new_status,
                            estimated_ready_time: update_data.updated_estimated_ready_time !== undefined ? update_data.updated_estimated_ready_time : order.estimated_ready_time,
                            estimated_delivery_time: update_data.updated_estimated_delivery_time !== undefined ? update_data.updated_estimated_delivery_time : order.estimated_delivery_time,
                            // Note: rejection/cancellation reasons are usually handled by notifications, but could update here if needed
                          }
                        : order
                );
            }
        });
    };

    socket.on('order_status_update_for_customer', handle_order_update);

    // Cleanup function
    return () => {
      console.log("Cleaning up Order Tracking WebSocket listener.");
      if (socket_ref.current) {
        socket_ref.current.off('order_status_update_for_customer', handle_order_update);
        socket_ref.current.disconnect();
        socket_ref.current = null;
      }
    };
  }, [auth_token, fetchPastOrders, selectedTab]); // Re-run if auth_token changes

  // --- Initial Data Load ---

  useEffect(() => {
    if (selectedTab === 'active') {
      fetchActiveOrders();
    } else {
      fetchPastOrders();
    }
    // Intentionally only run on mount (and when fetch functions change, which they shouldn't)
    // Tab switching handles subsequent fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchActiveOrders, fetchPastOrders]);


  // --- Render ---

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">My Orders</h1>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => handle_switch_tab('active')}
              className={`${
                selectedTab === 'active'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Active Orders
            </button>
            <button
              onClick={() => handle_switch_tab('past')}
              className={`${
                selectedTab === 'past'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Past Orders
            </button>
          </nav>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-200 rounded">
            Error: {errorMessage}
          </div>
        )}

        {/* Active Orders Content */}
        {selectedTab === 'active' && (
          <div>
            {isLoadingActive ? (
              <div className="text-center py-10 text-gray-500">Loading active orders...</div>
            ) : activeOrdersList.length === 0 ? (
              <div className="text-center py-10 text-gray-500">You have no active orders.</div>
            ) : (
              <div className="space-y-6">
                {activeOrdersList.map((order) => {
                  const progress = get_status_progress(order.status);
                  const current_cancellation_status = cancellationRequestStatus[order.order_uid] || 'idle';
                  const can_request_cancellation = order.status === 'accepted' && current_cancellation_status !== 'loading' && current_cancellation_status !== 'success';

                  return (
                    <div key={order.order_uid} className="bg-white shadow overflow-hidden sm:rounded-lg p-4 border border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                        <div className="mb-2 sm:mb-0">
                          <h3 className="text-lg leading-6 font-medium text-gray-900">
                            Order #{order.order_number} - {order.food_truck_name}
                          </h3>
                          <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            Placed: {format_timestamp(order.order_time)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                           <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${get_status_color_class(order.status)}`}>
                             {get_status_text(order.status)}
                           </span>
                           <span className="text-lg font-semibold text-gray-800">${order.total_amount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                        <div
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      <div className="text-sm text-gray-600 mb-3">
                        <p>Status: <span className="font-medium">{get_status_text(order.status)}</span></p>
                        <p>Type: <span className="font-medium capitalize">{order.fulfillment_type}</span></p>
                        {order.fulfillment_type === 'pickup' && order.estimated_ready_time && (
                          <p>Estimated Ready: <span className="font-medium">{format_timestamp(order.estimated_ready_time)}</span></p>
                        )}
                        {order.fulfillment_type === 'delivery' && order.estimated_delivery_time && (
                          <p>Estimated Delivery: <span className="font-medium">{format_timestamp(order.estimated_delivery_time)}</span></p>
                        )}
                      </div>

                      {order.support_phone_number && ['accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(order.status) && (
                        <p className="text-xs text-gray-500 mb-3 italic">
                          For urgent order issues, contact the truck at: {order.support_phone_number}
                        </p>
                      )}

                      {/* Cancellation Button/Indicator */}
                      <div className="mt-2">
                        {order.status === 'cancellation_requested' && (
                          <p className="text-sm font-medium text-orange-600">Cancellation requested...</p>
                        )}
                        {can_request_cancellation && (
                          <button
                            onClick={() => handle_request_cancellation(order.order_uid)}
                            disabled={current_cancellation_status === 'loading'}
                            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {current_cancellation_status === 'loading' ? 'Requesting...' : 'Request Cancellation'}
                          </button>
                        )}
                        {current_cancellation_status === 'error' && order.status === 'accepted' && (
                           <p className="text-sm text-red-600 mt-1">Failed to request cancellation. Please try again.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Past Orders Content */}
        {selectedTab === 'past' && (
          <div>
            {isLoadingPast ? (
              <div className="text-center py-10 text-gray-500">Loading past orders...</div>
            ) : pastOrdersList.length === 0 ? (
              <div className="text-center py-10 text-gray-500">You have no past orders.</div>
            ) : (
              <div className="space-y-4">
                {pastOrdersList.map((order) => (
                  <div key={order.order_uid} className="bg-white shadow overflow-hidden sm:rounded-lg p-4 border border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                       <div className="mb-2 sm:mb-0">
                          <h3 className="text-md leading-6 font-medium text-gray-900">
                            Order #{order.order_number} - {order.food_truck_name}
                          </h3>
                          <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            {format_timestamp(order.order_time)} - ${order.total_amount.toFixed(2)}
                          </p>
                       </div>
                       <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${get_status_color_class(order.status)}`}>
                                {get_status_text(order.status)}
                            </span>
                            <button
                                onClick={() => handle_fetch_and_show_details(order.order_uid)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                View Details
                            </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Order Details {orderDetailsToView ? `#${orderDetailsToView.order_number}` : ''}
              </h2>
              <button
                onClick={handle_close_details_modal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-grow">
              {!orderDetailsToView ? (
                <div className="text-center text-gray-500">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  <p><span className="font-medium">Truck:</span> {orderDetailsToView.food_truck_name}</p>
                  <p><span className="font-medium">Status:</span> <span className={`font-semibold ${get_status_color_class(orderDetailsToView.status).replace('bg-', 'text-').replace('-100', '-800')}`}>{get_status_text(orderDetailsToView.status)}</span></p>
                  {orderDetailsToView.rejection_reason && <p><span className="font-medium">Rejection Reason:</span> {orderDetailsToView.rejection_reason}</p>}
                  {orderDetailsToView.cancellation_reason && <p><span className="font-medium">Cancellation Reason:</span> {orderDetailsToView.cancellation_reason}</p>}
                  <p><span className="font-medium">Order Time:</span> {format_timestamp(orderDetailsToView.order_time)}</p>
                  <p><span className="font-medium">Fulfillment:</span> <span className="capitalize">{orderDetailsToView.fulfillment_type}</span></p>

                  {orderDetailsToView.fulfillment_type === 'pickup' && orderDetailsToView.pickup_location_address_snapshot && (
                    <p><span className="font-medium">Pickup Location:</span> {orderDetailsToView.pickup_location_address_snapshot}</p>
                  )}
                  {orderDetailsToView.fulfillment_type === 'delivery' && orderDetailsToView.delivery_address_snapshot && (
                    <div>
                      <p className="font-medium">Delivery Address:</p>
                      <address className="text-sm text-gray-600 not-italic pl-4">
                        {orderDetailsToView.delivery_address_snapshot.street_address}<br />
                        {orderDetailsToView.delivery_address_snapshot.apt_suite && <>{orderDetailsToView.delivery_address_snapshot.apt_suite}<br /></>}
                        {orderDetailsToView.delivery_address_snapshot.city}, {orderDetailsToView.delivery_address_snapshot.state} {orderDetailsToView.delivery_address_snapshot.zip_code}
                      </address>
                    </div>
                  )}

                  {orderDetailsToView.special_instructions && (
                    <p><span className="font-medium">Special Instructions:</span> {orderDetailsToView.special_instructions}</p>
                  )}

                  <div className="pt-2 border-t border-gray-200">
                    <h4 className="font-medium mb-2">Items Ordered:</h4>
                    <ul className="space-y-2">
                      {orderDetailsToView.items.map(item => (
                        <li key={item.order_item_uid} className="border-b pb-2 last:border-b-0">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="font-medium">{item.quantity} x {item.item_name_snapshot}</p>
                                {item.selected_options.length > 0 && (
                                  <ul className="text-xs text-gray-500 pl-4 list-disc list-inside">
                                    {item.selected_options.map((opt, idx) => (
                                      <li key={idx}>{opt.option_name_snapshot} (+${opt.price_adjustment_snapshot.toFixed(2)})</li>
                                    ))}
                                  </ul>
                                )}
                             </div>
                             <p className="text-sm font-medium">${item.total_item_price.toFixed(2)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-gray-200 text-right text-sm space-y-1">
                     <p>Subtotal: <span className="font-medium">${orderDetailsToView.subtotal.toFixed(2)}</span></p>
                     <p>Tax: <span className="font-medium">${orderDetailsToView.tax_amount.toFixed(2)}</span></p>
                    {orderDetailsToView.delivery_fee_charged > 0 && (
                        <p>Delivery Fee: <span className="font-medium">${orderDetailsToView.delivery_fee_charged.toFixed(2)}</span></p>
                    )}
                     <p className="text-base font-semibold text-gray-800">Total: <span className="font-bold">${orderDetailsToView.total_amount.toFixed(2)}</span></p>
                  </div>

                </div>
              )}
            </div>

             <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
                 <button
                    onClick={handle_close_details_modal}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium"
                 >
                    Close
                 </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CustomerOrderTracking;
