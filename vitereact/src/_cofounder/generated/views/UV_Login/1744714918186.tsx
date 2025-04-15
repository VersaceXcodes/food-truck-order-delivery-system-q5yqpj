import React, { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; // Using Heroicons for visibility toggle

import {
    login_success,
    add_notification,
    api_client,
    RootState,
    AppDispatch,
    CurrentUser // Import CurrentUser type
} from '@/store/main';

const UV_Login: React.FC = () => {
    const [email, set_email] = useState<string>("");
    const [password, set_password] = useState<string>("");
    const [show_password, set_show_password] = useState<boolean>(false);
    const [is_loading, set_is_loading] = useState<boolean>(false);
    const [login_error, set_login_error] = useState<string | null>(null);
    const [verification_message, set_verification_message] = useState<string | null>(null);

    const dispatch: AppDispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const search_params = new URLSearchParams(location.search);
    const verification_token = search_params.get('token');

    const { auth_status, current_user } = useSelector((state: RootState) => state.auth);

    // --- Effect for Email Verification ---
    useEffect(() => {
        const handleEmailVerification = async (token: string) => {
            set_is_loading(true);
            set_login_error(null);
            set_verification_message(null);
            try {
                const response = await api_client.post('/auth/verify_email', { token });
                set_verification_message(response.data.message || 'Email verified successfully. Please log in.');
                dispatch(add_notification({ type: 'success', message: response.data.message || 'Email verified successfully.' }));
                // Remove token from URL after processing
                navigate('/login', { replace: true });
            } catch (error: any) {
                const error_message = error.response?.data?.error || 'Failed to verify email. The link may be invalid or expired.';
                set_login_error(error_message);
                dispatch(add_notification({ type: 'error', message: error_message }));
                 // Remove token from URL even on error
                navigate('/login', { replace: true });
            } finally {
                set_is_loading(false);
            }
        };

        if (verification_token) {
            handleEmailVerification(verification_token);
        }
    }, [verification_token, dispatch, navigate]);

     // --- Effect to Redirect Authenticated Users ---
     useEffect(() => {
        if (auth_status === 'authenticated' && current_user) {
            const redirect_path = current_user.role === 'operator' ? '/operator/dashboard' : '/';
            console.log(`User already authenticated (${current_user.role}), redirecting to ${redirect_path}`);
            navigate(redirect_path, { replace: true });
        }
    }, [auth_status, current_user, navigate]);


    // --- Event Handlers ---
    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        set_email(event.target.value);
        set_login_error(null); // Clear error on input change
        set_verification_message(null); // Clear verification message
    };

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        set_password(event.target.value);
        set_login_error(null); // Clear error on input change
    };

    const toggle_password_visibility = () => {
        set_show_password(!show_password);
    };

    // --- Login Submission ---
    const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        set_login_error(null);
        set_verification_message(null);

        // Basic client-side validation
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            set_login_error("Please enter a valid email address.");
            return;
        }
        if (!password) {
            set_login_error("Password is required.");
            return;
        }

        set_is_loading(true);

        try {
            const response = await api_client.post('/auth/login', { email: email.toLowerCase(), password });

            const { user, auth_token } = response.data as { user: CurrentUser; auth_token: string };

            dispatch(login_success({ user, auth_token }));
            dispatch(add_notification({ type: 'success', message: 'Login successful!' }));

            // Determine redirect path based on role
            // Backend handles unverified operator login attempt with 403 error
            const redirect_path = user.role === 'operator' ? '/operator/dashboard' : '/';
            navigate(redirect_path, { replace: true });

        } catch (error: any) {
            const error_message = error.response?.data?.error || 'Login failed. Please check your credentials or network connection.';
            set_login_error(error_message);
            dispatch(add_notification({ type: 'error', message: error_message }));
            // Optionally dispatch login_failure if needed for global state
            // dispatch(login_failure(error_message));
        } finally {
            set_is_loading(false);
        }
    };

    // --- Render Logic ---
    return (
        <>
            <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-lg rounded-lg">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                            Login to StreetEats Hub
                        </h2>
                    </div>

                    {/* Display Verification Message */}
                    {verification_message && !is_loading && (
                        <div className="rounded-md bg-green-50 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-green-800">{verification_message}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Display Login Error */}
                     {login_error && !is_loading && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-red-800">{login_error}</p>
                                </div>
                            </div>
                        </div>
                    )}


                    <form className="mt-8 space-y-6" onSubmit={submitLogin}>
                        <input type="hidden" name="remember" value="true" />
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="email-address" className="sr-only">
                                    Email address
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={handleEmailChange}
                                    className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    placeholder="Email address"
                                    disabled={is_loading}
                                />
                            </div>
                            <div className="relative">
                                <label htmlFor="password" className="sr-only">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type={show_password ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={handlePasswordChange}
                                    className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    placeholder="Password"
                                    disabled={is_loading}
                                />
                                <button
                                     type="button"
                                     onClick={toggle_password_visibility}
                                     className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                                     aria-label={show_password ? 'Hide password' : 'Show password'}
                                     disabled={is_loading}
                                >
                                     {show_password ? (
                                         <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                                     ) : (
                                         <EyeIcon className="h-5 w-5" aria-hidden="true" />
                                     )}
                                 </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                <Link
                                    to="/forgot-password"
                                    className="font-medium text-indigo-600 hover:text-indigo-500"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={is_loading}
                                className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {is_loading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Login'
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="text-sm text-center">
                        <p className="text-gray-600">
                            Don't have an account?{' '}
                            <Link
                                to="/signup/customer"
                                className="font-medium text-indigo-600 hover:text-indigo-500"
                            >
                                Sign Up
                            </Link>
                             {' '}or{' '}
                             <Link
                                to="/signup/operator"
                                className="font-medium text-indigo-600 hover:text-indigo-500"
                             >
                                Register your Food Truck
                             </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UV_Login;