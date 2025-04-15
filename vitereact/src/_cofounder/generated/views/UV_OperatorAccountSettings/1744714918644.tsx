import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, add_notification, update_current_user, api_client } from '@/store/main';

// Define interfaces for local state based on datamap
interface ProfileFormInputs {
  first_name: string;
  last_name: string;
  email: string; // Typically read-only
  phone_number: string | null;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface NotificationPrefs {
  audible_alert_enabled: boolean;
}

type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

const UV_OperatorAccountSettings: React.FC = () => {
  const dispatch = useDispatch();
  const { current_user } = useSelector((state: RootState) => state.auth);

  // --- Local State ---
  const [form_inputs, set_form_inputs] = useState<ProfileFormInputs>({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: null,
  });
  const [password_form, set_password_form] = useState<PasswordForm>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [notification_prefs, set_notification_prefs] = useState<NotificationPrefs>({
    audible_alert_enabled: false, // Default, could be fetched if backend supports
  });
  const [account_update_status, set_account_update_status] = useState<ApiStatus>('idle');
  const [password_update_status, set_password_update_status] = useState<ApiStatus>('idle');
  const [error_message, set_error_message] = useState<string | null>(null);
  const [password_match_error, set_password_match_error] = useState<boolean>(false);
  const [initial_loading, set_initial_loading] = useState<boolean>(true);


  // --- Fetch Initial Data ---
  const fetch_account_settings = useCallback(async () => {
    set_initial_loading(true);
    set_error_message(null);
    try {
      // GET /users/me is assumed to be handled by api_client interceptor for token
      const response = await api_client.get('/users/me');
      const userData = response.data;
      set_form_inputs({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '', // Email fetched but field is read-only
        phone_number: userData.phone_number || '', // Treat null/undefined as empty string for input
      });
      // Fetch notification prefs if backend supports it and add to state
      // e.g., set_notification_prefs({ audible_alert_enabled: userData.audible_alert_enabled ?? false });
      set_initial_loading(false);
    } catch (err: any) {
      console.error("Error fetching account settings:", err);
      const message = err.response?.data?.error || 'Failed to load account settings.';
      set_error_message(message);
      dispatch(add_notification({ type: 'error', message }));
      set_initial_loading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetch_account_settings();
  }, [fetch_account_settings]);

  // --- Event Handlers ---
  const handle_profile_input_change = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    set_form_inputs(prev => ({ ...prev, [name]: value }));
  };

  const handle_password_input_change = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    set_password_form(prev => ({ ...prev, [name]: value }));
    // Reset password match error when user types
    if (name === 'new_password' || name === 'confirm_password') {
        set_password_match_error(false);
    }
  };

