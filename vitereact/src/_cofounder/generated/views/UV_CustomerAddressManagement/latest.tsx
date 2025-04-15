import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { api_client } from '@/store/main'; // Assuming api_client handles auth headers
import { add_notification } from '@/store/main'; // Import add_notification
import { useDispatch } from 'react-redux'; // Import useDispatch


// Interface matching the backend schema for an address
interface Address {
  uid: string;
  nickname: string;
  street_address: string;
  apt_suite: string | null;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

// Interface for the form input state
interface AddressFormInput {
  nickname: string;
  street_address: string;
  apt_suite: string | null;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

const UV_CustomerAddressManagement: React.FC = () => {
  const dispatch = useDispatch(); // Hook to dispatch actions like notifications

  // State variables defined in datamap
  const [addressesList, setAddressesList] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState<boolean>(false);
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null);
  const [addEditFormInput, setAddEditFormInput] = useState<AddressFormInput>({
    nickname: "",
    street_address: "",
    apt_suite: null,
    city: "",
    state: "",
    zip_code: "",
    is_default: false,
  });
  const [addEditModalStatus, setAddEditModalStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [addEditModalError, setAddEditModalError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null); // Stores UID of address to delete

  // --- Action Implementations ---

  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api_client.get<Address[]>('/users/me/addresses');
      setAddressesList(response.data);
    } catch (error: any) {
      console.error("Error fetching addresses:", error);
      const message = error.response?.data?.error || 'Failed to load addresses.';
      setErrorMessage(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  const openAddModal = useCallback(() => {
    setAddressToEdit(null);
    setAddEditFormInput({
      nickname: "", street_address: "", apt_suite: null, city: "", state: "", zip_code: "", is_default: false,
    });
    setAddEditModalStatus('idle');
    setAddEditModalError(null);
    setIsAddEditModalOpen(true);
  }, []);

  const openEditModal = useCallback((address: Address) => {
    setAddressToEdit(address);
    setAddEditFormInput({
      nickname: address.nickname,
      street_address: address.street_address,
      apt_suite: address.apt_suite,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      is_default: address.is_default,
    });
    setAddEditModalStatus('idle');
    setAddEditModalError(null);
    setIsAddEditModalOpen(true);
  }, []);

  const closeAddEditModal = useCallback(() => {
    setIsAddEditModalOpen(false);
    setAddressToEdit(null); // Clear edit context
    // Optionally clear form input here too if desired
  }, []);

  const submitAddEditAddress = useCallback(async () => {
    // Basic Validation
    if (!addEditFormInput.nickname || !addEditFormInput.street_address || !addEditFormInput.city || !addEditFormInput.state || !addEditFormInput.zip_code) {
      setAddEditModalError('Please fill in all required fields (Nickname, Street, City, State, Zip).');
      return;
    }

    setAddEditModalStatus('loading');
    setAddEditModalError(null);

    try {
      let response;
      const payload: AddressFormInput = {
        ...addEditFormInput,
        // Ensure apt_suite is null if empty string, otherwise keep its value
        apt_suite: addEditFormInput.apt_suite?.trim() || null,
      };

      if (addressToEdit) {
        // Editing existing address
        response = await api_client.put(`/users/me/addresses/${addressToEdit.uid}`, payload);
      } else {
        // Adding new address
        response = await api_client.post('/users/me/addresses', payload);
      }

      if (response.status === 200 || response.status === 201) {
        setAddEditModalStatus('idle');
        closeAddEditModal();
        await fetchAddresses(); // Refresh the list
        dispatch(add_notification({ type: 'success', message: `Address ${addressToEdit ? 'updated' : 'added'} successfully.` }));
      } else {
         // This case might not be reached if axios throws for non-2xx status
         throw new Error(response.data?.error || `Failed to ${addressToEdit ? 'update' : 'add'} address.`);
      }
    } catch (error: any) {
      console.error(`Error ${addressToEdit ? 'updating' : 'adding'} address:`, error);
      const message = error.response?.data?.error || `Failed to ${addressToEdit ? 'update' : 'add'} address.`;
      setAddEditModalStatus('error');
      setAddEditModalError(message);
      dispatch(add_notification({ type: 'error', message }));
    }
  }, [addEditFormInput, addressToEdit, fetchAddresses, closeAddEditModal, dispatch]);

  const confirmDeleteAddress = useCallback((addressUid: string) => {
    setDeleteConfirmation(addressUid);
  }, []);

  const cancelDeleteAddress = useCallback(() => {
    setDeleteConfirmation(null);
  }, []);

  const executeDeleteAddress = useCallback(async () => {
    if (!deleteConfirmation) return;

    setIsLoading(true); // Use general loading for delete
    setErrorMessage(null);
    const addressUidToDelete = deleteConfirmation;
    setDeleteConfirmation(null); // Close confirmation modal immediately

    try {
      const response = await api_client.delete(`/users/me/addresses/${addressUidToDelete}`);
      if (response.status === 200) {
        await fetchAddresses(); // Refresh list
        dispatch(add_notification({ type: 'success', message: 'Address deleted successfully.' }));
      } else {
        throw new Error(response.data?.error || 'Failed to delete address.');
      }
    } catch (error: any) {
      console.error("Error deleting address:", error);
      const message = error.response?.data?.error || 'Failed to delete address.';
      setErrorMessage(message);
      dispatch(add_notification({ type: 'error', message }));
    } finally {
      // setIsLoading(false); // fetchAddresses will handle setting loading to false
    }
  }, [deleteConfirmation, fetchAddresses, dispatch]);

  const setDefaultAddress = useCallback(async (addressUid: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api_client.put(`/users/me/addresses/${addressUid}`, { is_default: true });
       if (response.status === 200) {
        await fetchAddresses(); // Refresh list to show new default
        dispatch(add_notification({ type: 'success', message: 'Default address updated.' }));
      } else {
        throw new Error(response.data?.error || 'Failed to set default address.');
      }
    } catch (error: any) {
      console.error("Error setting default address:", error);
      const message = error.response?.data?.error || 'Failed to set default address.';
      setErrorMessage(message);
      dispatch(add_notification({ type: 'error', message }));
       // setIsLoading(false); // fetchAddresses will handle setting loading to false
    }
  }, [fetchAddresses, dispatch]);

  // --- Effects ---

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // --- Event Handlers ---

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddEditFormInput(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setAddEditFormInput(prev => ({ ...prev, [name]: checked }));
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitAddEditAddress();
  };

  // --- Render ---

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Addresses</h1>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 text-right">
          <button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
          >
            + Add New Address
          </button>
        </div>

        {isLoading && !isAddEditModalOpen && !deleteConfirmation && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading addresses...</p>
          </div>
        )}

