import React, { useState, useEffect, FC } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, api_client, add_notification } from '@/store/main';

// Define the structure of a payment method based on the datamap and API response
interface PaymentMethod {
  uid: string; // Local DB UID for the payment method record
  card_type: string; // e.g., 'Visa', 'Mastercard'
  last_4_digits: string; // e.g., '1234'
  expiry_month: number; // e.g., 12
  expiry_year: number; // e.g., 2025
}

const UV_CustomerPaymentManagement: FC = () => {
  const dispatch = useDispatch();
  // Auth token is implicitly used by api_client interceptor, no need to select it here directly for calls

  // --- State Variables ---
  const [payment_methods_list, set_payment_methods_list] = useState<PaymentMethod[]>([]);
  const [is_loading, set_is_loading] = useState<boolean>(true);
  const [error_message, set_error_message] = useState<string | null>(null); // For general fetch errors
  const [delete_status, set_delete_status] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});
  const [show_confirm_delete_modal, set_show_confirm_delete_modal] = useState<boolean>(false);
  const [payment_method_to_delete, set_payment_method_to_delete] = useState<string | null>(null);
  const [modal_error_message, set_modal_error_message] = useState<string | null>(null); // Error specific to modal action

  // --- Action: Fetch Payment Methods ---
  const fetch_payment_methods = async () => {
    set_is_loading(true);
    set_error_message(null); // Clear previous general errors
    try {
      // Use the imported api_client which has the interceptor for auth token
      const response = await api_client.get<PaymentMethod[]>('/users/me/payment_methods');
      set_payment_methods_list(response.data);
       // Initialize delete status for fetched methods
       const initial_delete_status: Record<string, 'idle' | 'loading' | 'error'> = {};
       response.data.forEach(method => {
           initial_delete_status[method.uid] = 'idle';
       });
       set_delete_status(initial_delete_status);

    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      const message = error.response?.data?.error || error.message || 'Failed to retrieve payment methods.';
      set_error_message(message);
      // Optionally dispatch notification for fetch error
      // dispatch(add_notification({ type: 'error', message }));
    } finally {
      set_is_loading(false);
    }
  };

  // --- Action: Initiate Delete Confirmation ---
  const confirm_delete_payment_method = (uid: string) => {
    set_payment_method_to_delete(uid);
    set_modal_error_message(null); // Clear previous modal errors
    set_error_message(null); // Clear general errors when opening modal
    set_show_confirm_delete_modal(true);
  };

  // --- Action: Cancel Delete ---
  const cancel_delete = () => {
    set_show_confirm_delete_modal(false);
    // Reset status only if it was loading/error during cancellation attempt
    if (payment_method_to_delete && delete_status[payment_method_to_delete] !== 'idle') {
        set_delete_status(prev => ({ ...prev, [payment_method_to_delete]: 'idle' }));
    }
    set_payment_method_to_delete(null);
    set_modal_error_message(null);
  };

  // --- Action: Execute Delete ---
  const execute_delete_payment_method = async () => {
    if (!payment_method_to_delete) return;

    set_delete_status(prev => ({ ...prev, [payment_method_to_delete!]: 'loading' }));
    set_modal_error_message(null);

    try {
      await api_client.delete(`/users/me/payment_methods/${payment_method_to_delete}`);

      dispatch(add_notification({ type: 'success', message: 'Payment method deleted successfully.' }));
      set_show_confirm_delete_modal(false);
      // fetch_payment_methods will reset delete_status, no need to set to 'idle' here
      set_payment_method_to_delete(null);
      // Refresh the list after successful deletion
      await fetch_payment_methods();

    } catch (error: any) {
      console.error("Error deleting payment method:", error);
      const message = error.response?.data?.error || error.message || 'Failed to delete payment method.';
      set_modal_error_message(message); // Show error within the modal
      set_delete_status(prev => ({ ...prev, [payment_method_to_delete!]: 'error' }));
      // Optionally dispatch a general error notification too
      // dispatch(add_notification({ type: 'error', message }));
    }
     // No finally block needed to reset status, as success triggers fetch which rebuilds status,
     // and error sets the status explicitly.
  };

  // --- Fetch data on component mount ---
  useEffect(() => {
    fetch_payment_methods();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Helper to format expiry date ---
   const format_expiry = (month: number, year: number): string => {
    if (!month || !year) return 'N/A';
    const month_str = month < 10 ? `0${month}` : `${month}`;
    return `${month_str}/${year}`;
  };


  // --- Render ---
  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Manage Payment Methods</h1>
        <p className="mb-6 text-gray-600">
          View and remove your saved payment methods below. New payment methods can only be added during the checkout process for security reasons (PCI compliance).
        </p>

        {/* General Error Display (Only show if not loading and no modal error is present) */}
        {!is_loading && error_message && !modal_error_message && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error_message}</span>
          </div>
        )}

        {/* Loading State */}
        {is_loading && (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading payment methods...</span>
          </div>
        )}

        {/* Empty State */}
        {!is_loading && !error_message && payment_methods_list.length === 0 && (
          <div className="text-center py-10 px-6 bg-gray-100 rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-700">You have no saved payment methods.</p>
            <p className="mt-1 text-sm text-gray-500">Add a payment method during your next checkout.</p>
          </div>
        )}

        {/* List of Payment Methods */}
        {!is_loading && !error_message && payment_methods_list.length > 0 && (
          <div className="space-y-4">
            {payment_methods_list.map((method) => (
              <div key={method.uid} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center">
                    {/* Generic Card Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  <div>
                    <span className="font-semibold text-gray-800 capitalize">{method.card_type || 'Card'}</span> ending in <span className="font-mono">{method.last_4_digits}</span>
                    <span className="block text-sm text-gray-500">
                      Expires: {format_expiry(method.expiry_month, method.expiry_year)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => confirm_delete_payment_method(method.uid)}
                  disabled={delete_status[method.uid] === 'loading'}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex-shrink-0
                    ${delete_status[method.uid] === 'loading'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800'
                    }`}
                  aria-label={`Delete ${method.card_type || 'Card'} ending in ${method.last_4_digits}`}
                >
                  {delete_status[method.uid] === 'loading' ? (
                     <span className="flex items-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 " xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Deleting...
                     </span>
                  ) : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {show_confirm_delete_modal && (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 id="modal-title" className="text-xl font-semibold mb-4 text-gray-800">Confirm Deletion</h2>
            <p className="mb-4 text-gray-600">
              Are you sure you want to permanently delete this payment method? This action cannot be undone.
            </p>

            {/* Modal Error Display */}
            {modal_error_message && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                 <span className="block sm:inline">{modal_error_message}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={cancel_delete}
                disabled={delete_status[payment_method_to_delete!] === 'loading'}
                className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={execute_delete_payment_method}
                disabled={delete_status[payment_method_to_delete!] === 'loading'}
                className={`px-4 py-2 rounded border border-transparent text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500
                  ${delete_status[payment_method_to_delete!] === 'loading'
                  ? 'bg-red-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {delete_status[payment_method_to_delete!] === 'loading' ? (
                    <span className="flex items-center justify-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 " xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Deleting...
                     </span>
                ) : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CustomerPaymentManagement;