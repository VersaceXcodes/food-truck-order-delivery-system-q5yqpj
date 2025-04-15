import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api_client, login_success, RootState } from '@/store/main'; // Assuming store exports these

const UV_CustomerSignup: React.FC = () => {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordValidation, setPasswordValidation] = useState<{ minLength: boolean }>({ minLength: false });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authStatus = useSelector((state: RootState) => state.auth.auth_status);

  // Redirect if already logged in
  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/trucks'); // Redirect to customer discovery
    }
  }, [authStatus, navigate]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    switch (name) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        // Basic password validation feedback
        setPasswordValidation({ minLength: value.length >= 6 });
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
      case 'agreedTerms':
         setAgreedTerms(type === 'checkbox' ? checked : false);
         break;
      default:
        break;
    }
     // Clear errors on input change
     if (signupError) {
         setSignupError(null);
     }
  };

  const toggleAgreeTerms = () => {
    setAgreedTerms(!agreedTerms);
     if (signupError) {
         setSignupError(null);
     }
  };

  const validateEmail = (email: string): boolean => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const submitSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupError(null);

    // Client-side validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setSignupError('All fields are required.');
      return;
    }
    if (!validateEmail(email)) {
      setSignupError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }
    if (!agreedTerms) {
      setSignupError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api_client.post('/auth/signup/customer', {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
      });

      if (response.status === 201 && response.data.user && response.data.auth_token) {
        dispatch(login_success({ user: response.data.user, auth_token: response.data.auth_token }));
        navigate('/trucks'); // Navigate to discovery page on success
      } else {
         // Should not happen if backend adheres to spec, but handle defensively
         setSignupError('An unexpected error occurred during signup. Please try again.');
      }

    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setSignupError(error.response.data.error);
      } else {
        setSignupError('Failed to create account. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-[calc(100vh-128px)] bg-gray-100 py-12 px-4 sm:px-6 lg:px-8"> {/* Adjust min-height based on nav/footer height */}
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-lg shadow-md">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Create Your Customer Account
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={submitSignup} noValidate>
            <input type="hidden" name="remember" defaultValue="true" />
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="first-name" className="sr-only">First Name</label>
                <input
                  id="first-name"
                  name="firstName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="First Name"
                  value={firstName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="last-name" className="sr-only">Last Name</label>
                <input
                  id="last-name"
                  name="lastName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div className="relative">
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password (min. 6 characters)"
                  value={password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {/* Basic Eye Icon Example (replace with SVG/Icon library if available) */}
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                   </svg>
                  )}
                </button>
              </div>
              {/* Simple password helper text */}
              {password && (
                  <div className={`text-xs px-3 py-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValidation.minLength ? '✓ Minimum 6 characters' : '✗ Minimum 6 characters'}
                  </div>
              )}
              <div>
                <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>

             {/* Error Display Area */}
             {signupError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{signupError}</span>
              </div>
            )}

            <div className="flex items-center">
              <input
                id="agreedTerms"
                name="agreedTerms"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={agreedTerms}
                onChange={toggleAgreeTerms}
                disabled={isLoading}
              />
              <label htmlFor="agreedTerms" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <Link to="/terms" className="font-medium text-indigo-600 hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link to="/privacy" className="font-medium text-indigo-600 hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <div>
              <button
                type="submit"
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  !agreedTerms || isLoading
                    ? 'bg-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
                disabled={!agreedTerms || isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing Up...
                  </>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
          </form>

          <div className="text-sm text-center">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an account? Login
            </Link>
          </div>
          <div className="text-sm text-center">
            <Link to="/signup/operator" className="font-medium text-gray-600 hover:text-gray-800">
              Are you a Food Truck Owner? Sign Up Here
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_CustomerSignup;