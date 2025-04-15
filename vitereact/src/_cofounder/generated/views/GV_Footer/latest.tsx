import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/main'; // Adjust the import path as needed for your project structure

/**
 * Global Footer Component (GV_Footer)
 *
 * Displays copyright information and navigation links commonly found in a site footer.
 * Conditionally shows the 'Food Truck Sign Up' link based on user role.
 */
const GV_Footer: React.FC = () => {
    // Select the current user's role from the global Redux state
    const currentUserRole = useSelector((state: RootState) => state.auth.current_user?.role);

    // Determine if the current user is an operator
    const is_operator = currentUserRole === 'operator';

    // Get the current year for the copyright notice
    const current_year = new Date().getFullYear();

    return (
        <>
            {/* Footer element with background, text color, padding, and ensures it's pushed to the bottom */}
            <footer className="bg-gray-800 text-gray-400 text-sm py-6 mt-auto">
                {/* Container to manage content width and centering */}
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Flex container for layout, responsive direction */}
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        
                        {/* Copyright Notice */}
                        <div className="text-center md:text-left">
                            &copy; {current_year} StreetEats Hub. All rights reserved.
                        </div>

                        {/* Navigation Links */}
                        <nav className="flex flex-wrap justify-center md:justify-end space-x-4 md:space-x-6">
                            <Link 
                                to="/about" 
                                className="hover:text-white transition duration-150 ease-in-out"
                                aria-label="About Us"
                            >
                                About Us
                            </Link>
                            <Link 
                                to="/contact" 
                                className="hover:text-white transition duration-150 ease-in-out"
                                aria-label="Contact Us"
                            >
                                Contact Us
                            </Link>
                            <Link 
                                to="/terms" 
                                className="hover:text-white transition duration-150 ease-in-out"
                                aria-label="Terms of Service"
                            >
                                Terms of Service
                            </Link>
                            <Link 
                                to="/privacy" 
                                className="hover:text-white transition duration-150 ease-in-out"
                                aria-label="Privacy Policy"
                            >
                                Privacy Policy
                            </Link>

                            {/* Conditional Link: Display only if the user is NOT an operator */}
                            {!is_operator && (
                                <Link 
                                    to="/signup/operator" 
                                    className="hover:text-white transition duration-150 ease-in-out font-semibold text-indigo-300 hover:text-indigo-100"
                                    aria-label="Sign up as a Food Truck Operator"
                                >
                                    Food Truck Sign Up
                                </Link>
                            )}
                        </nav>
                    </div>
                </div>
            </footer>
        </>
    );
};

export default GV_Footer;