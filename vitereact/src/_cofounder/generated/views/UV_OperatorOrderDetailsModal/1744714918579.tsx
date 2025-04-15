import React, { useState, useEffect } from 'react';
import { FiX, FiPhone, FiMapPin, FiClipboard, FiDollarSign, FiHash, FiClock, FiUser } from 'react-icons/fi'; // Example icons

// --- Interfaces ---

interface OrderItemOption {
  option_name_snapshot: string;
  price_adjustment_snapshot: number;
}

interface OrderItem {
  order_item_uid: string;
  item_name_snapshot: string;
  quantity: number;
  total_item_price: number;
  selected_options: OrderItemOption[];
}

interface OrderDetails {
  order_uid: string;
  order_number: string;
  customer_details: { name: string; phone: string | null };
  status: 'pending_confirmation' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'delivered' | 'rejected' | 'cancelled' | 'cancellation_requested';
  fulfillment_type: 'pickup' | 'delivery';
  delivery_address_snapshot?: { street_address: string; apt_suite: string | null; city: string; state: string; zip_code: string; } | null;
  pickup_location_address_snapshot?: string | null;
  special_instructions?: string | null;
  subtotal: number;
  tax_amount: number;
  delivery_fee_charged: number;
  total_amount: number;
  order_time: number; // Timestamp ms
  estimated_ready_time?: number | null; // Timestamp ms
  estimated_delivery_time?: number | null; // Timestamp ms
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  items: OrderItem[];
}

interface UV_OperatorOrderDetailsModalProps {
  order_details: OrderDetails | null;
  is_visible: boolean;
  is_loading_action: boolean;
  action_error: string | null;
  average_prep_time_minutes: number; // Received but not used for input in MVP

  // Action handlers passed from UV_OperatorDashboard
  on_close: () => void;
  on_accept: (order_uid: string, adjusted_prep_time_minutes?: number) => void;
  on_reject: (order_uid: string, reason: string) => void;
  on_update_status: (order_uid: string, new_status: string) => void;
  on_cancel: (order_uid: string, reason: string) => void;
  on_approve_cancellation: (order_uid: string) => void;
  on_reject_cancellation: (order_uid: string) => void;
}

// --- Helper Functions ---

const format_currency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return '$?.??';
  return `$${amount.toFixed(2)}`;
};

const format_timestamp = (timestamp: number | undefined | null): string => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

// --- Component ---