  const handle_notification_toggle = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    set_notification_prefs(prev => ({ ...prev, [name]: checked }));
    // NOTE: Saving this preference to backend is not explicitly supported by PUT /users/me spec provided.
    // This toggle will only update local state for now.
    // If backend supported it, it would be included in save_account_changes payload.
    console.log(`Notification preference '${name}' toggled to: ${checked} (Local state only)`);
    // Optionally, immediately dispatch a notification about the local change
    // dispatch(add_notification({ type: 'info', message: `Audible alerts ${checked ? 'enabled' : 'disabled'} (locally).` }));
  };

  // --- API Call Functions ---
  const save_account_changes = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    set_account_update_status('loading');
    set_error_message(null);

    // Prepare payload - only send editable fields
    const payload = {
        first_name: form_inputs.first_name,
        last_name: form_inputs.last_name,
        phone_number: form_inputs.phone_number || null, // Send null if empty string
        // Include notification prefs if backend supports saving them via PUT /users/me
        // ...notification_prefs,
    };

    try {
      const response = await api_client.put('/users/me', payload);
      set_account_update_status('success');
      dispatch(update_current_user(response.data)); // Update global state
      dispatch(add_notification({ type: 'success', message: 'Account information updated successfully.' }));
      // Reset status after a short delay
      setTimeout(() => set_account_update_status('idle'), 3000);
    } catch (err: any) {
      console.error("Error saving account changes:", err);
      const message = err.response?.data?.error || 'Failed to update account information.';
      set_error_message(message);
      set_account_update_status('error');
      dispatch(add_notification({ type: 'error', message }));
       // Optionally reset error status after delay
       // setTimeout(() => set_account_update_status('idle'), 5000);
    } finally {
        // Ensure loading stops even if timeout doesn't run (e.g., component unmounts)
        if (account_update_status === 'loading') {
             // Keep status as success/error for feedback, or reset to idle after timeout
             // set_account_update_status('idle');
        }
    }
  };

  const update_password = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    set_password_match_error(false);
    set_error_message(null);

    // Client-side validation
    if (password_form.new_password !== password_form.confirm_password) {
      set_password_match_error(true);
      const message = "New passwords do not match.";
      set_error_message(message);
      set_password_update_status('error');
      dispatch(add_notification({ type: 'error', message }));
      return;
    }
    if (password_form.new_password.length < 6) {
      const message = "New password must be at least 6 characters long.";
      set_error_message(message);
      set_password_update_status('error');
      dispatch(add_notification({ type: 'error', message }));
      return;
    }

    set_password_update_status('loading');

    const payload = {
      current_password: password_form.current_password,
      new_password: password_form.new_password,
    };

    try {
      await api_client.put('/users/me/password', payload);
      set_password_update_status('success');
      set_password_form({ current_password: '', new_password: '', confirm_password: '' }); // Clear form
      dispatch(add_notification({ type: 'success', message: 'Password updated successfully.' }));
       // Reset status after a short delay
      setTimeout(() => set_password_update_status('idle'), 3000);
    } catch (err: any) {
      console.error("Error updating password:", err);
      const message = err.response?.data?.error || 'Failed to update password.';
      set_error_message(message);
      set_password_update_status('error');
      dispatch(add_notification({ type: 'error', message }));
        // Optionally reset error status after delay
       // setTimeout(() => set_password_update_status('idle'), 5000);
    } finally {
         if (password_update_status === 'loading') {
             // Keep status as success/error for feedback, or reset to idle after timeout
             // set_password_update_status('idle');
        }
    }
  };

  // --- Render Logic ---
  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Account Settings</h1>

        {initial_loading ? (
             <div className="text-center py-10">
                <p className="text-gray-500">Loading account settings...</p>
                {/* Optional: Add a spinner here */}
            </div>
        ) : error_message && form_inputs.email === '' ? ( // Show loading error only if data couldn't be fetched initially
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error_message}</span>
            </div>
        ) : (
          <div className="space-y-10">

            {/* --- Operator Information Section --- */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 border-b pb-2">Operator Information</h2>
              <form onSubmit={save_account_changes} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={form_inputs.first_name}
                      onChange={handle_profile_input_change}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={form_inputs.last_name}
                      onChange={handle_profile_input_change}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={form_inputs.email}
                    readOnly // Email change requires specific flow, not part of basic update
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                   <p className="text-xs text-gray-500 mt-1">Email address cannot be changed here.</p>
                </div>
                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">Contact Phone Number</label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={form_inputs.phone_number || ''}
                    onChange={handle_profile_input_change}
                    placeholder="e.g., 555-123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-4 pt-4">
                   {account_update_status === 'error' && error_message && !password_match_error && (
                        <p className="text-sm text-red-600">{error_message}</p>
                    )}
                    {account_update_status === 'success' && (
                        <p className="text-sm text-green-600">Profile updated successfully!</p>
                    )}
                  <button
                    type="submit"
                    disabled={account_update_status === 'loading'}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      account_update_status === 'loading'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {account_update_status === 'loading' ? 'Saving...' : 'Save Account Changes'}
                  </button>
                </div>
              </form>
            </section>

             {/* --- Change Password Section --- */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 border-b pb-2">Change Password</h2>
              <form onSubmit={update_password} className="space-y-4">
                <div>
                  <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    id="current_password"
                    name="current_password"
                    value={password_form.current_password}
                    onChange={handle_password_input_change}
                    required
                    autoComplete="current-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    id="new_password"
                    name="new_password"
                    value={password_form.new_password}
                    onChange={handle_password_input_change}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                   <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long.</p>
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    value={password_form.confirm_password}
                    onChange={handle_password_input_change}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        password_match_error ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {password_match_error && (
                    <p className="text-xs text-red-600 mt-1">New passwords do not match.</p>
                  )}
                </div>

                 <div className="flex items-center justify-end space-x-4 pt-4">
                    {password_update_status === 'error' && error_message && (
                        <p className="text-sm text-red-600">{error_message}</p>
                    )}
                    {password_update_status === 'success' && (
                        <p className="text-sm text-green-600">Password updated successfully!</p>
                    )}
                  <button
                    type="submit"
                    disabled={password_update_status === 'loading'}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      password_update_status === 'loading'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {password_update_status === 'loading' ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </section>

             {/* --- Notification Preferences Section --- */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 border-b pb-2">Notification Preferences</h2>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    id="audible_alert_enabled"
                    name="audible_alert_enabled"
                    type="checkbox"
                    checked={notification_prefs.audible_alert_enabled}
                    onChange={handle_notification_toggle}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="audible_alert_enabled" className="ml-2 block text-sm text-gray-900">
                    Enable Audible Alert for New Orders (Dashboard)
                  </label>
                </div>
                 <p className="text-xs text-gray-500 ml-6">Controls the sound alert on your dashboard when a new order arrives.</p>
                 {/* Add more toggles here if needed */}
              </div>
               {/* Note: No separate save button here. These preferences would ideally be saved with 'Save Account Changes' if backend supports it. */}
               <p className="text-xs text-gray-500 mt-2">Note: Saving notification preferences to the server is not fully implemented in this MVP version.</p>
            </section>

          </div>
        )}
      </div>
    </>
  );
};

export default UV_OperatorAccountSettings;