        {!isLoading && addressesList.length === 0 && (
          <div className="text-center py-10 bg-gray-100 rounded-lg">
            <p className="text-gray-500">You have no saved addresses.</p>
            <p className="mt-2 text-sm text-gray-400">Add an address to speed up checkout!</p>
          </div>
        )}

        {!isLoading && addressesList.length > 0 && (
          <div className="space-y-4">
            {addressesList.map((address) => (
              <div key={address.uid} className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0 flex-grow">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    {address.nickname}
                    {address.is_default && (
                      <span className="ml-2 inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {address.street_address}
                    {address.apt_suite ? `, ${address.apt_suite}` : ''}
                    <br />
                    {address.city}, {address.state} {address.zip_code}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setDefaultAddress(address.uid)}
                    disabled={address.is_default || isLoading}
                    className={`text-xs py-1 px-3 rounded transition duration-150 ease-in-out ${
                      address.is_default
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                    } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    Set Default
                  </button>
                  <button
                    onClick={() => openEditModal(address)}
                    disabled={isLoading}
                    className={`text-xs py-1 px-3 rounded transition duration-150 ease-in-out bg-yellow-100 hover:bg-yellow-200 text-yellow-800 ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDeleteAddress(address.uid)}
                    disabled={isLoading}
                    className={`text-xs py-1 px-3 rounded transition duration-150 ease-in-out bg-red-100 hover:bg-red-200 text-red-800 ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              {addressToEdit ? 'Edit Address' : 'Add New Address'}
            </h2>

            {addEditModalError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {addEditModalError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">Nickname *</label>
                  <input type="text" name="nickname" id="nickname" value={addEditFormInput.nickname} onChange={handleInputChange} required
                         className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="street_address" className="block text-sm font-medium text-gray-700">Street Address *</label>
                  <input type="text" name="street_address" id="street_address" value={addEditFormInput.street_address} onChange={handleInputChange} required
                         className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="apt_suite" className="block text-sm font-medium text-gray-700">Apt/Suite (Optional)</label>
                  <input type="text" name="apt_suite" id="apt_suite" value={addEditFormInput.apt_suite || ''} onChange={handleInputChange}
                         className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">City *</label>
                    <input type="text" name="city" id="city" value={addEditFormInput.city} onChange={handleInputChange} required
                           className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">State *</label>
                    <input type="text" name="state" id="state" value={addEditFormInput.state} onChange={handleInputChange} required maxLength={2} // Example: 2-letter state code
                           className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">Zip Code *</label>
                    <input type="text" name="zip_code" id="zip_code" value={addEditFormInput.zip_code} onChange={handleInputChange} required
                           className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" name="is_default" id="is_default" checked={addEditFormInput.is_default} onChange={handleCheckboxChange}
                         className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">Set as default address</label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={closeAddEditModal}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition duration-150 ease-in-out">
                  Cancel
                </button>
                <button type="submit" disabled={addEditModalStatus === 'loading'}
                        className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out ${
                          addEditModalStatus === 'loading' ? 'opacity-50 cursor-wait' : ''
                        }`}>
                  {addEditModalStatus === 'loading' ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Confirm Deletion</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this address?</p>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={cancelDeleteAddress}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition duration-150 ease-in-out">
                Cancel
              </button>
              <button type="button" onClick={executeDeleteAddress}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CustomerAddressManagement;