import React, { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch, add_notification, api_client } from '@/store/main';
// No Link import needed as there are no internal navigation links in this specific view's requirements.

// --- Type Definitions ---

interface OperatingHoursFormState {
    [day: string]: {
        open: string; // HH:MM format
        close: string; // HH:MM format
        closed: boolean;
    };
}

interface TruckSettingsData {
    uid: string;
    name: string;
    description: string | null;
    cuisine_type: string;
    logo_url: string | null;
    standard_operating_hours: { [day: string]: string } | null; // e.g., { Mon: "11:00-15:00", Tue: "closed", ... }
    location: {
        latitude: number | null;
        longitude: number | null;
        address: string | null;
    };
    delivery_settings: {
        enabled: boolean;
        fee: number | null;
        minimum_order_value: number | null;
        radius_km: number | null;
    };
    average_preparation_minutes: number;
    customer_support_phone_number: string | null;
}

interface FormInputs {
    name: string;
    description: string;
    cuisine_type: string;
    customer_support_phone_number: string;
    standard_operating_hours: OperatingHoursFormState;
    location_address: string;
    location_latitude: number | null; // Store fetched coords, not directly editable
    location_longitude: number | null; // Store fetched coords, not directly editable
    delivery_enabled: boolean;
    delivery_fee: string;
    delivery_minimum_order_value: string;
    delivery_radius_km: string;
    average_preparation_minutes: string;
}

// --- Initial State ---

const days_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const default_form_inputs: FormInputs = {
    name: "",
    description: "",
    cuisine_type: "",
    customer_support_phone_number: "",
    standard_operating_hours: days_of_week.reduce((acc, day) => {
        acc[day] = { open: "09:00", close: "17:00", closed: false };
        return acc;
    }, {} as OperatingHoursFormState),
    location_address: "",
    location_latitude: null,
    location_longitude: null,
    delivery_enabled: false,
    delivery_fee: "",
    delivery_minimum_order_value: "",
    delivery_radius_km: "",
    average_preparation_minutes: "15", // Default prep time
};

// --- Component ---

