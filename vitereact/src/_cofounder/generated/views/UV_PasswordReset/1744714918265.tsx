import React, { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// Define the base URL for the backend API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:1337';

const UV_PasswordReset: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [reset_token, set_reset_token] = useState<string>('');
    const [form_input_new_password, set_form_input_new_password] = useState<string>('');
    const [form_input_confirm_password, set_form_input_confirm_password] = useState<string>('');
    const [show_new_password, set_show_new_password] = useState<boolean>(false);
    const [show_confirm_password, set_show_confirm_password] = useState<boolean>(false);

    const [reset_error, set_reset_error] = useState<string | null>(null);
    const [reset_success_message, set_reset_success_message] = useState<string | null>(null);
    const [is_loading, set_is_loading] = useState<boolean>(false);

    useEffect(() => {
        const token_from_url = searchParams.get('token');
        if (token_from_url) {
            set_reset_token(token_from_url);
            set_reset_error(null); // Clear potential previous errors if token is found
        } else {
            set_reset_error('Password reset token not found in URL. Please check the link or request a new reset.');
        }
    }, [searchParams]);

    const submit_reset_password = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        set_reset_error(null);
        set_reset_success_message(null);

        // Client-side validation
        if (!reset_token) {
            set_reset_error('Password reset token is missing.');
            return;
        }
        if (!form_input_new_password || !form_input_confirm_password) {
            set_reset_error('Please enter and confirm your new password.');
            return;
        }
        if (form_input_new_password.length < 6) {
            set_reset_error('Password must be at least 6 characters long.');
            return;
        }
        if (form_input_new_password !== form_input_confirm_password) {
            set_reset_error('Passwords do not match.');
            return;
        }

        set_is_loading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/reset_password`, {
                token: reset_token,
                new_password: form_input_new_password,
            });

            if (response.status === 200) {
                set_reset_success_message(response.data.message || 'Password reset successfully. Redirecting to login...');
                set_form_input_new_password('');
                set_form_input_confirm_password('');
                // Redirect to login after a short delay
                setTimeout(() => {
                    navigate('/login');
                }, 3000); // 3-second delay
            } else {
                 // Should not happen with axios default behavior, but handle defensively
                set_reset_error(response.data.error || 'An unexpected error occurred.');
            }
        } catch (error: any) {
            console.error('Password reset failed:', error);
            if (axios.isAxiosError(error) && error.response) {
                // Get error message from backend response
                set_reset_error(error.response.data?.error || 'Password reset failed. Please check the token or try again.');
            } else {
                // Network or other non-Axios errors
                set_reset_error('Password reset failed. Please check your connection or try again.');
            }
        } finally {
            set_is_loading(false);
        }
    };

    return (
        <>
            <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 bg-white p-8 shadow-lg rounded-lg">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Set Your New Password
                        </h2>
                    </div>

                    {/* Error/Success Messages */}
                    {reset_error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <span className="block sm:inline">{reset_error}</span>
                        </div>
                    )}
                    {reset_success_message && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                            <span className="block sm:inline">{reset_success_message}</span>
                        </div>
                    )}

                    {/* Only show form if token exists and not yet successful */}
                    {reset_token && !reset_success_message && (
                        <form className="mt-8 space-y-6" onSubmit={submit_reset_password}>
                            {/* Hidden token - not strictly needed in form as it's in state, but included for clarity */}
                            <input type="hidden" name="token" value={reset_token} />

                            <div className="rounded-md shadow-sm -space-y-px">
                                {/* New Password Input */}
                                <div className="relative">
                                    <label htmlFor="new-password" className="sr-only">
                                        New password
                                    </label>
                                    <input
                                        id="new-password"
                                        name="new_password"
                                        type={show_new_password ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="New password (min. 6 characters)"
                                        value={form_input_new_password}
                                        onChange={(e) => set_form_input_new_password(e.target.value)}
                                        disabled={is_loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => set_show_new_password(!show_new_password)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                                        aria-label={show_new_password ? "Hide password" : "Show password"}
                                    >
                                        {show_new_password ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                    </button>
                                </div>

                                {/* Confirm New Password Input */}
                                <div className="relative">
                                    <label htmlFor="confirm-password" className="sr-only">
                                        Confirm new password
                                    </label>
                                    <input
                                        id="confirm-password"
                                        name="confirm_password"
                                        type={show_confirm_password ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Confirm new password"
                                        value={form_input_confirm_password}
                                        onChange={(e) => set_form_input_confirm_password(e.target.value)}
                                        disabled={is_loading}
                                    />
                                     <button
                                        type="button"
                                        onClick={() => set_show_confirm_password(!show_confirm_password)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                                        aria-label={show_confirm_password ? "Hide password" : "Show password"}
                                    >
                                        {show_confirm_password ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={is_loading}
                                    className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                                        is_loading
                                            ? 'bg-indigo-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                                    }`}
                                >
                                    {is_loading ? (
                                         <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : null}
                                    {is_loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    )}

                     {/* Link back to login if error or no token */}
                     {(reset_error && !reset_success_message) && (
                        <div className="text-sm text-center mt-4">
                            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                                Back to Login
                            </Link>
                            <span className="mx-1">or</span>
                             <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                                Request a new reset link
                            </Link>
                        </div>
                     )}
                </div>
            </div>
        </>
    );
};

export default UV_PasswordReset;