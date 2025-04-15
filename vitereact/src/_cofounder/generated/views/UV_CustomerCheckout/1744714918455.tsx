import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
    useStripe,
    useElements,
    CardElement,
    Elements // Import Elements for provider context
} from '@stripe/react-stripe-js';
import { loadStripe, StripeCardElement } from '@stripe/stripe-js';
import { RootState, api_client, clear_cart, add_notification } from '@/store/main';
import { FaMapMarkerAlt, FaRegCreditCard, FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa'; // Example icons

// --- Interfaces (copied from datamap for clarity) ---
interface Address {
    uid: string;
    nickname: string;
    street_address: string;
    apt_suite: string | null;
    city: string;
    state: string;
    zip_code: string;
    is_default: boolean;
    // Add potentially missing coords if stored, otherwise geocode
    latitude?: number | null;
    longitude?: number | null;
}
type AvailableAddresses = Address[];

interface NewAddressInput {
    nickname: string;
    street_address: string;
    apt_suite: string | null;
    city: string;
    state: string;
    zip_code: string;
    // is_default: boolean; // Not typically set here
}

interface PaymentMethod {
    uid: string; // Local DB UID
    card_type: string;
    last_4_digits: string;
    expiry_month: number;
    expiry_year: number;
    payment_gateway_method_id: string; // e.g., Stripe's pm_...
}
type AvailablePaymentMethods = PaymentMethod[];

interface TruckDetails {
    uid: string;
    name: string;
    current_location_address: string | null;
    location_latitude: number | null;
    location_longitude: number | null;
    delivery_enabled: boolean;
    delivery_fee: number | null;
    delivery_minimum_order_value: number | null;
    delivery_radius_km: number | null;
    average_preparation_minutes: number;
}

interface CartSummaryItem {
    item_name_snapshot: string;
    quantity: number;
    total_item_price: number;
    customizations_summary?: string;
}
type CartSummary = CartSummaryItem[];

// --- Constants ---
const TAX_RATE = 0.09; // Example 9% tax rate
const DELIVERY_BUFFER_MINUTES = 15; // Example delivery buffer

// --- Helper Functions ---

// Haversine distance calculation (copied from backend spec)
const calculate_distance_km = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number => {
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

// Placeholder Geocoding function - Replace with actual API call (e.g., Mapbox)
const geocode_address = async (address: string): Promise<{ latitude: number | null, longitude: number | null }> => {
    console.warn(`Geocoding placeholder used for address: "${address}". Using mock coordinates.`);
    // Mock coordinates near Downtown LA for testing
    // In a real app, call Mapbox/Google API here
    if (!address || address.trim() === '') return { latitude: null, longitude: null };
    // Simulate success/failure based on some pattern
    if (address.toLowerCase().includes("invalid")) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        throw new Error("Geocoding failed: Address not found");
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return { latitude: 34.0522 + (Math.random() - 0.5) * 0.05, longitude: -118.2437 + (Math.random() - 0.5) * 0.05 };
};


// --- Stripe Card Element Styling ---
const card_element_options = {
  style: {
    base: {
      color: "#32325d",
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a",
    },
  },
};

// --- Load Stripe outside component ---
// Replace with your actual Stripe publishable key
const stripe_publishable_key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY';
const stripePromise = loadStripe(stripe_publishable_key);


// --- Component Implementation ---

const UV_CustomerCheckout: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const stripe = useStripe();
    const elements = useElements();

    // Global State
    const cart_items = useSelector((state: RootState) => state.cart.items);
    const food_truck_uid_from_cart = useSelector((state: RootState) => state.cart.cart_metadata.food_truck_uid);

    // Local State
    const [truckDetails, setTruckDetails] = useState<TruckDetails | null>(null);
    const [availableAddresses, setAvailableAddresses] = useState<AvailableAddresses>([]);
    const [availablePaymentMethods, setAvailablePaymentMethods] = useState<AvailablePaymentMethods>([]);
    const [selectedFulfillmentType, setSelectedFulfillmentType] = useState<'pickup' | 'delivery' | null>(null);
    const [selectedAddressUid, setSelectedAddressUid] = useState<string | null>(null);
    const [newAddressInput, setNewAddressInput] = useState<NewAddressInput>({ nickname: "", street_address: "", apt_suite: null, city: "", state: "", zip_code: "" });
    const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
    const [deliveryAddressValidationStatus, setDeliveryAddressValidationStatus] = useState<'idle' | 'valid' | 'invalid_zone' | 'pending' | 'error'>('idle');
    const [deliveryAddressValidationError, setDeliveryAddressValidationError] = useState<string | null>(null);
    const [selectedPaymentMethodUid, setSelectedPaymentMethodUid] = useState<string | null>(null); // null means 'add new'
    const [isAddingNewPaymentMethod, setIsAddingNewPaymentMethod] = useState(false); // Controlled by selectedPaymentMethodUid
    const [shouldSavePaymentMethod, setShouldSavePaymentMethod] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start loading initially
    const [isPlacingOrder, setIsPlacingOrder] = useState(false); // Specific loading for place order button

    // Derived State (Calculated Totals & Summary)
    const { cartSummary, cartSubtotal, estimatedTax, deliveryFee, orderTotal } = useMemo(() => {
        const subtotal = cart_items.reduce((sum, item) => sum + item.total_item_price, 0);
        const tax = subtotal * TAX_RATE;
        let fee = 0;
        if (selectedFulfillmentType === 'delivery' && truckDetails?.delivery_enabled && truckDetails.delivery_fee) {
            fee = truckDetails.delivery_fee;
        }
        const total = subtotal + tax + fee;

        const summary: CartSummary = cart_items.map(item => {
            const customizations = item.selected_options.map(opt => opt.option_name_snapshot).join(', ');
            return {
                item_name_snapshot: item.item_name_snapshot,
                quantity: item.quantity,
                total_item_price: item.total_item_price,
                customizations_summary: customizations || undefined
            };
        });

        return { cartSummary: summary, cartSubtotal: subtotal, estimatedTax: tax, deliveryFee: fee, orderTotal: total };
    }, [cart_items, selectedFulfillmentType, truckDetails]);

    // --- Effects ---

    // Initial Data Fetch
    useEffect(() => {
        const initializeCheckout = async () => {
            setIsLoading(true);
            setPaymentError(null);

            if (!food_truck_uid_from_cart || cart_items.length === 0) {
                dispatch(add_notification({ type: 'error', message: 'Your cart is empty or invalid. Redirecting...' }));
                navigate('/'); // Redirect if cart is invalid/empty
                return;
            }

            try {
                const [addressRes, paymentRes, truckRes] = await Promise.all([
                    api_client.get('/users/me/addresses'),
                    api_client.get('/users/me/payment_methods'),
                    api_client.get(`/food_trucks/${food_truck_uid_from_cart}`)
                ]);

                const addresses: AvailableAddresses = addressRes.data;
                setAvailableAddresses(addresses);
                const defaultAddress = addresses.find(addr => addr.is_default);
                if (defaultAddress) {
                    setSelectedAddressUid(defaultAddress.uid);
                }

                const paymentMethods: AvailablePaymentMethods = paymentRes.data;
                setAvailablePaymentMethods(paymentMethods);
                // Optionally default to first saved payment method
                if (paymentMethods.length > 0) {
                    setSelectedPaymentMethodUid(paymentMethods[0].uid);
                    setIsAddingNewPaymentMethod(false);
                } else {
                    setSelectedPaymentMethodUid(null); // Force 'add new' if none saved
                    setIsAddingNewPaymentMethod(true);
                }

                const truckData: TruckDetails = truckRes.data;
                 // Map backend delivery_settings to flat structure
                 const mappedTruckData: TruckDetails = {
                    uid: truckData.uid,
                    name: truckData.name,
                    current_location_address: truckData.current_location_address,
                    location_latitude: truckData.location_latitude,
                    location_longitude: truckData.location_longitude,
                    delivery_enabled: truckData.delivery_settings?.enabled ?? false,
                    delivery_fee: truckData.delivery_settings?.fee ?? null,
                    delivery_minimum_order_value: truckData.delivery_settings?.minimum_order_value ?? null,
                    delivery_radius_km: truckData.delivery_settings?.radius_km ?? null,
                    average_preparation_minutes: truckData.average_preparation_minutes ?? 15,
                };
                setTruckDetails(mappedTruckData);

                 // Auto-select initial fulfillment type based on truck capability
                if (!mappedTruckData.delivery_enabled) {
                    setSelectedFulfillmentType('pickup');
                } else {
                    // Default to pickup or delivery? Let's default to pickup for now.
                    setSelectedFulfillmentType('pickup');
                }


            } catch (error: any) {
                console.error("Error initializing checkout:", error);
                const errorMsg = error.response?.data?.error || 'Failed to load checkout data. Please try again.';
                setPaymentError(errorMsg);
                dispatch(add_notification({ type: 'error', message: errorMsg }));
                // Potentially disable checkout form if essential data failed
            } finally {
                setIsLoading(false);
            }
        };

        initializeCheckout();
    }, [dispatch, navigate, food_truck_uid_from_cart, cart_items.length]);

     // Effect to trigger address validation when relevant state changes
    useEffect(() => {
        if (selectedFulfillmentType === 'delivery') {
            // Delay validation slightly if user is typing a new address
            const timer = setTimeout(() => {
                validateDeliveryAddress();
            }, isAddingNewAddress ? 500 : 0); // Validate immediately if selecting saved, delay if typing new
             return () => clearTimeout(timer);
        } else {
            // Reset validation if switching away from delivery
            setDeliveryAddressValidationStatus('idle');
            setDeliveryAddressValidationError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFulfillmentType, selectedAddressUid, isAddingNewAddress, newAddressInput, truckDetails]); // Rerun when these change


    // --- Action Handlers ---

    const handleFulfillmentChange = (type: 'pickup' | 'delivery') => {
        setSelectedFulfillmentType(type);
    };

    const handleAddressSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        if (value === 'add_new') {
            setIsAddingNewAddress(true);
            setSelectedAddressUid(null);
            setDeliveryAddressValidationStatus('idle'); // Reset validation
            setDeliveryAddressValidationError(null);
        } else {
            setIsAddingNewAddress(false);
            setSelectedAddressUid(value);
            // Validation will be triggered by useEffect
        }
    };

    const handleNewAddressInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        setNewAddressInput(prev => ({ ...prev, [name]: value }));
        // Validation will be triggered by useEffect after a short delay
    };

    const validateDeliveryAddress = async () => {
        if (selectedFulfillmentType !== 'delivery' || !truckDetails) return;

        let addressToValidate: Partial<Address> | null = null;
        let addressString = "";

        if (isAddingNewAddress) {
            // Basic check if essential fields are filled before attempting validation
            if (!newAddressInput.street_address || !newAddressInput.city || !newAddressInput.state || !newAddressInput.zip_code) {
                setDeliveryAddressValidationStatus('idle'); // Not enough info yet
                return;
            }
            addressToValidate = newAddressInput;
            addressString = `${newAddressInput.street_address}, ${newAddressInput.city}, ${newAddressInput.state} ${newAddressInput.zip_code}`;
        } else if (selectedAddressUid) {
            addressToValidate = availableAddresses.find(addr => addr.uid === selectedAddressUid) || null;
            if (addressToValidate) {
                addressString = `${addressToValidate.street_address}, ${addressToValidate.city}, ${addressToValidate.state} ${addressToValidate.zip_code}`;
            }
        }

        if (!addressToValidate || !addressString) {
            setDeliveryAddressValidationStatus('idle');
            return;
        }

        if (truckDetails.location_latitude == null || truckDetails.location_longitude == null || truckDetails.delivery_radius_km == null) {
            setDeliveryAddressValidationStatus('error');
            setDeliveryAddressValidationError("Truck location or delivery radius is not configured.");
            return;
        }

        setDeliveryAddressValidationStatus('pending');
        setDeliveryAddressValidationError(null);

        try {
            // Use cached coords if available, otherwise geocode
            let coords = { latitude: addressToValidate.latitude, longitude: addressToValidate.longitude };
            if (coords.latitude == null || coords.longitude == null) {
                 coords = await geocode_address(addressString);
            }

            if (coords.latitude == null || coords.longitude == null) {
                 throw new Error("Could not determine coordinates for the address.");
            }

            const distance = calculate_distance_km(
                truckDetails.location_latitude,
                truckDetails.location_longitude,
                coords.latitude,
                coords.longitude
            );

            if (!isFinite(distance) || distance > truckDetails.delivery_radius_km) {
                setDeliveryAddressValidationStatus('invalid_zone');
                setDeliveryAddressValidationError(`Address is approx. ${distance.toFixed(1)}km away, outside the ${truckDetails.delivery_radius_km}km delivery radius.`);
            } else {
                setDeliveryAddressValidationStatus('valid');
                setDeliveryAddressValidationError(null);
            }
        } catch (error: any) {
            console.error("Delivery address validation error:", error);
            setDeliveryAddressValidationStatus('error');
            setDeliveryAddressValidationError(error.message || "Could not validate delivery address.");
        }
    };


    const handlePaymentMethodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
         const value = event.target.value;
         if (value === 'add_new') {
             setSelectedPaymentMethodUid(null);
             setIsAddingNewPaymentMethod(true);
         } else {
             setSelectedPaymentMethodUid(value);
             setIsAddingNewPaymentMethod(false);
         }
         setPaymentError(null); // Clear error on change
     };


    const handlePlaceOrder = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements || isPlacingOrder || isLoading) {
            return; // Stripe.js has not loaded yet or already processing
        }

        setIsPlacingOrder(true);
        setPaymentError(null);

        // --- Pre-Submission Validation ---
        if (!selectedFulfillmentType) {
             setPaymentError("Please select Pickup or Delivery."); setIsPlacingOrder(false); return;
        }
        if (selectedFulfillmentType === 'delivery') {
            if (deliveryAddressValidationStatus !== 'valid') {
                 setPaymentError(deliveryAddressValidationError || "Please select or enter a valid delivery address within the zone."); setIsPlacingOrder(false); return;
            }
            if (truckDetails?.delivery_minimum_order_value && cartSubtotal < truckDetails.delivery_minimum_order_value) {
                 setPaymentError(`Order subtotal ($${cartSubtotal.toFixed(2)}) is below the minimum of $${truckDetails.delivery_minimum_order_value.toFixed(2)} for delivery.`); setIsPlacingOrder(false); return;
            }
        }
        if (!selectedPaymentMethodUid && !isAddingNewPaymentMethod) {
             setPaymentError("Please select a payment method or add a new card."); setIsPlacingOrder(false); return;
        }

        let payment_method_payload: any = {};

        // --- Get Payment Method Token if adding new ---
        if (isAddingNewPaymentMethod) {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) {
                setPaymentError("Card details component not loaded correctly."); setIsPlacingOrder(false); return;
            }
            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (error || !paymentMethod) {
                setPaymentError(error?.message || "Failed to process card details. Please check your input.");
                setIsPlacingOrder(false);
                return;
            }
            payment_method_payload = {
                payment_method_token: paymentMethod.id, // This is the pm_... token
                save_method: shouldSavePaymentMethod
            };
        } else {
            payment_method_payload = {
                payment_method_uid: selectedPaymentMethodUid
            };
        }

        // --- Construct Order Payload ---
        const order_items_payload = cart_items.map(item => ({
            menu_item_uid: item.menu_item_uid,
            quantity: item.quantity,
            special_instructions: item.special_instructions,
            selected_options: item.selected_options.map(opt => opt.option_uid)
        }));

        let delivery_address_payload = null;
        if (selectedFulfillmentType === 'delivery') {
            if (isAddingNewAddress) {
                delivery_address_payload = newAddressInput;
            } else {
                delivery_address_payload = { address_uid: selectedAddressUid };
            }
        }

        const order_payload = {
            food_truck_uid: food_truck_uid_from_cart,
            fulfillment_type: selectedFulfillmentType,
            delivery_address: delivery_address_payload,
            payment_method: payment_method_payload,
            items: order_items_payload
        };

        // --- API Call ---
        try {
            const response = await api_client.post('/orders', order_payload);
            const order_confirmation = response.data; // { order_uid, order_number, ... }

            dispatch(clear_cart());
            dispatch(add_notification({ type: 'success', message: `Order #${order_confirmation.order_number} placed successfully!` }));
            navigate(`/orders/confirmation/${order_confirmation.order_uid}`);

        } catch (error: any) {
            console.error("Error placing order:", error);
            const errorMsg = error.response?.data?.error || 'Failed to place order. Please try again.';
            setPaymentError(errorMsg);
            dispatch(add_notification({ type: 'error', message: errorMsg }));
            setIsPlacingOrder(false); // Allow retry
        }
        // No finally block for isLoading, handled in success/error paths
    };

     // Estimated Times Calculation
    const estimatedReadyTime = useMemo(() => {
        if (!truckDetails || selectedFulfillmentType !== 'pickup') return null;
        const prepTimeMs = (truckDetails.average_preparation_minutes || 15) * 60 * 1000;
        return new Date(Date.now() + prepTimeMs);
    }, [truckDetails, selectedFulfillmentType]);

    const estimatedDeliveryTime = useMemo(() => {
        if (!truckDetails || selectedFulfillmentType !== 'delivery') return null;
        const prepTimeMs = (truckDetails.average_preparation_minutes || 15) * 60 * 1000;
        const bufferMs = DELIVERY_BUFFER_MINUTES * 60 * 1000;
        return new Date(Date.now() + prepTimeMs + bufferMs);
    }, [truckDetails, selectedFulfillmentType]);


    // Render Guard for initial loading or invalid state
    if (isLoading) {
         return (
             <div className="flex justify-center items-center min-h-[60vh]">
                 <FaSpinner className="animate-spin text-4xl text-blue-500" />
                 <span className="ml-3 text-lg text-gray-600">Loading Checkout...</span>
             </div>
         );
    }

    if (!truckDetails || cart_items.length === 0) {
         return (
            <div className="container mx-auto px-4 py-8 text-center">
                 <h1 className="text-2xl font-semibold text-red-600 mb-4">Checkout Error</h1>
                 <p className="text-gray-700 mb-4">{paymentError || "Your cart is empty or the truck details could not be loaded."}</p>
                 <Link to="/" className="text-blue-600 hover:underline">Return to Discovery</Link>
             </div>
         );
    }


    // --- Main Render ---
    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Checkout</h1>
                <p className="text-lg mb-8 text-gray-600">Order from: <span className='font-semibold'>{truckDetails.name}</span></p>

                <form onSubmit={handlePlaceOrder} className="space-y-8">

                    {/* Section 1: Fulfillment Method & Info */}
                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-700">1. Fulfillment Method</h2>
                        <div className="flex space-x-4 mb-4">
                            <label className={`flex items-center p-3 border rounded-md cursor-pointer ${selectedFulfillmentType === 'pickup' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                <input
                                    type="radio"
                                    name="fulfillment_type"
                                    value="pickup"
                                    checked={selectedFulfillmentType === 'pickup'}
                                    onChange={() => handleFulfillmentChange('pickup')}
                                    className="mr-2"
                                />
                                Pickup
                            </label>
                            {truckDetails.delivery_enabled && (
                                <label className={`flex items-center p-3 border rounded-md cursor-pointer ${selectedFulfillmentType === 'delivery' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="fulfillment_type"
                                        value="delivery"
                                        checked={selectedFulfillmentType === 'delivery'}
                                        onChange={() => handleFulfillmentChange('delivery')}
                                        className="mr-2"
                                        disabled={!truckDetails.delivery_enabled}
                                    />
                                    Delivery
                                </label>
                            )}
                             {!truckDetails.delivery_enabled && (
                                 <span className="text-sm text-gray-500 self-center ml-4">(Delivery not available for this truck)</span>
                             )}
                        </div>

                        {/* Pickup Details */}
                        {selectedFulfillmentType === 'pickup' && (
                            <div className="bg-gray-100 p-4 rounded">
                                <p className="font-medium text-gray-800">Pickup Location:</p>
                                <p className="text-gray-600 flex items-center">
                                     <FaMapMarkerAlt className="mr-2 text-gray-500" />
                                     {truckDetails.current_location_address || 'Location not specified'}
                                </p>
                                {estimatedReadyTime && (
                                     <p className="text-sm text-gray-600 mt-1">Estimated Ready: {estimatedReadyTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                                )}
                            </div>
                        )}

                        {/* Delivery Details */}
                        {selectedFulfillmentType === 'delivery' && (
                            <div className="space-y-4">
                                <label htmlFor="address_select" className="block text-sm font-medium text-gray-700">Delivery Address:</label>
                                <div className="flex items-center space-x-2">
                                    <select
                                        id="address_select"
                                        value={isAddingNewAddress ? 'add_new' : selectedAddressUid || ''}
                                        onChange={handleAddressSelectionChange}
                                        className="flex-grow block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2"
                                        disabled={availableAddresses.length === 0 && !isAddingNewAddress}
                                    >
                                        <option value="" disabled={selectedAddressUid !== null || isAddingNewAddress}>-- Select Address --</option>
                                        {availableAddresses.map(addr => (
                                            <option key={addr.uid} value={addr.uid}>
                                                {addr.nickname} - {addr.street_address}, {addr.city}
                                            </option>
                                        ))}
                                        <option value="add_new">Add New Address...</option>
                                    </select>
                                </div>

                                {/* New Address Form */}
                                {isAddingNewAddress && (
                                    <div className="border p-4 rounded-md bg-gray-50 space-y-3">
                                        <h3 className="text-md font-medium text-gray-700">Enter New Address</h3>
                                         <div>
                                             <label htmlFor="nickname" className="block text-sm font-medium text-gray-600">Nickname (e.g., Home, Work)</label>
                                             <input type="text" name="nickname" id="nickname" value={newAddressInput.nickname} onChange={handleNewAddressInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                         </div>
                                        <div>
                                            <label htmlFor="street_address" className="block text-sm font-medium text-gray-600">Street Address</label>
                                            <input type="text" name="street_address" id="street_address" value={newAddressInput.street_address} onChange={handleNewAddressInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                        </div>
                                        <div>
                                            <label htmlFor="apt_suite" className="block text-sm font-medium text-gray-600">Apt/Suite (Optional)</label>
                                            <input type="text" name="apt_suite" id="apt_suite" value={newAddressInput.apt_suite || ''} onChange={handleNewAddressInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label htmlFor="city" className="block text-sm font-medium text-gray-600">City</label>
                                                <input type="text" name="city" id="city" value={newAddressInput.city} onChange={handleNewAddressInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                            </div>
                                            <div>
                                                <label htmlFor="state" className="block text-sm font-medium text-gray-600">State</label>
                                                <input type="text" name="state" id="state" value={newAddressInput.state} onChange={handleNewAddressInputChange} required maxLength={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                            </div>
                                            <div>
                                                <label htmlFor="zip_code" className="block text-sm font-medium text-gray-600">Zip Code</label>
                                                <input type="text" name="zip_code" id="zip_code" value={newAddressInput.zip_code} onChange={handleNewAddressInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" />
                                            </div>
                                        </div>
                                        {/* Button to confirm/use this address might be useful, or rely on blur/effect */}
                                    </div>
                                )}

                                {/* Delivery Validation Status */}
                                <div className="mt-2 min-h-[20px]"> {/* Reserve space */}
                                     {deliveryAddressValidationStatus === 'pending' && (
                                         <p className="text-sm text-blue-600 flex items-center"><FaSpinner className="animate-spin mr-1" /> Validating address...</p>
                                     )}
                                     {deliveryAddressValidationStatus === 'valid' && (
                                         <p className="text-sm text-green-600 flex items-center"><FaCheckCircle className="mr-1" /> Address is within delivery zone.</p>
                                     )}
                                     {deliveryAddressValidationStatus === 'invalid_zone' && (
                                         <p className="text-sm text-red-600 flex items-center"><FaTimesCircle className="mr-1" /> {deliveryAddressValidationError}</p>
                                     )}
                                     {deliveryAddressValidationStatus === 'error' && (
                                         <p className="text-sm text-red-600 flex items-center"><FaExclamationCircle className="mr-1" /> {deliveryAddressValidationError}</p>
                                     )}
                                </div>

                                {/* Delivery Fee & Time */}
                                <div className="bg-gray-100 p-4 rounded mt-4">
                                    <p className="text-gray-600">Delivery Fee: <span className="font-medium">${deliveryFee.toFixed(2)}</span></p>
                                     {estimatedDeliveryTime && (
                                         <p className="text-sm text-gray-600 mt-1">Estimated Delivery: {estimatedDeliveryTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                                     )}
                                     {truckDetails.delivery_minimum_order_value && truckDetails.delivery_minimum_order_value > 0 && (
                                         <p className="text-sm text-gray-500 mt-1">(Minimum order for delivery: ${truckDetails.delivery_minimum_order_value.toFixed(2)})</p>
                                     )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Section 2: Payment Method */}
                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-700">2. Payment Method</h2>
                        <div className="space-y-3">
                            {availablePaymentMethods.map(pm => (
                                <label key={pm.uid} className={`flex items-center p-3 border rounded-md cursor-pointer ${selectedPaymentMethodUid === pm.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value={pm.uid}
                                        checked={selectedPaymentMethodUid === pm.uid}
                                        onChange={handlePaymentMethodChange}
                                        className="mr-2"
                                    />
                                    <FaRegCreditCard className="mr-2 text-gray-600"/>
                                    {pm.card_type} ending in {pm.last_4_digits} (Exp: {String(pm.expiry_month).padStart(2, '0')}/{pm.expiry_year})
                                </label>
                            ))}
                             <label className={`flex items-center p-3 border rounded-md cursor-pointer ${isAddingNewPaymentMethod ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                 <input
                                     type="radio"
                                     name="payment_method"
                                     value="add_new"
                                     checked={isAddingNewPaymentMethod}
                                     onChange={handlePaymentMethodChange}
                                     className="mr-2"
                                 />
                                 <FaRegCreditCard className="mr-2 text-gray-600"/> Add New Card
                             </label>

                            {/* New Card Input (Stripe Elements) */}
                            {isAddingNewPaymentMethod && (
                                <div className="border p-4 rounded-md bg-gray-50 space-y-3">
                                    <label className="block text-sm font-medium text-gray-700">Card Details:</label>
                                    <div className="p-2 border border-gray-300 rounded-md bg-white">
                                        <CardElement options={card_element_options} />
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            id="save_payment_method"
                                            name="save_payment_method"
                                            type="checkbox"
                                            checked={shouldSavePaymentMethod}
                                            onChange={(e) => setShouldSavePaymentMethod(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <label htmlFor="save_payment_method" className="ml-2 block text-sm text-gray-900">
                                            Save this card for future orders
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Section 3: Order Summary */}
                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-700">3. Order Summary</h2>
                        <div className="space-y-2 mb-4">
                            {cartSummary.map((item, index) => (
                                <div key={index} className="flex justify-between items-start text-sm">
                                    <div>
                                        <p className="font-medium text-gray-800">{item.quantity} x {item.item_name_snapshot}</p>
                                        {item.customizations_summary && <p className="text-xs text-gray-500 pl-2">{item.customizations_summary}</p>}
                                    </div>
                                    <p className="text-gray-700">${item.total_item_price.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="border-t pt-4 space-y-1 text-right">
                             <p className="text-sm text-gray-600">Subtotal: <span className="font-medium">${cartSubtotal.toFixed(2)}</span></p>
                             <p className="text-sm text-gray-600">Est. Tax: <span className="font-medium">${estimatedTax.toFixed(2)}</span></p>
                             {selectedFulfillmentType === 'delivery' && (
                                 <p className="text-sm text-gray-600">Delivery Fee: <span className="font-medium">${deliveryFee.toFixed(2)}</span></p>
                             )}
                             <p className="text-lg font-semibold text-gray-800">Order Total: <span className="text-blue-600">${orderTotal.toFixed(2)}</span></p>
                        </div>
                    </section>

                    {/* Error Display Area */}
                    {paymentError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{paymentError}</span>
                        </div>
                    )}

                    {/* Place Order Button */}
                    <div className="text-center">
                        <button
                            type="submit"
                            disabled={isLoading || isPlacingOrder || (selectedFulfillmentType === 'delivery' && deliveryAddressValidationStatus !== 'valid')}
                            className="w-full md:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPlacingOrder ? (
                                <>
                                    <FaSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                    Placing Order...
                                </>
                            ) : (
                                `Place Order ($${orderTotal.toFixed(2)})`
                            )}
                        </button>
                         {selectedFulfillmentType === 'delivery' && deliveryAddressValidationStatus !== 'valid' && (
                             <p className="text-xs text-red-500 mt-2">Please resolve delivery address issues before placing order.</p>
                         )}
                          {selectedFulfillmentType === 'delivery' && truckDetails?.delivery_minimum_order_value && cartSubtotal < truckDetails.delivery_minimum_order_value && (
                             <p className="text-xs text-red-500 mt-2">Order subtotal is below the delivery minimum.</p>
                         )}
                    </div>
                </form>
            </div>
        </>
    );
};


// --- Wrapper Component with Stripe Elements Provider ---
// This ensures that `useStripe` and `useElements` can be called within UV_CustomerCheckout
const CheckoutWrapper: React.FC = () => {
    return (
        <Elements stripe={stripePromise}>
            <UV_CustomerCheckout />
        </Elements>
    );
};

export default CheckoutWrapper;
