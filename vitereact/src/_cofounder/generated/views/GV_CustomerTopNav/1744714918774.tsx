import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
    RootState,
    logout,
    toggle_cart_panel_visibility,
    AppNotification // Import type if needed for filtering
} from '@/store/main'; // Assuming store setup as analyzed

const GV_CustomerTopNav: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // --- Global State Selection ---
    const { current_user } = useSelector((state: RootState) => state.auth);
    const cart_items = useSelector((state: RootState) => state.cart.items);
    const app_notifications = useSelector((state: RootState) => state.notifications.app_notifications);

    // --- Derived State Calculation ---
    const customer_first_name = current_user?.first_name || 'User';
    const cart_item_count = cart_items.reduce((total, item) => total + item.quantity, 0);

    // Calculate unread notification count (simple count for MVP)
    // TODO: Refine this logic if specific notification types matter for the badge
    const unread_notification_count = app_notifications.length;

    // --- Local State for Dropdown ---
    const [is_dropdown_open, set_is_dropdown_open] = useState(false);
    const dropdown_ref = useRef<HTMLDivElement>(null);

    // --- Event Handlers ---
    const handle_logout = () => {
        dispatch(logout());
        // Optional: Redirect immediately after dispatching logout
        // navigate('/login'); // Or let the ProtectedRoute handle redirection
        set_is_dropdown_open(false); // Close dropdown on logout
    };

    const handle_toggle_cart = () => {
        dispatch(toggle_cart_panel_visibility());
    };

    const toggle_dropdown = () => {
        set_is_dropdown_open(prev => !prev);
    };

    // --- Click Outside Handler for Dropdown ---
    useEffect(() => {
        const handle_click_outside = (event: MouseEvent) => {
            if (dropdown_ref.current && !dropdown_ref.current.contains(event.target as Node)) {
                set_is_dropdown_open(false);
            }
        };

        if (is_dropdown_open) {
            document.addEventListener('mousedown', handle_click_outside);
        } else {
            document.removeEventListener('mousedown', handle_click_outside);
        }

        // Cleanup listener on component unmount or when dropdown closes
        return () => {
            document.removeEventListener('mousedown', handle_click_outside);
        };
    }, [is_dropdown_open]);

    // --- Render Component ---
    return (
        <>
            <nav className="bg-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Left Section: Logo & Core Nav */}
                        <div className="flex items-center">
                            {/* Logo */}
                            <Link to="/trucks" className="flex-shrink-0 flex items-center text-xl font-bold text-indigo-600 hover:text-indigo-800">
                                StreetEats Hub
                            </Link>
                            {/* Core Navigation Links (visible on larger screens) */}
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/trucks"
                                    className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                >
                                    Find Food Trucks
                                </Link>
                                <Link
                                    to="/orders"
                                    className="relative inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                >
                                    My Orders
                                    {unread_notification_count > 0 && (
                                        <span className="absolute top-1 right-[-8px] inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                                            {unread_notification_count}
                                        </span>
                                    )}
                                </Link>
                            </div>
                        </div>

                        {/* Right Section: Cart & Profile */}
                        <div className="flex items-center">
                            {/* Shopping Cart Button */}
                            <button
                                type="button"
                                onClick={handle_toggle_cart}
                                className="relative ml-4 p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                aria-label="Shopping Cart"
                            >
                                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {cart_item_count > 0 && (
                                    <span className="absolute top-0 right-0 block h-5 w-5 transform -translate-y-1 translate-x-1 rounded-full text-center text-xs font-bold text-white bg-indigo-600 ring-2 ring-white">
                                        {cart_item_count}
                                    </span>
                                )}
                            </button>

                            {/* Profile Dropdown */}
                            <div className="ml-3 relative" ref={dropdown_ref}>
                                <div>
                                    <button
                                        type="button"
                                        className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        id="user-menu-button"
                                        aria-expanded={is_dropdown_open}
                                        aria-haspopup="true"
                                        onClick={toggle_dropdown}
                                    >
                                        <span className="sr-only">Open user menu</span>
                                        {/* Placeholder User Icon / Name */}
                                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                                             {/* Can use an image here later: <img className="h-8 w-8 rounded-full" src="https://picsum.photos/seed/user/100/100" alt="" /> */}
                                             <span className="text-sm font-medium leading-none text-gray-600">{customer_first_name.charAt(0).toUpperCase()}</span>
                                        </span>
                                        <span className="ml-2 hidden sm:inline text-gray-700 text-sm font-medium">Hi, {customer_first_name}</span>
                                         <svg className="ml-1 h-5 w-5 text-gray-400 hidden sm:inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Dropdown menu */}
                                {is_dropdown_open && (
                                    <div
                                        className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                                        role="menu"
                                        aria-orientation="vertical"
                                        aria-labelledby="user-menu-button"
                                        tabIndex={-1}
                                    >
                                        <Link
                                            to="/profile"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-0"
                                            onClick={() => set_is_dropdown_open(false)} // Close dropdown on click
                                        >
                                            Profile
                                        </Link>
                                        <Link
                                            to="/profile/addresses"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-1"
                                             onClick={() => set_is_dropdown_open(false)}
                                        >
                                            Addresses
                                        </Link>
                                        <Link
                                            to="/profile/payments"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-2"
                                             onClick={() => set_is_dropdown_open(false)}
                                        >
                                            Payment Methods
                                        </Link>
                                        <button
                                            onClick={handle_logout}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-3"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                 {/* Mobile Navigation Links (Optional: Could be revealed by a burger menu) */}
                 {/* For MVP, core links are sufficient on larger screens */}
                 {/*
                 <div className="sm:hidden" id="mobile-menu">
                    <div className="pt-2 pb-3 space-y-1">
                         <Link to="/trucks" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700">Find Food Trucks</Link>
                         <Link to="/orders" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700">My Orders</Link>
                    </div>
                 </div>
                 */}
            </nav>
        </>
    );
};

export default GV_CustomerTopNav;