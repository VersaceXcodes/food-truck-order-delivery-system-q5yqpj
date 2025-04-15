import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { api_client, add_notification, update_current_user, RootState } from '@/store/main'; // Assuming store exports these

// Define the ProfileData interface based on the datamap
interface ProfileData {
  first_name: string;
  last_name: string;
  email: string; // Read-only
  phone_number: string | null;
}

const UV_CustomerProfile: React.FC = () => {
  const dispatch = useDispatch();

  // Global state access
  const user_email = useSelector((state: RootState) => state.auth.current_user?.email);

  // Local state variables
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    email: user_email || '', // Initialize with global email
    phone_number: null,
  });
  const [formInputFirstName, setFormInputFirstName] = useState('');
  const [formInputLastName, setFormInputLastName] = useState('');
  const [formInputPhoneNumber, setFormInputPhoneNumber] = useState('');

  const [passwordFormInputCurrent, setPasswordFormInputCurrent] = useState('');
  const [passwordFormInputNew, setPasswordFormInputNew] = useState('');
  const [passwordFormInputConfirm, setPasswordFormInputConfirm] = useState('');

  const [profileUpdateStatus, setProfileUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [passwordUpdateStatus, setPasswordUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);

  // Action: Fetch Profile
  const fetchProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setErrorMessage(null);
    try {
      const response = await api_client.get<ProfileData>('/users/me');
      setProfileData(response.data);
      setFormInputFirstName(response.data.first_name || '');
      setFormInputLastName(response.data.last_name || '');
      setFormInputPhoneNumber(response.data.phone_number || '');
      setIsLoadingProfile(false);
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      const error_message = error.response?.data?.error || 'Failed to load profile data.';
      setErrorMessage(error_message);
      dispatch(add_notification({ type: 'error', message: error_message }));
      setIsLoadingProfile(false);
    }
  }, [dispatch]);

  // Trigger fetchProfile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Action: Save Profile Changes
  const handle_save_profile_changes = async (e: FormEvent) => {
    e.preventDefault();
    setProfileUpdateStatus('loading');
    setErrorMessage(null);

    const payload: Partial<ProfileData> = {};
    if (formInputFirstName !== profileData.first_name) {
      payload.first_name = formInputFirstName;
    }
    if (formInputLastName !== profileData.last_name) {
      payload.last_name = formInputLastName;
    }
    // Handle phone number potentially being null or empty string vs original null
    const current_phone = profileData.phone_number || "";
    const new_phone = formInputPhoneNumber || "";
    if (new_phone !== current_phone) {
        payload.phone_number = new_phone || null; // Send null if empty string
    }


    // Only send request if there are actual changes
    if (Object.keys(payload).length === 0) {
        setProfileUpdateStatus('idle');
        dispatch(add_notification({ type: 'info', message: 'No changes detected.' }));
        return;
    }

    try {
      const response = await api_client.put<ProfileData>('/users/me', payload);
      setProfileData(response.data); // Update local profile data with response
      setFormInputFirstName(response.data.first_name || '');
      setFormInputLastName(response.data.last_name || '');
      setFormInputPhoneNumber(response.data.phone_number || '');
      setProfileUpdateStatus('success');
      dispatch(add_notification({ type: 'success', message: 'Profile updated successfully.' }));
      // Optionally update global state if needed (first_name/last_name aren't typically global)
      // dispatch(update_current_user({ first_name: response.data.first_name, last_name: response.data.last_name, phone_number: response.data.phone_number }));
      setTimeout(() => setProfileUpdateStatus('idle'), 3000); // Reset status after delay

    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const error_message = error.response?.data?.error || 'Failed to update profile.';
      setErrorMessage(error_message);
      setProfileUpdateStatus('error');
      dispatch(add_notification({ type: 'error', message: error_message }));
    }
  };

  // Action: Update Password
  const handle_update_password = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validation
    if (!passwordFormInputCurrent || !passwordFormInputNew || !passwordFormInputConfirm) {
        setErrorMessage("All password fields are required.");
        dispatch(add_notification({ type: 'warning', message: 'All password fields are required.' }));
        return;
    }
    if (passwordFormInputNew.length < 6) {
        setErrorMessage("New password must be at least 6 characters long.");
        dispatch(add_notification({ type: 'warning', message: 'New password must be at least 6 characters long.' }));
        return;
    }
    if (passwordFormInputNew !== passwordFormInputConfirm) {
        setErrorMessage("New passwords do not match.");
        dispatch(add_notification({ type: 'warning', message: 'New passwords do not match.' }));
        return;
    }

    setPasswordUpdateStatus('loading');
    try {
      await api_client.put('/users/me/password', {
        current_password: passwordFormInputCurrent,
        new_password: passwordFormInputNew,
      });
      setPasswordUpdateStatus('success');
      setPasswordFormInputCurrent('');
      setPasswordFormInputNew('');
      setPasswordFormInputConfirm('');
      dispatch(add_notification({ type: 'success', message: 'Password updated successfully.' }));
      setTimeout(() => setPasswordUpdateStatus('idle'), 3000); // Reset status

    } catch (error: any) {
      console.error('Failed to update password:', error);
      const error_message = error.response?.data?.error || 'Failed to update password.';
      setErrorMessage(error_message);
      setPasswordUpdateStatus('error');
      dispatch(add_notification({ type: 'error', message: error_message }));
    }
  };

  // --- Render ---
  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Your Profile</h1>

        {isLoadingProfile && (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-3 text-gray-600">Loading profile...</p>
          </div>
        )}

        {!isLoadingProfile && errorMessage && profileData.email === '' && ( // Show critical load error only if profile never loaded
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{errorMessage}</span>
            </div>
        )}

        {!isLoadingProfile && profileData.email && ( // Only render forms if profile loaded successfully
          <div className="space-y-10">
            {/* --- Personal Information Section --- */}
            <form onSubmit={handle_save_profile_changes} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Personal Information</h2>

              {profileUpdateStatus === 'error' && errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm mb-4" role="alert">
                    {errorMessage}
                </div>
              )}
               {profileUpdateStatus === 'success' && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded text-sm mb-4" role="alert">
                    Profile updated successfully!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    value={formInputFirstName}
                    onChange={(e) => setFormInputFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    value={formInputLastName}
                    onChange={(e) => setFormInputLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email} // Display from fetched data
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed sm:text-sm"
                />
                 <p className="mt-1 text-xs text-gray-500">Email address cannot be changed.</p>
              </div>

              <div className="mb-6">
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="tel" // Use tel type for potential mobile benefits
                  id="phone_number"
                  value={formInputPhoneNumber}
                  onChange={(e) => setFormInputPhoneNumber(e.target.value)}
                  placeholder="e.g., 555-123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={profileUpdateStatus === 'loading'}
                  className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                    profileUpdateStatus === 'loading'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
                >
                  {profileUpdateStatus === 'loading' ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Profile Changes'
                  )}
                </button>
              </div>
            </form>

            {/* --- Change Password Section --- */}
            <form onSubmit={handle_update_password} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Change Password</h2>

                {passwordUpdateStatus === 'error' && errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm mb-4" role="alert">
                        {errorMessage}
                    </div>
                )}
                {passwordUpdateStatus === 'success' && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded text-sm mb-4" role="alert">
                        Password updated successfully!
                    </div>
                )}

              <div className="mb-4">
                <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="current_password"
                  value={passwordFormInputCurrent}
                  onChange={(e) => setPasswordFormInputCurrent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="new_password"
                  value={passwordFormInputNew}
                  onChange={(e) => setPasswordFormInputNew(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                />
                 <p id="password-rules" className="mt-1 text-xs text-gray-500">Must be at least 6 characters long.</p>
              </div>

              <div className="mb-6">
                <label htmlFor="confirm_new_password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirm_new_password"
                  value={passwordFormInputConfirm}
                  onChange={(e) => setPasswordFormInputConfirm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordUpdateStatus === 'loading'}
                   className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                    passwordUpdateStatus === 'loading'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                >
                  {passwordUpdateStatus === 'loading' ? (
                     <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_CustomerProfile;