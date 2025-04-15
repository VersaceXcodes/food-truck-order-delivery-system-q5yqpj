import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { RootState, add_notification, api_client } from '@/store/main'; // Assuming api_client is exported

type PayoutStatus = 'not_configured' | 'pending' | 'active' | 'error_fetching';

const UV_OperatorPayoutConfiguration: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { auth_token } = useSelector((state: RootState) => state.auth);

  const [payout_status, set_payout_status] = useState<PayoutStatus>('not_configured');
  const [is_loading_status, set_is_loading_status] = useState<boolean>(true);
  const [is_loading_onboarding, set_is_loading_onboarding] = useState<boolean>(false);
  const [error_message, set_error_message] = useState<string | null>(null);
  const [feedback_message, set_feedback_message] = useState<string | null>(null);

  // 1. Action: Fetch Payout Status
  const fetch_payout_status = useCallback(async () => {
    set_is_loading_status(true);
    set_error_message(null);
    try {
      // Backend returns the full truck details, including payout_configured_status
      const response = await api_client.get<{ payout_configured_status: PayoutStatus }>('/operators/me/truck');
      const fetched_status = response.data.payout_configured_status || 'not_configured'; // Default if missing
      set_payout_status(fetched_status);
    } catch (error: any) {
      console.error("Error fetching payout status:", error);
      const message = error.response?.data?.error || error.message || 'Failed to fetch payout status.';
      set_payout_status('error_fetching');
      set_error_message(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      set_is_loading_status(false);
    }
  }, [dispatch]);

  // 2. Action: Initiate Onboarding
  const initiate_onboarding = async () => {
    set_is_loading_onboarding(true);
    set_error_message(null);
    set_feedback_message(null); // Clear previous feedback

    // Construct return/refresh URLs based on the current page
    const current_url = window.location.origin + location.pathname;

    try {
      const response = await api_client.post<{ onboarding_url: string }>('/operators/me/truck/payout_config', {
        return_url: `${current_url}?success=true`, // Add success param for feedback
        refresh_url: `${current_url}?error=refresh_required`, // Add error param for feedback
      });

      const onboarding_url = response.data.onboarding_url;
      if (onboarding_url) {
        // Redirect the user to the Stripe Connect onboarding flow
        window.location.href = onboarding_url;
        // Note: Loading state remains true until redirection completes
      } else {
        throw new Error("Onboarding URL not received from server.");
      }
    } catch (error: any) {
      console.error("Error initiating onboarding:", error);
      const message = error.response?.data?.error || error.message || 'Failed to start payout setup.';
      set_error_message(message);
      dispatch(add_notification({ type: 'error', message }));
      set_is_loading_onboarding(false);
    }
    // No finally block to set loading false here, as successful path involves redirection
  };

  // 3. Action: Handle Redirect Parameters
  const handle_redirect_params = useCallback(() => {
    const success_param = searchParams.get('success');
    const error_param = searchParams.get('error');
    let feedback_msg: string | null = null;
    let needs_refresh = false;

    if (success_param === 'true') {
      feedback_msg = "Payout setup process finished. Your account details are being verified by our payment partner. This may take a few business days. We'll update the status here once complete.";
      needs_refresh = true; // Re-fetch status after successful return
    } else if (error_param) {
      switch (error_param) {
        case 'permissions_denied':
          feedback_msg = "Payout setup failed: Permissions were denied.";
          break;
        case 'refresh_required':
            feedback_msg = "The setup link may have expired. Please try again.";
            break;
        default:
          feedback_msg = "Payout setup failed or was cancelled. Please try again or contact support if issues persist.";
      }
    }

    if (feedback_msg) {
      set_feedback_message(feedback_msg);
      // Clean the URL parameters after reading them
      navigate(location.pathname, { replace: true });
      if (needs_refresh) {
        fetch_payout_status(); // Fetch status again after successful redirect
      }
    }
  }, [searchParams, navigate, location.pathname, fetch_payout_status]);

  // --- Effects ---

  // Fetch status on initial load
  useEffect(() => {
    fetch_payout_status();
  }, [fetch_payout_status]);

  // Handle redirect parameters after initial status load is complete
  useEffect(() => {
    if (!is_loading_status) { // Only run after initial fetch attempt
      handle_redirect_params();
    }
  }, [is_loading_status, handle_redirect_params]); // Dependency on loading status ensures it runs after fetch

  // --- Render Logic ---

  const get_status_display = () => {
    switch (payout_status) {
      case 'not_configured':
        return { text: 'Not Configured', color: 'bg-gray-500', icon: '⚪️' };
      case 'pending':
        return { text: 'Pending Verification', color: 'bg-yellow-500', icon: '⏳' };
      case 'active':
        return { text: 'Active', color: 'bg-green-500', icon: '✅' };
      case 'error_fetching':
        return { text: 'Error Loading Status', color: 'bg-red-500', icon: '❗️' };
      default:
        return { text: 'Unknown', color: 'bg-gray-400', icon: '❓' };
    }
  };

  const status_display = get_status_display();
  const button_text = payout_status === 'not_configured' ? 'Setup Payout Account' : 'Manage Payout Account';
  const is_button_disabled = is_loading_status || is_loading_onboarding || payout_status === 'error_fetching';

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Payout Setup</h1>

        {/* Loading Indicator */}
        {is_loading_status && (
          <div className="flex items-center justify-center p-4 mb-4 bg-blue-100 border border-blue-300 rounded-md">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-blue-700">Loading payout status...</span>
          </div>
        )}

        {/* General Error Message */}
        {error_message && !is_loading_status && (
          <div className="p-4 mb-4 bg-red-100 border border-red-300 rounded-md text-red-700">
            <strong>Error:</strong> {error_message}
          </div>
        )}

        {/* Feedback Message from Redirect */}
        {feedback_message && (
           <div className={`p-4 mb-4 rounded-md ${feedback_message.includes('success') || feedback_message.includes('finished') ? 'bg-green-100 border border-green-300 text-green-700' : 'bg-yellow-100 border border-yellow-300 text-yellow-700'}`}>
            {feedback_message}
          </div>
        )}

        {/* Status Display and Action Area (only if not loading initial status and no major error fetching) */}
        {!is_loading_status && payout_status !== 'error_fetching' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Current Payout Status</h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status_display.color} text-white`}>
                {status_display.icon}
                <span className="ml-1.5">{status_display.text}</span>
              </span>
            </div>

            <div className="mb-6 text-gray-600 space-y-2">
              <p>
                To receive payments for your orders, you need to connect your bank account through our secure payment partner, Stripe.
              </p>
              {payout_status === 'not_configured' && (
                <p>Click the button below to start the secure setup process. You will be redirected to Stripe to enter your details.</p>
              )}
              {(payout_status === 'pending' || payout_status === 'active') && (
                <p>You can manage your connected account details, view payout schedules, or update information by clicking the button below.</p>
              )}
               <p className="text-sm text-gray-500">
                StreetEats Hub does not store your full bank account details. All information is securely handled by Stripe. Payouts are typically processed [mention schedule, e.g., daily, weekly] after a standard holding period. Platform fees, if applicable, will be deducted before payout.
               </p>
               <p className="text-sm text-gray-500">
                 Need help? Visit our <a href="/support/payouts" className="text-indigo-600 hover:underline">Payouts FAQ</a>. {/* Adjust link as needed */}
               </p>
            </div>

            <div className="mt-6">
              <button
                onClick={initiate_onboarding}
                disabled={is_button_disabled}
                className={`w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white 
                           ${is_button_disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}
                           transition duration-150 ease-in-out`}
              >
                {is_loading_onboarding ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  button_text
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_OperatorPayoutConfiguration;