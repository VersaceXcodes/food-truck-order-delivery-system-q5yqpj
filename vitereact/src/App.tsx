    import React from 'react';
    import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
    import { useSelector } from 'react-redux';
    import { RootState } from '@/store/main'; // Assuming RootState is exported

    // Import all GV_* and UV_* components...

    // ProtectedRoute Helper Component
    const ProtectedRoute = ({ element, requiredRole }: { element: React.ReactElement; requiredRole?: 'customer' | 'operator' }) => {
        const { auth_status, current_user } = useSelector((state: RootState) => state.auth);

        if (auth_status !== 'authenticated') {
            // Redirect to login if not authenticated
            return <Navigate to="/login" replace />;
        }

        if (requiredRole && current_user?.role !== requiredRole) {
            // Redirect to a default page if authenticated but wrong role
            // Redirect operators to their dashboard, customers to discovery
            const fallbackPath = current_user?.role === 'operator' ? '/operator/dashboard' : '/';
            return <Navigate to={fallbackPath} replace />;
        }

        // Render the element if authenticated and role matches (or no role required)
        return element;
    };


    const App: React.FC = () => {
        const { auth_status, current_user } = useSelector((state: RootState) => state.auth);
        const location = useLocation(); // Needed for OperatorNav exclusion

        const is_customer = auth_status === 'authenticated' && current_user?.role === 'customer';
        const is_operator = auth_status === 'authenticated' && current_user?.role === 'operator';
        const show_operator_nav = is_operator && location.pathname !== '/operator/verify-email-required';

        return (
            <div className="flex flex-col min-h-screen bg-gray-50">
                {/* --- Conditional Top Navigation --- */}
                {is_customer && <GV_CustomerTopNav />}
                {show_operator_nav && <GV_OperatorTopNav />}
                {!(is_customer || is_operator) && <GV_UnauthTopNav /> /* Show unauth if not customer and not operator */}

                {/* --- Main Content Area (Routing) --- */}
                <main className="flex-grow">
                    <Routes>
                        {/* --- Public Routes --- */}
                        <Route path="/" element={<UV_CustomerTruckDiscoveryList />} />
                        <Route path="/landing" element={<UV_Landing />} />
                        <Route path="/login" element={<UV_Login />} />
                        <Route path="/signup/customer" element={<UV_CustomerSignup />} />
                        <Route path="/signup/operator" element={<UV_OperatorSignup />} />
                        <Route path="/forgot-password" element={<UV_ForgotPasswordRequest />} />
                        <Route path="/reset-password" element={<UV_PasswordReset />} /> {/* Assumes UV handles token from URL */}
                        <Route path="/verify-email" element={<UV_Login />} /> {/* Assumes UV_Login or effect handles token */}
                        <Route path="/terms" element={<UV_StaticTerms />} />
                        <Route path="/privacy" element={<UV_StaticPrivacy />} />
                        <Route path="/vendor-terms" element={<UV_StaticVendorTerms />} />
                        <Route path="/about" element={<UV_StaticAbout />} />
                        <Route path="/contact" element={<UV_StaticContact />} />
                        <Route path="/trucks" element={<UV_CustomerTruckDiscoveryList />} />
                        <Route path="/trucks/map" element={<UV_CustomerTruckDiscoveryMap />} />
                        <Route path="/trucks/:truck_uid" element={<UV_CustomerTruckProfileMenu />} /> {/* UV handles :truck_uid */}

                         {/* --- Customer Protected Routes --- */}
                        <Route path="/checkout" element={<ProtectedRoute element={<UV_CustomerCheckout />} requiredRole="customer" />} />
                        <Route path="/orders/confirmation/:order_uid" element={<ProtectedRoute element={<UV_CustomerOrderConfirmation />} requiredRole="customer" />} /> {/* UV handles :order_uid */}
                        <Route path="/orders" element={<ProtectedRoute element={<UV_CustomerOrderTracking />} requiredRole="customer" />} />
                        <Route path="/profile" element={<ProtectedRoute element={<UV_CustomerProfile />} requiredRole="customer" />} />
                        <Route path="/profile/addresses" element={<ProtectedRoute element={<UV_CustomerAddressManagement />} requiredRole="customer" />} />
                        <Route path="/profile/payments" element={<ProtectedRoute element={<UV_CustomerPaymentManagement />} requiredRole="customer" />} />

                         {/* --- Operator Protected Routes --- */}
                         <Route path="/operator/dashboard" element={<ProtectedRoute element={<UV_OperatorDashboard />} requiredRole="operator" />} />
                         <Route path="/operator/menu" element={<ProtectedRoute element={<UV_OperatorMenuManagement />} requiredRole="operator" />} />
                         <Route path="/operator/settings/truck" element={<ProtectedRoute element={<UV_OperatorTruckSettings />} requiredRole="operator" />} />
                         <Route path="/operator/settings/account" element={<ProtectedRoute element={<UV_OperatorAccountSettings />} requiredRole="operator" />} />
                         <Route path="/operator/settings/payouts" element={<ProtectedRoute element={<UV_OperatorPayoutConfiguration />} requiredRole="operator" />} />
                         <Route path="/operator/history" element={<ProtectedRoute element={<UV_OperatorOrderHistory />} requiredRole="operator" />} />
                         <Route path="/operator/verify-email-required" element={<ProtectedRoute element={<UV_OperatorEmailVerificationRequired />} requiredRole="operator" />} />

                        {/* --- Fallback Route (Optional) --- */}
                        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
                         {/* Or a dedicated 404 component */}
                         <Route path="*" element={<div>404 - Page Not Found</div>} />


                    </Routes>
                </main>

                {/* --- Global Footer --- */}
                <GV_Footer />

                {/* --- Global Overlays --- */}
                {is_customer && <GV_ShoppingCartPanel />} {/* Only render panel structure if customer */}
                <GV_NotificationDisplay /> {/* Always render notification container */}

                {/* UV_CustomerItemCustomization and UV_OperatorOrderDetailsModal are typically rendered conditionally *within* their parent views (e.g., ProfileMenu, OperatorDashboard) or via a separate modal state system, not directly routed here unless they were full pages. Based on description (modal/overlay), they are likely not direct routes. */}

            </div>
        );
    };

    export default App;