const UV_OperatorTruckSettings: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    // Token is injected via api_client interceptor, no need to select here unless debugging
    // const token = useSelector((state: RootState) => state.auth.auth_token);

    const [truck_settings_data, set_truck_settings_data] = useState<TruckSettingsData | null>(null);
    const [form_inputs, set_form_inputs] = useState<FormInputs>(default_form_inputs);
    const [logo_file_input, set_logo_file_input] = useState<File | null>(null);
    const [logo_preview_url, set_logo_preview_url] = useState<string | null>(null);
    const [is_loading, set_is_loading] = useState<boolean>(true);
    const [save_status, set_save_status] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error_message, set_error_message] = useState<string | null>(null);

    const file_input_ref = useRef<HTMLInputElement>(null);

    // --- Data Fetching ---
    const fetch_truck_settings = async () => {
        set_is_loading(true);
        set_error_message(null);
        try {
            const response = await api_client.get('/operators/me/truck');
            const data: TruckSettingsData = response.data;
            set_truck_settings_data(data);

            // Initialize form inputs from fetched data
            const initial_hours: OperatingHoursFormState = {};
            days_of_week.forEach(day => {
                const hours_string = data.standard_operating_hours?.[day];
                if (hours_string && hours_string.toLowerCase() === 'closed') {
                    initial_hours[day] = { open: "", close: "", closed: true };
                } else if (hours_string && hours_string.includes('-')) {
                    const [open_time, close_time] = hours_string.split('-');
                    initial_hours[day] = { open: open_time || "", close: close_time || "", closed: false };
                } else {
                    // Default to closed if format is unexpected or missing
                    initial_hours[day] = { open: "09:00", close: "17:00", closed: true };
                }
            });

            set_form_inputs({
                name: data.name || "",
                description: data.description || "",
                cuisine_type: data.cuisine_type || "",
                customer_support_phone_number: data.customer_support_phone_number || "",
                standard_operating_hours: initial_hours,
                location_address: data.location?.address || "",
                location_latitude: data.location?.latitude || null,
                location_longitude: data.location?.longitude || null,
                delivery_enabled: data.delivery_settings?.enabled || false,
                delivery_fee: data.delivery_settings?.fee?.toString() || "",
                delivery_minimum_order_value: data.delivery_settings?.minimum_order_value?.toString() || "",
                delivery_radius_km: data.delivery_settings?.radius_km?.toString() || "",
                average_preparation_minutes: data.average_preparation_minutes?.toString() || "15",
            });
            set_logo_preview_url(data.logo_url); // Set initial preview from fetched URL

        } catch (error: any) {
            console.error("Error fetching truck settings:", error);
            const message = error.response?.data?.error || error.message || 'Failed to load truck settings.';
            set_error_message(message);
            dispatch(add_notification({ type: 'error', message }));
        } finally {
            set_is_loading(false);
        }
    };

    useEffect(() => {
        fetch_truck_settings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // --- Logo Preview URL Cleanup ---
    useEffect(() => {
        let object_url_to_revoke: string | null = null;
        if (logo_preview_url && logo_preview_url.startsWith('blob:')) {
             object_url_to_revoke = logo_preview_url;
        }

        return () => {
            if (object_url_to_revoke) {
                URL.revokeObjectURL(object_url_to_revoke);
                // console.log("Revoked Object URL:", object_url_to_revoke);
            }
        };
    }, [logo_preview_url]);


    // --- Input Handlers ---
    const handle_form_input_change = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (name.startsWith('hours-')) {
            const [_, day, field] = name.split('-');
            const is_checkbox = type === 'checkbox';
            const checked_value = is_checkbox ? (e.target as HTMLInputElement).checked : undefined;

            set_form_inputs(prev => ({
                ...prev,
                standard_operating_hours: {
                    ...prev.standard_operating_hours,
                    [day]: {
                        ...prev.standard_operating_hours[day],
                        [field]: is_checkbox ? checked_value : value,
                    },
                },
            }));
        } else if (type === 'checkbox') {
             const checked = (e.target as HTMLInputElement).checked;
             set_form_inputs(prev => ({
                 ...prev,
                 [name]: checked,
                 // Clear related delivery fields if disabling delivery
                 ...(name === 'delivery_enabled' && !checked && {
                     delivery_fee: "",
                     delivery_minimum_order_value: "",
                     delivery_radius_km: "",
                 }),
             }));
        } else {
            set_form_inputs(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handle_logo_file_change = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            set_logo_file_input(file);
            const preview_url = URL.createObjectURL(file);
            // Revoke previous blob URL if it exists and is a blob URL
            if (logo_preview_url && logo_preview_url.startsWith('blob:')) {
                URL.revokeObjectURL(logo_preview_url);
            }
            set_logo_preview_url(preview_url);
        } else {
            set_logo_file_input(null);
             // Revoke previous blob URL if it exists and is a blob URL
            if (logo_preview_url && logo_preview_url.startsWith('blob:')) {
                URL.revokeObjectURL(logo_preview_url);
            }
            // Reset preview to original fetched URL if file is removed
            set_logo_preview_url(truck_settings_data?.logo_url || null);
        }
    };

    // --- Save Settings ---
    const save_settings = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        set_save_status('loading');
        set_error_message(null);

        let success = true;
        let final_error_message = null;

        try {
            // --- 1. Update Truck Profile (PUT /operators/me/truck) ---
            const profile_data_to_send: any = {
                name: form_inputs.name,
                description: form_inputs.description || null, // Ensure null if empty
                cuisine_type: form_inputs.cuisine_type,
                customer_support_phone_number: form_inputs.customer_support_phone_number || null,
            };

            let put_truck_promise;
            if (logo_file_input) {
                const form_data = new FormData();
                form_data.append('logo', logo_file_input);
                Object.entries(profile_data_to_send).forEach(([key, value]) => {
                     if (value !== null && value !== undefined && value !== '') {
                        form_data.append(key, value as string);
                     }
                });
                 put_truck_promise = api_client.put('/operators/me/truck', form_data, {
                     headers: { 'Content-Type': 'multipart/form-data' }
                 });
            } else {
                // If no new logo, just send JSON
                 put_truck_promise = api_client.put('/operators/me/truck', profile_data_to_send);
            }
            await put_truck_promise;
            console.log("Truck profile updated.");

             // --- 2. Update Operating Hours (PUT /operators/me/truck/operating_hours) ---
            const hours_payload: { [day: string]: string } = {};
            let hours_valid = true;
            days_of_week.forEach(day => {
                const day_hours = form_inputs.standard_operating_hours[day];
                if (day_hours.closed) {
                    hours_payload[day] = 'closed';
                } else if (day_hours.open && day_hours.close) {
                    // Basic validation: close time should be after open time (simple string compare works for HH:MM)
                    if (day_hours.close <= day_hours.open) {
                         hours_valid = false;
                         final_error_message = `Invalid hours for ${day}: Closing time must be after opening time.`;
                    }
                    hours_payload[day] = `${day_hours.open}-${day_hours.close}`;
                } else {
                    // If not closed and times are incomplete, consider it invalid or default to closed
                     hours_valid = false;
                     final_error_message = `Incomplete hours for ${day}. Please set both open/close times or mark as closed.`;
                    // hours_payload[day] = 'closed'; // Or throw error
                }
            });
            if (!hours_valid) throw new Error(final_error_message || "Invalid operating hours configuration.");
            await api_client.put('/operators/me/truck/operating_hours', hours_payload);
            console.log("Operating hours updated.");

            // --- 3. Update Location (PUT /operators/me/truck/location) ---
            if (!form_inputs.location_address) {
                 throw new Error('Location address cannot be empty.');
            }
            const location_payload = { address: form_inputs.location_address };
            await api_client.put('/operators/me/truck/location', location_payload);
            console.log("Location updated.");

            // --- 4. Update Delivery Settings (PUT /operators/me/truck/delivery_settings) ---
            const delivery_enabled = form_inputs.delivery_enabled;
            const delivery_fee_val = delivery_enabled ? parseFloat(form_inputs.delivery_fee) : null;
            const delivery_min_val = delivery_enabled ? parseFloat(form_inputs.delivery_minimum_order_value) : null;
            const delivery_radius_val = delivery_enabled ? parseFloat(form_inputs.delivery_radius_km) : null;

            if (delivery_enabled && (isNaN(delivery_fee_val!) || delivery_fee_val! < 0 || isNaN(delivery_min_val!) || delivery_min_val! < 0 || isNaN(delivery_radius_val!) || delivery_radius_val! <= 0)) {
                throw new Error('Invalid delivery settings. Fee and minimum order must be 0 or more. Radius must be greater than 0.');
            }
            const delivery_payload = {
                enabled: delivery_enabled,
                fee: delivery_fee_val,
                minimum_order_value: delivery_min_val,
                radius_km: delivery_radius_val,
            };
            await api_client.put('/operators/me/truck/delivery_settings', delivery_payload);
            console.log("Delivery settings updated.");

            // --- 5. Update Preparation Time (PUT /operators/me/truck/preparation_time) ---
            const prep_minutes_val = parseInt(form_inputs.average_preparation_minutes, 10);
            if (isNaN(prep_minutes_val) || prep_minutes_val <= 0) {
                throw new Error('Average preparation time must be a positive whole number.');
            }
            await api_client.put('/operators/me/truck/preparation_time', { minutes: prep_minutes_val });
            console.log("Preparation time updated.");

        } catch (error: any) {
            success = false;
            console.error("Error saving settings:", error);
            final_error_message = error.response?.data?.error || error.message || 'Failed to save settings.';
            set_error_message(final_error_message);
            // Notification already dispatched if it's a validation error from above
            if (!final_error_message.includes('Invalid') && !final_error_message.includes('cannot be empty')) {
                 dispatch(add_notification({ type: 'error', message: final_error_message }));
            }
        } finally {
            set_save_status(success ? 'success' : 'error');
            if (success) {
                dispatch(add_notification({ type: 'success', message: 'Truck settings saved successfully!' }));
                // Refetch data to confirm changes and get potentially updated logo URL or coords
                await fetch_truck_settings(); // await to ensure data is fresh before resetting status
                 // Clear the file input state only after successful save and refetch
                set_logo_file_input(null);
                if (file_input_ref.current) {
                    file_input_ref.current.value = ""; // Clear the file input visually
                }
            }
             // Reset status after a delay (even if fetch happens)
            setTimeout(() => set_save_status('idle'), 3000);
        }
    };


    // --- Render Logic ---
    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Truck Profile & Settings</h1>

                {is_loading && (
                    <div className="text-center py-10">
                         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                        <p className="text-lg text-gray-600 mt-4">Loading settings...</p>
                    </div>
                )}

                {error_message && !is_loading && !save_status.includes('error') && ( // Show fetch error if not currently showing save error
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error_message}</span>
                    </div>
                )}

                {!is_loading && truck_settings_data && (
                    <form onSubmit={save_settings} className="space-y-8">

                        {/* --- Section: Truck Profile --- */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Truck Profile</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Column */}
                                <div className="space-y-4 md:col-span-2">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Food Truck Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={form_inputs.name}
                                            onChange={handle_form_input_change}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="cuisine_type" className="block text-sm font-medium text-gray-700 mb-1">Cuisine Type <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            id="cuisine_type"
                                            name="cuisine_type"
                                            value={form_inputs.cuisine_type}
                                            onChange={handle_form_input_change}
                                            placeholder="e.g., Tacos, Pizza, Burgers"
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            id="description"
                                            name="description"
                                            rows={4}
                                            value={form_inputs.description}
                                            onChange={handle_form_input_change}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="Tell customers about your truck..."
                                        />
                                    </div>
                                     <div>
                                        <label htmlFor="customer_support_phone_number" className="block text-sm font-medium text-gray-700 mb-1">Customer Support Phone (Optional)</label>
                                        <input
                                            type="tel"
                                            id="customer_support_phone_number"
                                            name="customer_support_phone_number"
                                            value={form_inputs.customer_support_phone_number}
                                            onChange={handle_form_input_change}
                                            placeholder="e.g., 555-123-4567"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                         <p className="mt-1 text-xs text-gray-500">Shown to customers with active orders for urgent issues.</p>
                                    </div>
                                </div>
                                {/* Right Column (Logo) */}
                                <div className="space-y-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Truck Logo/Photo</label>
                                    <div className="mt-1 flex flex-col items-center space-y-4">
                                        <div className="h-32 w-32 rounded-md overflow-hidden bg-gray-100 border border-gray-300 flex items-center justify-center">
                                            {logo_preview_url ? (
                                                <img src={logo_preview_url} alt="Logo Preview" className="h-full w-full object-cover" />
                                            ) : (
                                                <svg className="h-16 w-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            id="logo_file_input"
                                            name="logo_file_input"
                                            ref={file_input_ref}
                                            onChange={handle_logo_file_change}
                                            accept="image/jpeg,image/png,image/gif"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => file_input_ref.current?.click()}
                                            className="w-full bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            {logo_preview_url ? 'Change Logo' : 'Upload Logo'}
                                        </button>
                                    </div>
                                     <p className="text-xs text-gray-500 text-center">JPG, PNG, GIF up to 5MB.</p>
                                </div>
                            </div>
                        </div>

                        {/* --- Section: Standard Operating Hours --- */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Standard Operating Hours</h2>
                            <p className="text-sm text-gray-500 mb-4">Set typical weekly hours. Use dashboard toggle for actual online/offline status.</p>
                            <div className="space-y-3">
                                {days_of_week.map(day => (
                                    <div key={day} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center border-t pt-3 first:border-t-0 first:pt-0">
                                        <label className="text-sm font-medium text-gray-700 sm:col-span-1">{day}</label>
                                        <div className="flex items-center space-x-2 sm:col-span-2">
                                            <input
                                                type="time"
                                                name={`hours-${day}-open`}
                                                value={form_inputs.standard_operating_hours[day]?.open || ''}
                                                onChange={handle_form_input_change}
                                                disabled={form_inputs.standard_operating_hours[day]?.closed}
                                                className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <span className="text-gray-500">to</span>
                                            <input
                                                type="time"
                                                name={`hours-${day}-close`}
                                                value={form_inputs.standard_operating_hours[day]?.close || ''}
                                                onChange={handle_form_input_change}
                                                disabled={form_inputs.standard_operating_hours[day]?.closed}
                                                className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex items-center justify-start sm:justify-end sm:col-span-1">
                                            <input
                                                type="checkbox"
                                                id={`hours-${day}-closed`}
                                                name={`hours-${day}-closed`}
                                                checked={form_inputs.standard_operating_hours[day]?.closed || false}
                                                onChange={handle_form_input_change}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <label htmlFor={`hours-${day}-closed`} className="ml-2 block text-sm text-gray-900">
                                                Closed
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* --- Section: Location Management --- */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Current Location</h2>
                            <p className="text-sm text-gray-500 mb-4">Set your truck's current operational address. Backend will verify and get coordinates.</p>
                             <div>
                                <label htmlFor="location_address" className="block text-sm font-medium text-gray-700 mb-1">Street Address <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    id="location_address"
                                    name="location_address"
                                    value={form_inputs.location_address}
                                    onChange={handle_form_input_change}
                                    placeholder="e.g., 123 Main St, Los Angeles, CA 90012"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                {(form_inputs.location_latitude && form_inputs.location_longitude) && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        Current Coordinates (approx.): {form_inputs.location_latitude.toFixed(4)}, {form_inputs.location_longitude.toFixed(4)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* --- Section: Delivery Settings --- */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Delivery Settings</h2>
                             <div className="flex items-center mb-4">
                                <input
                                    type="checkbox"
                                    id="delivery_enabled"
                                    name="delivery_enabled"
                                    checked={form_inputs.delivery_enabled}
                                    onChange={handle_form_input_change}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="delivery_enabled" className="ml-2 block text-sm font-medium text-gray-900">
                                    Offer Delivery
                                </label>
                            </div>

                            {form_inputs.delivery_enabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-4">
                                    <div>
                                        <label htmlFor="delivery_fee" className="block text-sm font-medium text-gray-700 mb-1">Delivery Fee ($) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            id="delivery_fee"
                                            name="delivery_fee"
                                            value={form_inputs.delivery_fee}
                                            onChange={handle_form_input_change}
                                            min="0"
                                            step="0.01"
                                            required={form_inputs.delivery_enabled}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="e.g., 3.00"
                                        />
                                    </div>
                                     <div>
                                        <label htmlFor="delivery_minimum_order_value" className="block text-sm font-medium text-gray-700 mb-1">Min Order ($) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            id="delivery_minimum_order_value"
                                            name="delivery_minimum_order_value"
                                            value={form_inputs.delivery_minimum_order_value}
                                            onChange={handle_form_input_change}
                                            min="0"
                                            step="0.01"
                                            required={form_inputs.delivery_enabled}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="e.g., 15.00"
                                        />
                                    </div>
                                     <div>
                                        <label htmlFor="delivery_radius_km" className="block text-sm font-medium text-gray-700 mb-1">Radius (km) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            id="delivery_radius_km"
                                            name="delivery_radius_km"
                                            value={form_inputs.delivery_radius_km}
                                            onChange={handle_form_input_change}
                                            min="0.1"
                                            step="0.1"
                                            required={form_inputs.delivery_enabled}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="e.g., 5.0"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- Section: Preparation Time --- */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Preparation Time</h2>
                             <div>
                                <label htmlFor="average_preparation_minutes" className="block text-sm font-medium text-gray-700 mb-1">Avg. Prep Time (minutes) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    id="average_preparation_minutes"
                                    name="average_preparation_minutes"
                                    value={form_inputs.average_preparation_minutes}
                                    onChange={handle_form_input_change}
                                    min="1"
                                    step="1"
                                    required
                                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="e.g., 15"
                                />
                                 <p className="mt-1 text-xs text-gray-500">Used for customer estimates.</p>
                            </div>
                        </div>

                        {/* --- Save Button --- */}
                        <div className="pt-5 sticky bottom-0 bg-gray-50 py-4 border-t border-gray-200">
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={save_status === 'loading' || is_loading}
                                    className={`inline-flex justify-center items-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out ${
                                        save_status === 'loading'
                                            ? 'bg-gray-400 cursor-not-allowed'
                                        : save_status === 'success'
                                            ? 'bg-green-600 hover:bg-green-700'
                                        : save_status === 'error'
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                     {save_status === 'loading' && (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                     )}
                                    {save_status === 'loading' ? 'Saving...' : save_status === 'success' ? 'Saved!' : save_status === 'error' ? 'Save Failed' : 'Save All Settings'}
                                </button>
                            </div>
                            {save_status === 'error' && error_message && (
                                 <p className="text-sm text-red-600 mt-2 text-right">{error_message}</p>
                            )}
                        </div>

                    </form>
                )}
            </div>
        </>
    );
};

export default UV_OperatorTruckSettings;