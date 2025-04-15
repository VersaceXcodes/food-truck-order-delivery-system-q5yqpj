import React from 'react';
import { Link } from 'react-router-dom';

/**
 * GV_UnauthTopNav Component
 *
 * The navigation bar displayed at the top of the viewport for users who are
 * not logged in. Includes branding, links to discover trucks, log in,
 * and sign up as either a customer or operator.
 *
 * @component
 * @example
 * return <GV_UnauthTopNav />
 */
const GV_UnauthTopNav: React.FC = () => {
  // No internal state or global state access needed for this component.
  // It only provides navigation links.

  // Actions are handled directly by the <Link> components.
  // navigate_to_discovery -> Link to '/'
  // navigate_to_login -> Link to '/login'
  // navigate_to_customer_signup -> Link to '/signup/customer'
  // navigate_to_operator_signup -> Link to '/signup/operator'

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white shadow-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Main Discovery Link */}
            <div className="flex items-center">
              <Link
                to="/"
                className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 transition duration-150 ease-in-out"
                aria-label="StreetEats Hub Home"
              >
                StreetEats Hub
              </Link>
              <div className="hidden md:block ml-10">
                <Link
                  to="/"
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Find Food Trucks
                </Link>
              </div>
            </div>

            {/* Right-side Navigation Links/Buttons */}
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup/customer"
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow transition duration-150 ease-in-out"
              >
                Sign Up
              </Link>
              <Link
                to="/signup/operator"
                className="hidden sm:inline-block border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
              >
                For Food Trucks
              </Link>
            </div>
          </div>
          {/* Optional: Mobile menu button if needed in future */}
        </div>
      </nav>
    </>
  );
};

export default GV_UnauthTopNav;