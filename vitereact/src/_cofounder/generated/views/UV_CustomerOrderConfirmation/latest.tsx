import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api_client } from '@/store/main'; // Import the configured Axios instance

// Define the interface for order details based on analysis and backend response
interface OrderConfirmationDetails {
    order_uid: string;
    order_number: string;
    status: string;
    estimated_ready_time: number | null; // Timestamp (ms)
    estimated_delivery_time: number | null; // Timestamp (ms)
    total_amount: number;
    fulfillment_type: 'pickup' | 'delivery';
    pickup_location_address_snapshot: string | null;
    delivery_address_snapshot: {
        street_address: string;
        apt_suite: string | null;
        city: string;
        state: string;
        zip_code: string;
    } | null;
    food_truck_name: string;
    items: Array<{
        order_item_uid: string;
        item_name_snapshot: string;
        quantity: number;
        total_item_price: number; // Note: this is total for the line item (quantity * price)
        selected_options: Array<{
            option_name_snapshot: string;
            price_adjustment_snapshot: number;
        }>;
    }>;
}

const UV_CustomerOrderConfirmation: React.FC = () => {
    const { order_uid } = useParams<{ order_uid: string }>();
    const navigate = useNavigate();

    const [orderConfirmationDetails, setOrderConfirmationDetails] = useState<OrderConfirmationDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error_message, setErrorMessage] = useState<string | null>(null);

    // --- Helper Functions ---
    const format_timestamp = (timestamp_ms: number | null): string => {
        if (!timestamp_ms) return 'Not available';
        try {
            const date = new Date(timestamp_ms);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch (e) {
            console.error("Error formatting timestamp:", e);
            return 'Invalid date';
        }
    };

    const format_currency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // --- Actions ---
    const fetchOrderDetails = async () => {
        if (!order_uid) {
            setErrorMessage("Order ID is missing.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        try {
            // Use api_client which includes the auth token interceptor
            const response = await api_client.get<OrderConfirmationDetails>(`/orders/me/${order_uid}`);
            setOrderConfirmationDetails(response.data);
        } catch (error: any) {
            console.error("Error fetching order details:", error);
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                 setErrorMessage(error.response.data?.error || `Error ${error.response.status}: Failed to load order details.`);
            } else if (error.request) {
                // The request was made but no response was received
                 setErrorMessage("Network error: Could not connect to the server.");
            } else {
                // Something happened in setting up the request that triggered an Error
                 setErrorMessage("An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- Effects ---
    useEffect(() => {
        fetchOrderDetails();
        // Dependency array includes order_uid to refetch if it changes (though unlikely in this context)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order_uid]);

    // --- Render ---
    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                {isLoading && (
                    <div className="text-center py-10">
                        <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-lg text-gray-600">Loading your order confirmation...</p>
                    </div>
                )}

                {error_message && !isLoading && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline ml-2">{error_message}</span>
                        <button
                            onClick={() => navigate('/')} // Navigate home on error close
                            className="absolute top-0 bottom-0 right-0 px-4 py-3"
                        >
                            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.03a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </button>
                    </div>
                )}

                {orderConfirmationDetails && !isLoading && !error_message && (
                    <div className="bg-white shadow-md rounded-lg p-6 md:p-8">
                        {/* 1. Success Message */}
                        <div className="text-center mb-6">
                            <svg className="w-16 h-16 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Thank You! Your Order is Confirmed.</h1>
                            <p className="text-gray-600 mt-2">We've received your order and the food truck has been notified.</p>
                        </div>

                        <div className="border-t border-b border-gray-200 py-6 mb-6 space-y-4">
                            {/* 2. Order Number */}
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Order Number:</span>
                                <span className="text-gray-800 font-semibold">{orderConfirmationDetails.order_number}</span>
                            </div>

                             {/* Food Truck Name */}
                             <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Food Truck:</span>
                                <span className="text-gray-800 font-semibold">{orderConfirmationDetails.food_truck_name}</span>
                            </div>

                            {/* 3. Estimated Time */}
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">
                                    {orderConfirmationDetails.fulfillment_type === 'pickup' ? 'Estimated Ready By:' : 'Estimated Delivery By:'}
                                </span>
                                <span className="text-gray-800 font-semibold">
                                    {format_timestamp(orderConfirmationDetails.fulfillment_type === 'pickup' ? orderConfirmationDetails.estimated_ready_time : orderConfirmationDetails.estimated_delivery_time)}
                                </span>
                            </div>

                            {/* 4. Fulfillment Details */}
                            <div className="text-left">
                                <span className="text-gray-600 font-medium block mb-1">
                                    {orderConfirmationDetails.fulfillment_type === 'pickup' ? 'Pickup From:' : 'Delivering To:'}
                                </span>
                                <div className="text-gray-800 text-sm">
                                    {orderConfirmationDetails.fulfillment_type === 'pickup' && (
                                        <p>{orderConfirmationDetails.pickup_location_address_snapshot || 'Address not available'}</p>
                                    )}
                                    {orderConfirmationDetails.fulfillment_type === 'delivery' && orderConfirmationDetails.delivery_address_snapshot && (
                                        <>
                                            <p>{orderConfirmationDetails.delivery_address_snapshot.street_address}</p>
                                            {orderConfirmationDetails.delivery_address_snapshot.apt_suite && <p>{orderConfirmationDetails.delivery_address_snapshot.apt_suite}</p>}
                                            <p>{orderConfirmationDetails.delivery_address_snapshot.city}, {orderConfirmationDetails.delivery_address_snapshot.state} {orderConfirmationDetails.delivery_address_snapshot.zip_code}</p>
                                        </>
                                    )}
                                     {orderConfirmationDetails.fulfillment_type === 'delivery' && !orderConfirmationDetails.delivery_address_snapshot && (
                                        <p>Address details not available.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 5. Item Summary */}
                         <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">Order Summary:</h3>
                            <ul className="space-y-3">
                                {orderConfirmationDetails.items.map((item) => (
                                    <li key={item.order_item_uid} className="flex justify-between items-start text-sm">
                                        <div>
                                            <span className="font-medium text-gray-800">{item.quantity}x {item.item_name_snapshot}</span>
                                            {item.selected_options.length > 0 && (
                                                <div className="pl-4 text-xs text-gray-500">
                                                    {item.selected_options.map((opt, index) => (
                                                        <span key={index}>+ {opt.option_name_snapshot}{index < item.selected_options.length - 1 ? ', ' : ''}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-gray-700">{format_currency(item.total_item_price)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 6. Total Cost */}
                        <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                            <span className="text-lg font-semibold text-gray-800">Total Paid:</span>
                            <span className="text-lg font-bold text-gray-900">{format_currency(orderConfirmationDetails.total_amount)}</span>
                        </div>

                        {/* 7. & 8. Action Buttons */}
                        <div className="mt-8 flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                            <Link
                                to="/orders" // Link to the order tracking page
                                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Track Your Order
                            </Link>
                            <Link
                                to="/" // Link back to discovery/home
                                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Continue Shopping
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default UV_CustomerOrderConfirmation;