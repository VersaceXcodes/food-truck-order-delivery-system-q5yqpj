import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, add_notification, api_client } from '@/store/main';

const UV_OperatorSignup: React.FC = () => {
    const [operatorFirstName, setOperatorFirstName] = useState<string>('');
    const [operatorLastName, setOperatorLastName] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [foodTruckName, setFoodTruckName] = useState<string>('');
    const [cuisineType, setCuisineType] = useState<string>('');
    const [agreedVendorTerms, setAgreedVendorTerms] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [signupError, setSignupError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [passwordVisible, setPasswordVisible] = useState<boolean>(false);

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { auth_status, current_user } = useSelector((state: RootState) => state.auth);

    // Redirect if already logged in
    useEffect(() => {
        if (auth_status === 'authenticated') {
            const redirect_path = current_user?.role === 'operator' ? '/operator/dashboard' : '/';
            console.log('User already authenticated, redirecting to', redirect_path);
            navigate(redirect_path, { replace: true });
        }
    }, [auth_status, current_user, navigate]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        setFieldErrors((prev) => ({ ...prev, [name]: '' })); // Clear error on change

        switch (name) {
            case 'operatorFirstName':
                setOperatorFirstName(value);
                break;
            case 'operatorLastName':
                setOperatorLastName(value);
                break;
            case 'email':
                setEmail(value);
                break;
            case 'password':
                setPassword(value);
                break;
            case 'confirmPassword':
                setConfirmPassword(value);
                break;
            case 'foodTruckName':
                setFoodTruckName(value);
                break;
            case 'cuisineType':
                setCuisineType(value);
                break;
            default:
                break;
        }
    };

    const toggleAgreeTerms = () => {
        setAgreedVendorTerms(!agreedVendorTerms);
        setFieldErrors((prev) => ({ ...prev, agreedVendorTerms: '' })); // Clear error on change
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};
        let is_valid = true;

        if (!operatorFirstName.trim()) { errors.operatorFirstName = 'Operator first name is required.'; is_valid = false; }
        if (!operatorLastName.trim()) { errors.operatorLastName = 'Operator last name is required.'; is_valid = false; }
        if (!foodTruckName.trim()) { errors.foodTruckName = 'Food truck name is required.'; is_valid = false; }
        if (!cuisineType.trim()) { errors.cuisineType = 'Cuisine type is required.'; is_valid = false; }
        if (!email.trim()) {
            errors.email = 'Email is required.';
            is_valid = false;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            errors.email = 'Invalid email format.';
            is_valid = false;
        }
        if (!password) {
            errors.password = 'Password is required.';
            is_valid = false;
        } else if (password.length < 6) {
            errors.password = 'Password must be at least 6 characters long.';
            is_valid = false;
        }
        if (!confirmPassword) {
            errors.confirmPassword = 'Confirm password is required.';
            is_valid = false;
        } else if (password && password !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
            is_valid = false;
        }
        if (!agreedVendorTerms) {
            errors.agreedVendorTerms = 'You must agree to the Vendor Terms of Service.';
            is_valid = false;
        }

        setFieldErrors(errors);
        return is_valid;
    };

    const submitOperatorSignup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSignupError(null);
        setFieldErrors({});

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            // Backend expects snake_case keys
            await api_client.post('/auth/signup/operator', {
                operator_first_name: operatorFirstName,
                operator_last_name: operatorLastName,
                email: email,
                password: password,
                food_truck_name: foodTruckName,
                cuisine_type: cuisineType,
            });

            dispatch(add_notification({
                type: 'success',
                message: 'Registration successful! Please check your email to verify your account.',
                duration: 7000, // Longer duration for important message
            }));
            navigate('/operator/verify-email-required');

        } catch (error: any) {
            console.error("Operator Signup failed:", error);
            const error_message = error.response?.data?.error || 'Signup failed. Please try again.';
            setSignupError(error_message);
            dispatch(add_notification({
                type: 'error',
                message: error_message,
            }));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="min-h-[calc(100vh-128px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-100 to-amber-100">
                <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Register Your Food Truck
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600">
                            Start reaching more customers today!
                        </p>
                    </div>
                    <form className="mt-8 space-y-6" onSubmit={submitOperatorSignup} noValidate>
                        {signupError && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Registration Error</h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{signupError}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Operator Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="operatorFirstName" className="block text-sm font-medium text-gray-700">
                                    Operator First Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="operatorFirstName"
                                    name="operatorFirstName"
                                    type="text"
                                    required
                                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.operatorFirstName ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                    placeholder="Your First Name"
                                    value={operatorFirstName}
                                    onChange={handleInputChange}
                                />
                                {fieldErrors.operatorFirstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.operatorFirstName}</p>}
                            </div>
                            <div>
                                <label htmlFor="operatorLastName" className="block text-sm font-medium text-gray-700">
                                    Operator Last Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="operatorLastName"
                                    name="operatorLastName"
                                    type="text"
                                    required
                                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.operatorLastName ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                    placeholder="Your Last Name"
                                    value={operatorLastName}
                                    onChange={handleInputChange}
                                />
                                {fieldErrors.operatorLastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.operatorLastName}</p>}
                            </div>
                        </div>

                        {/* Food Truck Info */}
                        <div>
                            <label htmlFor="foodTruckName" className="block text-sm font-medium text-gray-700">
                                Food Truck Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="foodTruckName"
                                name="foodTruckName"
                                type="text"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.foodTruckName ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="e.g., Tony's Tacos"
                                value={foodTruckName}
                                onChange={handleInputChange}
                            />
                            {fieldErrors.foodTruckName && <p className="mt-1 text-xs text-red-600">{fieldErrors.foodTruckName}</p>}
                        </div>

                        <div>
                            <label htmlFor="cuisineType" className="block text-sm font-medium text-gray-700">
                                Cuisine Type <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="cuisineType"
                                name="cuisineType"
                                type="text"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.cuisineType ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="e.g., Tacos, Burgers, Pizza"
                                value={cuisineType}
                                onChange={handleInputChange}
                            />
                             {fieldErrors.cuisineType && <p className="mt-1 text-xs text-red-600">{fieldErrors.cuisineType}</p>}
                        </div>


                        {/* Account Info */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Contact Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="you@example.com"
                                value={email}
                                onChange={handleInputChange}
                            />
                            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                        </div>

                        <div className="relative">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="password"
                                name="password"
                                type={passwordVisible ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={handleInputChange}
                            />
                             <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                                aria-label={passwordVisible ? "Hide password" : "Show password"}
                            >
                                {passwordVisible ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8.707 14.707a1 1 0 01-1.414-1.414L8.586 12 7.293 10.707a1 1 0 111.414-1.414L10 10.586l1.293-1.293a1 1 0 111.414 1.414L11.414 12l1.293 1.293a1 1 0 01-1.414 1.414L10 13.414l-1.293 1.293z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.09C7.126 5.403 5.403 7.126 5.09 9H5a1 1 0 100 2h.09c.313 1.874 1.033 3.597 2.91 4.91V15a1 1 0 102 0v-.09c1.874-.313 3.597-1.033 4.91-2.91H15a1 1 0 100-2h-.09c-.313-1.874-1.033-3.597-2.91-4.91V5zM10 7a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                            {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                Confirm Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={passwordVisible ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={handleInputChange}
                            />
                            {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
                        </div>


                        {/* Terms Agreement */}
                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input
                                    id="agreedVendorTerms"
                                    name="agreedVendorTerms"
                                    type="checkbox"
                                    className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${fieldErrors.agreedVendorTerms ? 'border-red-500' : ''}`}
                                    checked={agreedVendorTerms}
                                    onChange={toggleAgreeTerms}
                                />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="agreedVendorTerms" className={`font-medium ${fieldErrors.agreedVendorTerms ? 'text-red-700' : 'text-gray-700'}`}>
                                    I agree to the <Link to="/vendor-terms" className="text-indigo-600 hover:text-indigo-500 underline" target="_blank" rel="noopener noreferrer">Vendor Terms of Service</Link>. <span className="text-red-500">*</span>
                                </label>
                                {fieldErrors.agreedVendorTerms && <p className="mt-1 text-xs text-red-600">{fieldErrors.agreedVendorTerms}</p>}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-live="polite"
                                aria-busy={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Registering...
                                    </>
                                ) : (
                                    'Register Food Truck'
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="text-sm text-center">
                        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Already have an operator account? Login
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UV_OperatorSignup;