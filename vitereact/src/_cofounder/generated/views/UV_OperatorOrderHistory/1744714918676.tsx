import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';

import { RootState, add_notification, api_client } from '@/store/main';

// --- Interfaces based on datamap ---

interface PastOrderSummary {
  order_uid: string;
  order_number: string;
  customer_name: string; // e.g., "Chloe D."
  status: 'completed' | 'delivered' | 'rejected' | 'cancelled';
  total_amount: number;
  order_time: number; // timestamp ms
  finalized_time: number | null; // timestamp ms
}

type OrdersList = PastOrderSummary[];

interface HistorySummary {
  total_orders: number; // Total matching the filter period
  total_sales: number; // Only from completed/delivered orders in the period
}

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_orders: number;
  limit: number;
}

interface FullPastOrderDetails {
  order_uid: string;
  order_number: string;
  customer_details: { name: string; phone: string | null; };
  status: string;
  fulfillment_type: string;
  delivery_address_snapshot: Record<string, any> | null;
  pickup_location_address_snapshot: string | null;
  special_instructions: string | null;
  subtotal: number;
  tax_amount: number;
  delivery_fee_charged: number;
  total_amount: number;
  order_time: number;
  preparation_started_at?: number | null;
  ready_or_out_for_delivery_at?: number | null;
  completed_or_delivered_at?: number | null;
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

type SelectedOrder = FullPastOrderDetails | null;

// --- Component ---

const UV_OperatorOrderHistory: React.FC = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth_token } = useSelector((state: RootState) => state.auth);

  // --- State Variables ---
  const [orders_list, set_orders_list] = useState<OrdersList>([]);
  const [filter_date_from, set_filter_date_from] = useState<number | null>(null);
  const [filter_date_to, set_filter_date_to] = useState<number | null>(null);
  const [selected_date_range_preset, set_selected_date_range_preset] = useState<string>('today');
  const [custom_start_date_input, set_custom_start_date_input] = useState<string>('');
  const [custom_end_date_input, set_custom_end_date_input] = useState<string>('');
  const [summary_data, set_summary_data] = useState<HistorySummary>({ total_orders: 0, total_sales: 0 });
  const [is_loading, set_is_loading] = useState<boolean>(true);
  const [error_message, set_error_message] = useState<string | null>(null);
  const [pagination_info, set_pagination_info] = useState<PaginationInfo>({ current_page: 1, total_pages: 1, total_orders: 0, limit: 20 });
  const [selected_order_for_details, set_selected_order_for_details] = useState<SelectedOrder>(null);
  const [is_details_modal_open, set_is_details_modal_open] = useState<boolean>(false);
  const [is_detail_loading, set_is_detail_loading] = useState<boolean>(false);
  const [detail_error_message, set_detail_error_message] = useState<string | null>(null);
  const [is_initial_load, set_is_initial_load] = useState(true);

  // --- Helper Functions ---

  const calculate_date_range = useCallback((preset: string, custom_start?: string, custom_end?: string): { from: number | null, to: number | null } => {
    const now = new Date();
    let from_date: Date | null = null;
    let to_date: Date | null = null;

    switch (preset) {
      case 'today':
        from_date = startOfDay(now);
        to_date = endOfDay(now);
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        from_date = startOfDay(yesterday);
        to_date = endOfDay(yesterday);
        break;
      case 'last_7_days':
        from_date = startOfDay(subDays(now, 6)); // Include today
        to_date = endOfDay(now);
        break;
      case 'this_week': // Assuming week starts on Sunday
        from_date = startOfWeek(now);
        to_date = endOfWeek(now);
        break;
       case 'custom':
         if (custom_start) {
             const parsed_start = parseISO(custom_start);
             if (isValid(parsed_start)) {
                 from_date = startOfDay(parsed_start);
             }
         }
         if (custom_end) {
             const parsed_end = parseISO(custom_end);
             if (isValid(parsed_end)) {
                 to_date = endOfDay(parsed_end);
             }
         }
         // Ensure start is before end if both are set
         if (from_date && to_date && from_date > to_date) {
             [from_date, to_date] = [to_date, from_date]; // Swap them
         }
         break;
      default:
        from_date = startOfDay(now);
        to_date = endOfDay(now);
    }

    return {
      from: from_date ? from_date.getTime() : null,
      to: to_date ? to_date.getTime() : null,
    };
  }, []);

  // --- Actions ---

  const fetch_order_history = useCallback(async () => {
    if (!auth_token) {
      set_error_message("Authentication token is missing.");
      set_is_loading(false);
      return;
    }

    set_is_loading(true);
    set_error_message(null);

    const params: any = {
      status: 'completed,delivered,rejected,cancelled', // Fetch all final statuses
      page: pagination_info.current_page,
      limit: pagination_info.limit,
    };
    if (filter_date_from) params.date_from = filter_date_from;
    if (filter_date_to) params.date_to = filter_date_to;

    try {
      const response = await api_client.get('/operators/me/orders', { params });

      const fetched_orders: OrdersList = response.data.orders || [];
      const fetched_pagination: PaginationInfo = response.data.pagination || { current_page: 1, total_pages: 1, total_orders: 0, limit: 20 };

      set_orders_list(fetched_orders);
      set_pagination_info(fetched_pagination);

      // Calculate Summary Data client-side based on fetched orders for the period
      let total_sales = 0;
      fetched_orders.forEach(order => {
        if (order.status === 'completed' || order.status === 'delivered') {
          total_sales += order.total_amount;
        }
      });
      set_summary_data({
        total_orders: fetched_pagination.total_orders, // Use total from pagination for the filtered period
        total_sales: total_sales,
      });

      // Update URL params
      const new_search_params: Record<string, string> = {};
      if (filter_date_from) new_search_params.date_from = String(filter_date_from);
      if (filter_date_to) new_search_params.date_to = String(filter_date_to);
      if (fetched_pagination.current_page > 1) new_search_params.page = String(fetched_pagination.current_page);
       setSearchParams(new_search_params, { replace: true });


    } catch (error: any) {
      console.error("Error fetching order history:", error);
      const message = error.response?.data?.error || error.message || 'Failed to fetch order history.';
      set_error_message(message);
      dispatch(add_notification({ type: 'error', message }));
      set_orders_list([]); // Clear list on error
      set_summary_data({ total_orders: 0, total_sales: 0 }); // Reset summary
    } finally {
      set_is_loading(false);
      set_is_initial_load(false); // Mark initial load as complete
    }
  }, [auth_token, filter_date_from, filter_date_to, pagination_info.current_page, pagination_info.limit, dispatch, setSearchParams]);


  const handle_date_filter_change = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = event.target.value;
    set_selected_date_range_preset(preset);

    if (preset !== 'custom') {
        const { from, to } = calculate_date_range(preset);
        set_filter_date_from(from);
        set_filter_date_to(to);
        // Reset page to 1 when filter changes
        set_pagination_info(prev => ({ ...prev, current_page: 1 }));
        // Fetch will be triggered by useEffect watching filter_date_from/to
    } else {
        // For custom, wait for apply button
        // Optionally set default custom dates (e.g., today)
        const today_str = format(new Date(), 'yyyy-MM-dd');
        set_custom_start_date_input(today_str);
        set_custom_end_date_input(today_str);
    }
  };

   const handle_apply_custom_range = () => {
        if (selected_date_range_preset === 'custom') {
            const { from, to } = calculate_date_range('custom', custom_start_date_input, custom_end_date_input);
            set_filter_date_from(from);
            set_filter_date_to(to);
             // Reset page to 1 when filter changes
            set_pagination_info(prev => ({ ...prev, current_page: 1 }));
             // Fetch will be triggered by useEffect watching filter_date_from/to
        }
   };


  const change_page = (new_page: number) => {
    if (new_page >= 1 && new_page <= pagination_info.total_pages && new_page !== pagination_info.current_page) {
      set_pagination_info(prev => ({ ...prev, current_page: new_page }));
      // Fetch will be triggered by useEffect watching current_page
    }
  };

  const fetch_and_show_details = useCallback(async (order_uid: string) => {
    if (!auth_token) {
        dispatch(add_notification({ type: 'error', message: 'Authentication required.' }));
        return;
    }
    set_is_detail_loading(true);
    set_detail_error_message(null);
    set_selected_order_for_details(null); // Clear previous details
    set_is_details_modal_open(true); // Open modal immediately

    try {
      const response = await api_client.get(`/operators/me/orders/${order_uid}`);
      set_selected_order_for_details(response.data);
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      const message = error.response?.data?.error || error.message || 'Failed to fetch order details.';
      set_detail_error_message(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      set_is_detail_loading(false);
    }
  }, [auth_token, dispatch]);

  const close_details_modal = () => {
    set_is_details_modal_open(false);
    set_selected_order_for_details(null);
    set_detail_error_message(null);
  };

  // --- Effects ---

  // Initialize filters from URL or defaults on mount
  useEffect(() => {
    const page_param = parseInt(searchParams.get('page') || '1', 10);
    const date_from_param = searchParams.get('date_from');
    const date_to_param = searchParams.get('date_to');

    let initial_from: number | null = null;
    let initial_to: number | null = null;
    let initial_preset = 'today'; // Default

    if (date_from_param && date_to_param) {
      initial_from = parseInt(date_from_param, 10);
      initial_to = parseInt(date_to_param, 10);
       if (!isNaN(initial_from) && !isNaN(initial_to)) {
            initial_preset = 'custom'; // Assume custom if params are present
            set_custom_start_date_input(format(new Date(initial_from), 'yyyy-MM-dd'));
            set_custom_end_date_input(format(new Date(initial_to), 'yyyy-MM-dd'));
       } else {
            initial_from = null;
            initial_to = null;
       }
    }

    if (!initial_from || !initial_to) {
       const { from, to } = calculate_date_range('today'); // Default to today
       initial_from = from;
       initial_to = to;
       initial_preset = 'today';
    }

    set_filter_date_from(initial_from);
    set_filter_date_to(initial_to);
    set_selected_date_range_preset(initial_preset);
    set_pagination_info(prev => ({ ...prev, current_page: isNaN(page_param) ? 1 : page_param }));
    set_is_initial_load(true); // Ensure initial load triggers fetch in the next effect

    // Don't call fetch_order_history directly here, let the next effect handle it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculate_date_range /*, searchParams - intentionally omitted to run only once */]);


  // Fetch data when filters or page change (after initial load)
  useEffect(() => {
    // Only fetch if initial load is done OR if dependencies changed after initial load
     if (is_initial_load || (filter_date_from && filter_date_to)) {
        fetch_order_history();
     }
  }, [fetch_order_history, filter_date_from, filter_date_to, pagination_info.current_page, is_initial_load]);


  // --- Render ---
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Order History & Summary</h1>

        {/* --- Filters --- */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="date_range_preset" className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              id="date_range_preset"
              value={selected_date_range_preset}
              onChange={handle_date_filter_change}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_week">This Week</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {selected_date_range_preset === 'custom' && (
            <>
              <div>
                <label htmlFor="custom_start_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="custom_start_date"
                  value={custom_start_date_input}
                  onChange={(e) => set_custom_start_date_input(e.target.value)}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                />
              </div>
              <div>
                <label htmlFor="custom_end_date" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="custom_end_date"
                  value={custom_end_date_input}
                  onChange={(e) => set_custom_end_date_input(e.target.value)}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                />
              </div>
              <button
                onClick={handle_apply_custom_range}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Custom Range
              </button>
            </>
          )}
        </div>

        {/* --- Summary --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-500 mb-1">Total Orders</h2>
            <p className="text-3xl font-semibold text-gray-900">
              {is_loading ? '...' : summary_data.total_orders}
            </p>
            <p className="text-sm text-gray-500 mt-1">
                {filter_date_from && filter_date_to ?
                    `(${format(new Date(filter_date_from), 'MMM d, yyyy')} - ${format(new Date(filter_date_to), 'MMM d, yyyy')})`
                    : 'All Time'}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-500 mb-1">Total Sales (Completed/Delivered)</h2>
            <p className="text-3xl font-semibold text-gray-900">
              {is_loading ? '...' : `$${summary_data.total_sales.toFixed(2)}`}
            </p>
             <p className="text-sm text-gray-500 mt-1">
                {filter_date_from && filter_date_to ?
                    `(${format(new Date(filter_date_from), 'MMM d, yyyy')} - ${format(new Date(filter_date_to), 'MMM d, yyyy')})`
                    : 'All Time'}
            </p>
          </div>
        </div>

        {/* --- Loading & Error States --- */}
        {is_loading && (
          <div className="text-center py-10">
            <p className="text-gray-500">Loading order history...</p>
            {/* Optional: Add a spinner here */}
          </div>
        )}
        {error_message && !is_loading && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error_message}</span>
          </div>
        )}

        {/* --- Order List --- */}
        {!is_loading && !error_message && (
          <>
            {orders_list.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-lg shadow">
                <p className="text-gray-500">No orders found for the selected period.</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order #
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date / Time
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                        </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orders_list.map((order) => (
                        <tr key={order.order_uid}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.order_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.customer_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.total_amount.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    order.status === 'completed' || order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                    order.status === 'cancelled' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800' // Should not happen for history, but fallback
                                }`}>
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                                onClick={() => fetch_and_show_details(order.order_uid)}
                                className="text-indigo-600 hover:text-indigo-900"
                            >
                                View Details
                            </button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
              </div>
            )}

            {/* --- Pagination --- */}
            {pagination_info.total_pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination_info.current_page}</span> of <span className="font-medium">{pagination_info.total_pages}</span> ({pagination_info.total_orders} total orders)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => change_page(pagination_info.current_page - 1)}
                    disabled={pagination_info.current_page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => change_page(pagination_info.current_page + 1)}
                    disabled={pagination_info.current_page >= pagination_info.total_pages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- Details Modal --- */}
      {is_details_modal_open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay, triggers close on click */}
            <div className="fixed inset-0" aria-hidden="true" onClick={close_details_modal}></div>

            {/* Modal panel */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Order Details - #{selected_order_for_details?.order_number}
                    </h3>
                    <div className="mt-2">
                      {is_detail_loading && <p className="text-gray-500">Loading details...</p>}
                      {detail_error_message && <p className="text-red-600">Error: {detail_error_message}</p>}
                      {selected_order_for_details && !is_detail_loading && (
                        <div className="space-y-4 text-sm text-gray-700">
                          <p><strong>Status:</strong> <span className={`font-semibold ${
                                selected_order_for_details.status === 'completed' || selected_order_for_details.status === 'delivered' ? 'text-green-700' :
                                selected_order_for_details.status === 'cancelled' ? 'text-yellow-700' :
                                selected_order_for_details.status === 'rejected' ? 'text-red-700' : 'text-gray-700'
                            }`}>{selected_order_for_details.status.charAt(0).toUpperCase() + selected_order_for_details.status.slice(1)}</span>
                          </p>
                          {(selected_order_for_details.status === 'rejected' && selected_order_for_details.rejection_reason) && <p><strong>Rejection Reason:</strong> {selected_order_for_details.rejection_reason}</p>}
                           {(selected_order_for_details.status === 'cancelled' && selected_order_for_details.cancellation_reason) && <p><strong>Cancellation Reason:</strong> {selected_order_for_details.cancellation_reason}</p>}

                          <p><strong>Order Time:</strong> {format(new Date(selected_order_for_details.order_time), 'MMM d, yyyy h:mm a')}</p>
                           {selected_order_for_details.completed_or_delivered_at && <p><strong>Finalized Time:</strong> {format(new Date(selected_order_for_details.completed_or_delivered_at), 'MMM d, yyyy h:mm a')}</p>}
                          <p><strong>Customer:</strong> {selected_order_for_details.customer_details.name} {selected_order_for_details.customer_details.phone && `(${selected_order_for_details.customer_details.phone})`}</p>
                          <p><strong>Fulfillment:</strong> {selected_order_for_details.fulfillment_type.charAt(0).toUpperCase() + selected_order_for_details.fulfillment_type.slice(1)}</p>

                          {selected_order_for_details.fulfillment_type === 'delivery' && selected_order_for_details.delivery_address_snapshot && (
                            <p><strong>Delivery Address:</strong> {selected_order_for_details.delivery_address_snapshot.street_address}, {selected_order_for_details.delivery_address_snapshot.apt_suite && `${selected_order_for_details.delivery_address_snapshot.apt_suite}, `}{selected_order_for_details.delivery_address_snapshot.city}, {selected_order_for_details.delivery_address_snapshot.state} {selected_order_for_details.delivery_address_snapshot.zip_code}</p>
                          )}
                          {selected_order_for_details.fulfillment_type === 'pickup' && selected_order_for_details.pickup_location_address_snapshot && (
                            <p><strong>Pickup Location:</strong> {selected_order_for_details.pickup_location_address_snapshot}</p>
                          )}

                          {selected_order_for_details.special_instructions && <p><strong>Special Instructions:</strong> {selected_order_for_details.special_instructions}</p>}

                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-medium text-gray-800 mb-2">Items Ordered:</h4>
                            <ul className="space-y-2">
                              {selected_order_for_details.items.map(item => (
                                <li key={item.order_item_uid}>
                                  <div className="flex justify-between">
                                     <span>{item.quantity} x {item.item_name_snapshot}</span>
                                     <span>${item.total_item_price.toFixed(2)}</span>
                                  </div>
                                  {item.selected_options.length > 0 && (
                                    <ul className="pl-4 text-xs text-gray-500">
                                      {item.selected_options.map((opt, index) => (
                                        <li key={index}>
                                          + {opt.option_name_snapshot} (${opt.price_adjustment_snapshot.toFixed(2)})
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-200 text-right space-y-1">
                            <p>Subtotal: ${selected_order_for_details.subtotal.toFixed(2)}</p>
                            <p>Tax: ${selected_order_for_details.tax_amount.toFixed(2)}</p>
                            {selected_order_for_details.fulfillment_type === 'delivery' && <p>Delivery Fee: ${selected_order_for_details.delivery_fee_charged.toFixed(2)}</p>}
                            <p className="font-bold text-gray-900">Total: ${selected_order_for_details.total_amount.toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={close_details_modal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_OperatorOrderHistory;