const UV_OperatorOrderDetailsModal: React.FC<UV_OperatorOrderDetailsModalProps> = ({
  order_details,
  is_visible,
  is_loading_action,
  action_error,
  // average_prep_time_minutes, // Not used for input in MVP
  on_close,
  on_accept,
  on_reject,
  on_update_status,
  on_cancel,
  on_approve_cancellation,
  on_reject_cancellation,
}) => {

  const [reason_input, set_reason_input] = useState('');
  const [show_reason_prompt_for, set_show_reason_prompt_for] = useState<'reject' | 'cancel' | null>(null);

  // Reset local state when modal becomes visible or order changes
  useEffect(() => {
    if (is_visible) {
      set_reason_input('');
      set_show_reason_prompt_for(null);
    }
  }, [is_visible, order_details]);

  const handle_reject_click = () => {
    set_show_reason_prompt_for('reject');
  };

  const handle_cancel_click = () => {
    set_show_reason_prompt_for('cancel');
  };

  const handle_confirm_reject = () => {
    if (reason_input.trim() && order_details) {
      on_reject(order_details.order_uid, reason_input.trim());
    }
  };

  const handle_confirm_cancel = () => {
    if (reason_input.trim() && order_details) {
      on_cancel(order_details.order_uid, reason_input.trim());
    }
  };

  const handle_back_from_reason = () => {
    set_show_reason_prompt_for(null);
    set_reason_input('');
  };

  const handle_accept_click = () => {
      if (order_details) {
          // For MVP, not prompting for time adjustment, just accept.
          on_accept(order_details.order_uid);
      }
  };

  const handle_update_status_click = (new_status: string) => {
      if (order_details) {
          on_update_status(order_details.order_uid, new_status);
      }
  };

  const handle_approve_cancellation_click = () => {
      if (order_details) {
          on_approve_cancellation(order_details.order_uid);
      }
  };

   const handle_reject_cancellation_click = () => {
      if (order_details) {
          on_reject_cancellation(order_details.order_uid);
      }
  };


  if (!is_visible || !order_details) {
    return null;
  }

  const {
    order_uid, order_number, customer_details, status, fulfillment_type,
    delivery_address_snapshot, pickup_location_address_snapshot, special_instructions,
    subtotal, tax_amount, delivery_fee_charged, total_amount, order_time,
    estimated_ready_time, estimated_delivery_time, items
  } = order_details;

  const is_delivery = fulfillment_type === 'delivery';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-in-out"></div>

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">

          {/* Header */}
          <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FiHash className="text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">Order #{order_number}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-800' :
                  status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                  status === 'preparing' ? 'bg-purple-100 text-purple-800' :
                  status === 'ready_for_pickup' ? 'bg-green-100 text-green-800' :
                  status === 'out_for_delivery' ? 'bg-teal-100 text-teal-800' :
                  status === 'completed' || status === 'delivered' ? 'bg-gray-100 text-gray-800' :
                  status === 'rejected' || status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  status === 'cancellation_requested' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
              }`}>
                {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            <button
              onClick={on_close}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
              disabled={is_loading_action}
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 flex-grow">
            {/* Customer & Time Info */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <FiUser className="mr-2 text-gray-500" />
                <span>{customer_details.name || 'N/A'}</span>
              </div>
              <div className="flex items-center">
                <FiClock className="mr-2 text-gray-500" />
                <span>Ordered: {format_timestamp(order_time)}</span>
              </div>
            </div>

            {/* Fulfillment Info */}
            <div className="mb-5 p-4 bg-gray-50 rounded-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                {is_delivery ? <FiMapPin className="mr-2 text-blue-500"/> : <FiClipboard className="mr-2 text-green-500"/>}
                {is_delivery ? 'Delivery Details' : 'Pickup Details'}
              </h3>
              {is_delivery ? (
                <>
                  {delivery_address_snapshot ? (
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>{delivery_address_snapshot.street_address}</p>
                      {delivery_address_snapshot.apt_suite && <p>Apt/Suite: {delivery_address_snapshot.apt_suite}</p>}
                      <p>{delivery_address_snapshot.city}, {delivery_address_snapshot.state} {delivery_address_snapshot.zip_code}</p>
                    </div>
                  ) : <p className="text-sm text-gray-500 italic">Address not available.</p>}
                  {customer_details.phone && (
                    <div className="mt-2 flex items-center text-sm text-gray-700">
                      <FiPhone className="mr-2 text-gray-500" />
                      <a href={`tel:${customer_details.phone}`} className="text-blue-600 hover:underline">{customer_details.phone}</a>
                    </div>
                  )}
                  {estimated_delivery_time && (
                    <p className="text-sm text-gray-500 mt-2">Est. Delivery: {format_timestamp(estimated_delivery_time)}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700">{pickup_location_address_snapshot || 'Pickup location not specified.'}</p>
                  {estimated_ready_time && (
                    <p className="text-sm text-gray-500 mt-2">Est. Ready: {format_timestamp(estimated_ready_time)}</p>
                  )}
                </>
              )}
            </div>

            {/* Special Instructions */}
            {special_instructions && (
              <div className="mb-5 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                 <h4 className="text-sm font-semibold text-yellow-800 mb-1">Special Instructions:</h4>
                 <p className="text-sm text-yellow-700 whitespace-pre-wrap">{special_instructions}</p>
              </div>
            )}

            {/* Itemized List */}
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Items Ordered</h3>
              <ul className="divide-y divide-gray-200 border-t border-b border-gray-200">
                {items.map((item) => (
                  <li key={item.order_item_uid} className="py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.quantity}x {item.item_name_snapshot}
                        </p>
                        {item.selected_options.length > 0 && (
                          <ul className="mt-1 pl-4 text-xs text-gray-500 list-disc list-inside">
                            {item.selected_options.map((option, index) => (
                              <li key={index}>
                                {option.option_name_snapshot}
                                {option.price_adjustment_snapshot > 0 && ` (+${format_currency(option.price_adjustment_snapshot)})`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{format_currency(item.total_item_price)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm text-right text-gray-700">
              <p>Subtotal: <span className="font-medium">{format_currency(subtotal)}</span></p>
              <p>Tax: <span className="font-medium">{format_currency(tax_amount)}</span></p>
              {is_delivery && <p>Delivery Fee: <span className="font-medium">{format_currency(delivery_fee_charged)}</span></p>}
              <p className="text-base font-semibold text-gray-900 mt-1">
                Total: <span className="text-indigo-600">{format_currency(total_amount)}</span>
              </p>
              <p className="text-xs text-green-600 font-medium">(Paid)</p>
            </div>

          </div>

          {/* Footer with Actions & Error/Loading State */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
             {action_error && (
                <div className="mb-3 p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
                    Error: {action_error}
                </div>
             )}

             {is_loading_action && (
                 <div className="flex justify-center items-center mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Processing...</span>
                 </div>
             )}

             {/* Reason Prompt Section */}
             {show_reason_prompt_for && (
                 <div className="mb-4 p-4 border border-gray-300 rounded-md bg-white">
                     <label htmlFor="reason_input" className="block text-sm font-medium text-gray-700 mb-1">
                         Reason for {show_reason_prompt_for === 'reject' ? 'Rejection' : 'Cancellation'}: <span className="text-red-500">*</span>
                     </label>
                     <textarea
                         id="reason_input"
                         rows={2}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                         value={reason_input}
                         onChange={(e) => set_reason_input(e.target.value)}
                         disabled={is_loading_action}
                         placeholder={show_reason_prompt_for === 'reject' ? 'e.g., Too busy, Item unavailable' : 'e.g., Out of stock, Equipment issue'}
                     />
                     <div className="mt-3 flex justify-end space-x-3">
                          <button
                              type="button"
                              onClick={handle_back_from_reason}
                              disabled={is_loading_action}
                              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                              Back
                          </button>
                          <button
                              type="button"
                              onClick={show_reason_prompt_for === 'reject' ? handle_confirm_reject : handle_confirm_cancel}
                              disabled={is_loading_action || !reason_input.trim()}
                              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                  show_reason_prompt_for === 'reject' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                              } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                              Confirm {show_reason_prompt_for === 'reject' ? 'Reject' : 'Cancel'}
                          </button>
                     </div>
                 </div>
             )}

             {/* Action Buttons (Only show if reason prompt is not active) */}
             {!show_reason_prompt_for && (
                 <div className="flex flex-wrap justify-end gap-3">
                    {/* New Order Actions */}
                    {status === 'pending_confirmation' && (
                        <>
                            <button
                                type="button"
                                onClick={handle_reject_click}
                                disabled={is_loading_action}
                                className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                onClick={handle_accept_click}
                                disabled={is_loading_action}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                Accept Order
                            </button>
                        </>
                    )}

                    {/* Active Order Actions */}
                    {status === 'accepted' && (
                         <>
                            <button type="button" onClick={handle_cancel_click} disabled={is_loading_action} className="px-4 py-2 border border-yellow-300 text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md text-sm font-medium disabled:opacity-50">Cancel Order</button>
                            <button type="button" onClick={() => handle_update_status_click('preparing')} disabled={is_loading_action} className="px-4 py-2 border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium disabled:opacity-50">Mark as Preparing</button>
                         </>
                    )}
                    {status === 'preparing' && (
                         <>
                            <button type="button" onClick={handle_cancel_click} disabled={is_loading_action} className="px-4 py-2 border border-yellow-300 text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md text-sm font-medium disabled:opacity-50">Cancel Order</button>
                            {is_delivery ? (
                                <button type="button" onClick={() => handle_update_status_click('out_for_delivery')} disabled={is_loading_action} className="px-4 py-2 border border-transparent text-white bg-teal-600 hover:bg-teal-700 rounded-md text-sm font-medium disabled:opacity-50">Mark Out for Delivery</button>
                            ) : (
                                <button type="button" onClick={() => handle_update_status_click('ready_for_pickup')} disabled={is_loading_action} className="px-4 py-2 border border-transparent text-white bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50">Mark Ready for Pickup</button>
                            )}
                         </>
                    )}
                    {status === 'ready_for_pickup' && (
                         <>
                            <button type="button" onClick={handle_cancel_click} disabled={is_loading_action} className="px-4 py-2 border border-yellow-300 text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md text-sm font-medium disabled:opacity-50">Cancel Order</button>
                            <button type="button" onClick={() => handle_update_status_click('completed')} disabled={is_loading_action} className="px-4 py-2 border border-transparent text-white bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium disabled:opacity-50">Mark Completed</button>
                         </>
                    )}
                    {status === 'out_for_delivery' && (
                         <>
                            <button type="button" onClick={handle_cancel_click} disabled={is_loading_action} className="px-4 py-2 border border-yellow-300 text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md text-sm font-medium disabled:opacity-50">Cancel Order</button>
                            <button type="button" onClick={() => handle_update_status_click('delivered')} disabled={is_loading_action} className="px-4 py-2 border border-transparent text-white bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium disabled:opacity-50">Mark Delivered</button>
                         </>
                    )}

                     {/* Cancellation Requested Actions */}
                    {status === 'cancellation_requested' && (
                        <>
                            <button
                                type="button"
                                onClick={handle_reject_cancellation_click}
                                disabled={is_loading_action}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                Reject Cancellation
                            </button>
                            <button
                                type="button"
                                onClick={handle_approve_cancellation_click}
                                disabled={is_loading_action}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                                Approve Cancellation
                            </button>
                        </>
                    )}

                 </div>
             )}
          </div>

        </div>
      </div>
    </>
  );
};

export default UV_OperatorOrderDetailsModal;