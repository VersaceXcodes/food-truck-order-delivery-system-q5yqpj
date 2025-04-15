import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, logout, add_notification, api_client } from '@/store/main';
import { ArrowPathIcon, EnvelopeIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

/**
 * UV_OperatorEmailVerificationRequired
 *
 * A temporary interstitial page shown to newly registered operators after
 * signup or login, before they have verified their email address.
 */
const UV_OperatorEmailVerificationRequired: React.FC = () => {
    // --- State Variables ---

    // Get operator's email from global state
    const operator_email = useSelector((state: RootState) => state.auth.current_user?.email) || '';

    // Local state for managing the resend action
    const [resend_status, set_resend_status] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [resend_error_message, set_resend_error_message] = useState<string | null>(null);

    const dispatch = useDispatch();
    const navigate = useNavigate();

    // --- Actions ---

    /**
     * Handles the click event for the 'Resend Verification Email' button.
     * Calls the backend API to trigger sending the email again.
     */
    const handle_resend_verification = async () => {
        set_resend_status('loading');
        set_resend_error_message(null);
        try {
            // Call the hypothetical backend endpoint.
            // Assumes POST /auth/resend_verification exists and uses the auth token from the interceptor.
            // The base URL (http://localhost:1337) is configured in api_client.
            await api_client.post('/auth/resend_verification');

            set_resend_status('success');
            dispatch(add_notification({
                type: 'success',
                message: 'Verification email resent successfully. Please check your inbox.',
                duration: 5000, // Show notification for 5 seconds
            }));

            // Reset status after a short delay so the user sees the 'Email Resent!' state
            setTimeout(() => set_resend_status('idle'), 4000);

        } catch (error: any) {
            console.error("Error resending verification email:", error);
            // Extract error message from backend response or provide a default
            const error_message = error.response?.data?.error || error.message || 'Failed to resend verification email. Please try again later.';
            set_resend_status('error');
            set_resend_error_message(error_message);

            dispatch(add_notification({
                type: 'error',
                message: error_message,
                duration: 5000, // Show error notification for 5 seconds
            }));

            // Reset status after a delay
            setTimeout(() => set_resend_status('idle'), 5000);
        }
    };

    /**
     * Handles the click event for the 'Logout' button.
     * Dispatches the global logout action.
     */
    const handle_logout = () => {
        dispatch(logout());
        // The navigation redirection after logout (e.g., to /login) should be handled
        // by the main App component's routing logic based on the change in auth_status.
        // No explicit navigate('/login') needed here typically.
    };

    // --- Render Logic ---
    // Returns a single JSX structure.
    return (
        <>
            {/* Main container for centering content */}
            <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
                {/* Card container */}
                <div className="w-full max-w-md space-y-8">
                    <div className="bg-white p-8 shadow-lg rounded-lg text-center">

                        {/* Icon */}
                        <EnvelopeIcon className="mx-auto h-12 w-12 text-indigo-600" aria-hidden="true" />

                        {/* Title */}
                        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                            Verify Your Email Address
                        </h2>

                        {/* Explanatory Text */}
                        <p className="mt-4 text-center text-sm text-gray-600">
                            A verification email has been sent to:
                        </p>
                        <p className="mt-1 text-center text-sm font-medium text-indigo-600 break-words">
                            {operator_email}
                        </p>
                        <p className="mt-4 text-center text-sm text-gray-600">
                            Please check your inbox (and spam folder) and click the link inside to activate your account and access the operator dashboard.
                        </p>

                        {/* Resend Button Section */}
                        <div className="mt-8">
                            <button
                                type="button"
                                onClick={handle_resend_verification}
                                disabled={resend_status === 'loading'}
                                className={`group relative flex w-full justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ease-in-out ${
                                    resend_status === 'loading'
                                        ? 'bg-indigo-400 cursor-not-allowed'
                                        : resend_status === 'success'
                                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                                        : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                                }`}
                            >
                                {resend_status === 'loading' && (
                                    <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" aria-hidden="true" />
                                )}
                                {resend_status === 'success' ? 'Email Resent!' : 'Resend Verification Email'}
                            </button>
                            {/* Display error message if the resend failed */}
                            {resend_status === 'error' && resend_error_message && (
                                <p className="mt-2 text-center text-xs text-red-600">
                                    {resend_error_message}
                                </p>
                            )}
                        </div>

                        {/* Logout Button Section */}
                        <div className="mt-6 border-t pt-6">
                             <button
                                type="button"
                                onClick={handle_logout}
                                className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-150 ease-in-out"
                            >
                                <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2 text-gray-500 group-hover:text-gray-600" aria-hidden="true" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UV_OperatorEmailVerificationRequired;
