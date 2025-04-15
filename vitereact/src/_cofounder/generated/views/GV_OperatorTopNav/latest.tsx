import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, logout } from '@/store/main'; // Assuming RootState and logout action are exported

const GV_OperatorTopNav: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { current_user } = useSelector((state: RootState) => state.auth);
    const [is_dropdown_open, set_is_dropdown_open] = useState(false);
    const dropdown_ref = useRef<HTMLDivElement>(null); // Ref for dropdown element

    const operator_display_name = current_user?.first_name ?? 'Operator';

    const toggle_dropdown = () => {
        set_is_dropdown_open(!is_dropdown_open);
    };

    const handle_logout = async () => {
        try {
            // Dispatch the global logout action
            // The action itself handles clearing state and the middleware handles WS disconnect
            // The backend call POST /auth/logout is optional for JWT, handled client-side primarily
            dispatch(logout());
            // Explicitly navigate after logout, although ProtectedRoute might also handle it
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            // Optionally dispatch a notification for logout failure
        } finally {
            set_is_dropdown_open(false); // Close dropdown regardless of outcome
        }
    };

    // Close dropdown if clicking outside
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

        return () => {
            document.removeEventListener('mousedown', handle_click_outside);
        };
    }, [is_dropdown_open]);

    // Render nothing if user is not an operator (although App.tsx should prevent this)
    if (current_user?.role !== 'operator') {
        return null;
    }

    return (
        <>
            <nav className="bg-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Left Section: Logo & Main Nav */}
                        <div className="flex items-center">
                            {/* Logo */}
                            <Link
                                to="/operator/dashboard"
                                className="flex-shrink-0 flex items-center text-xl font-bold text-indigo-600 hover:text-indigo-800"
                                onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                            >
                                StreetEats Hub
                            </Link>

                            {/* Main Navigation Links */}
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/operator/dashboard"
                                    className="border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                                    onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/operator/menu"
                                    className="border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                                    onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                                >
                                    Menu Management
                                </Link>
                                <Link
                                    to="/operator/settings/truck"
                                    className="border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                                    onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                                >
                                    Truck Settings
                                </Link>
                            </div>
                        </div>

                        {/* Right Section: Profile Dropdown */}
                        <div className="hidden sm:ml-6 sm:flex sm:items-center">
                            <div className="ml-3 relative" ref={dropdown_ref}>
                                <div>
                                    <button
                                        type="button"
                                        className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 items-center px-3 py-1 border border-gray-300 hover:bg-gray-50"
                                        id="user-menu-button"
                                        aria-expanded={is_dropdown_open}
                                        aria-haspopup="true"
                                        onClick={toggle_dropdown}
                                    >
                                        <span className="sr-only">Open user menu</span>
                                        {/* Placeholder Icon - replace with user avatar or icon if available */}
                                        <svg className="h-6 w-6 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-gray-700">{operator_display_name}</span>
                                        {/* Dropdown Arrow */}
                                        <svg className={`ml-2 h-5 w-5 text-gray-400 transition-transform duration-200 ${is_dropdown_open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Dropdown Menu */}
                                {is_dropdown_open && (
                                    <div
                                        className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none transition ease-out duration-100 transform opacity-100 scale-100" // Added transitions (can adjust)
                                        role="menu"
                                        aria-orientation="vertical"
                                        aria-labelledby="user-menu-button"
                                        tabIndex={-1}
                                    >
                                        <Link
                                            to="/operator/settings/account"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-0"
                                            onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                                        >
                                            Account Settings
                                        </Link>
                                        <Link
                                            to="/operator/settings/payouts"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-1"
                                            onClick={() => set_is_dropdown_open(false)} // Close dropdown on nav
                                        >
                                            Payout Setup
                                        </Link>
                                        <button
                                            onClick={handle_logout}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                            tabIndex={-1}
                                            id="user-menu-item-2"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Menu Button (Hidden for now, can be added later) */}
                        <div className="-mr-2 flex items-center sm:hidden">
                            {/* Mobile menu button placeholder */}
                            <button type="button" className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" aria-controls="mobile-menu" aria-expanded="false">
                                <span className="sr-only">Open main menu</span>
                                {/* Icon when menu is closed. Heroicon name: menu */}
                                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                                {/* Icon when menu is open. Heroicon name: x */}
                                {/* <svg className="hidden h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg> */}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu, show/hide based on menu state (Placeholder) */}
                {/* <div className="sm:hidden" id="mobile-menu">
                    <div className="pt-2 pb-3 space-y-1">
                        <Link to="/operator/dashboard" className="block pl-3 pr-4 py-2 border-l-4 border-indigo-500 text-base font-medium text-indigo-700 bg-indigo-50">Dashboard</Link>
                        <Link to="/operator/menu" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700">Menu Management</Link>
                        <Link to="/operator/settings/truck" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700">Truck Settings</Link>
                    </div>
                    <div className="pt-4 pb-3 border-t border-gray-200">
                         <div className="flex items-center px-4">
                            <div className="ml-3">
                                <div className="text-base font-medium text-gray-800">{operator_display_name}</div>
                                <div className="text-sm font-medium text-gray-500">{current_user?.email}</div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <Link to="/operator/settings/account" className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">Account Settings</Link>
                            <Link to="/operator/settings/payouts" className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">Payout Setup</Link>
                            <button onClick={handle_logout} className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">Logout</button>
                        </div>
                    </div>
                </div> */}
            </nav>
        </>
    );
};

export default GV_OperatorTopNav;