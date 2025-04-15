import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api_client } from '@/store/main'; // Use the configured Axios instance from the store

const UV_ForgotPasswordRequest: React.FC = () => {
  // === State ===
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false); // To style the message differently

  // === Actions ===

  /**
   * Updates the email state as the user types.
   */
  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  /**
   * Handles form submission: validates email, calls backend API.
   */
  const submitForgotPasswordRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission

    // Basic client-side validation
    if (!email) {
      setRequestMessage("Email address is required.");
      setIsSuccess(false);
      return;
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      setRequestMessage("Please enter a valid email address.");
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setRequestMessage(null); // Clear previous messages
    setIsSuccess(false);

    try {
      // Call backend API using the configured api_client
      const response = await api_client.post<{ message: string }>('/auth/forgot_password', { email });

      // Use the generic success message from the backend
      setRequestMessage(response.data.message);
      setIsSuccess(true); // Mark as success for styling
      setEmail(""); // Clear email field on success

    } catch (error: any) {
      console.error("Forgot password request failed:", error);
      // Display a generic error message for security and simplicity
      setRequestMessage('An error occurred while processing your request. Please try again later.');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  // === Render ===
  return (
    <>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
          {/* 1. Form Title */}
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset Your Password
            </h2>
          </div>

          {/* 2. Explanatory Text */}
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the email address associated with your account, and we'll send you a link to reset your password.
          </p>

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={submitForgotPasswordRequest} noValidate>
            <input type="hidden" name="remember" defaultValue="true" />
            <div className="rounded-md shadow-sm -space-y-px">
              {/* 3. Email Address Input */}
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
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Feedback Message Area */}
            {requestMessage && (
              <div className={`p-3 rounded-md text-sm ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {requestMessage}
              </div>
            )}

            {/* 4. Send Reset Link Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  isLoading
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>

            {/* 5. Back to Login Link */}
            <div className="text-sm text-center">
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_ForgotPasswordRequest;