import React from 'react';
import { Link } from 'react-router-dom';

/**
 * UV_Landing Component
 *
 * The initial public-facing page for unauthenticated users. It introduces the
 * StreetEats Hub platform, highlights the value proposition (finding and
 * ordering from food trucks easily), and provides clear calls to action for
 * key user journeys.
 */
const UV_Landing: React.FC = () => {

  // Actions are handled directly by <Link> components below

  return (
    <>
      {/* Hero Section */}
      <div className="relative bg-gray-900 text-white overflow-hidden shadow-lg">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            // Using a food-related seed for picsum.photos
            src="https://picsum.photos/seed/streetfoodvibes/1920/1080"
            alt="Vibrant street food scene"
            className="w-full h-full object-cover object-center"
            aria-hidden="true"
          />
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-60 mix-blend-multiply" aria-hidden="true"></div>
        </div>

        {/* Content */}
        <div className="relative max-w-4xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl drop-shadow-md">
            Discover Your City's Best Street Food
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-200 drop-shadow">
            StreetEats Hub connects you with local food trucks. Find, order, and enjoy delicious meals for pickup or delivery, all in one place.
          </p>

          {/* CTA: Find Trucks */}
          <div className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center">
            <Link
              to="/" // Navigate to Discovery List (root path)
              className="inline-block px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:px-10 transition duration-150 ease-in-out"
              data-testid="find-trucks-button"
            >
              Find Food Trucks Near You
            </Link>
          </div>
        </div>
      </div>

      {/* Additional Sections / CTAs */}
      <div className="bg-gradient-to-b from-white to-gray-50 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-stretch">

            {/* Customer Signup CTA */}
            <div className="flex flex-col text-center md:text-left p-8 border border-gray-200 rounded-lg shadow-md bg-white transition duration-300 hover:shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900">Ready to Eat?</h2>
              <p className="mt-3 text-gray-600 flex-grow">
                Sign up as a customer to browse menus, place orders, and track your food from your favorite local trucks. Quick, easy, and delicious!
              </p>
              <div className="mt-6">
                <Link
                  to="/signup/customer"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
                  data-testid="customer-signup-button"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Operator Signup CTA */}
            <div className="flex flex-col text-center md:text-left p-8 border border-gray-200 rounded-lg shadow-md bg-white transition duration-300 hover:shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900">Are you a Food Truck?</h2>
              <p className="mt-3 text-gray-600 flex-grow">
                Join StreetEats Hub to reach more customers, manage online orders easily, update your location, and grow your business on the go.
              </p>
              <div className="mt-6">
                <Link
                  to="/signup/operator"
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                  data-testid="operator-signup-button"
                >
                  Join as an Operator
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Landing;