import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api_client } from '@/store/main'; // Use the configured Axios instance

// --- TypeScript Interfaces based on datamap ---

interface ModifierOption {
  option_uid: string;
  option_name: string;
  price_adjustment: number;
}

interface ModifierGroup {
  group_uid: string;
  group_name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  options: ModifierOption[];
}

interface MenuItem {
  item_uid: string;
  item_name: string;
  description: string | null;
  base_price: number;
  photo_url: string | null;
  is_available: boolean;
  modifier_groups: ModifierGroup[];
}

interface MenuCategory {
  category_uid: string;
  category_name: string;
  is_available: boolean;
  items: MenuItem[];
}

type MenuData = MenuCategory[] | null;

interface TruckDetails {
  uid: string;
  name: string;
  description: string | null;
  cuisine_type: string;
  logo_url: string | null;
  standard_operating_hours: Record<string, string> | null;
  current_status: 'online' | 'offline' | 'paused';
  current_location_address: string | null;
  delivery_settings: {
    enabled: boolean;
    fee: number | null;
    minimum_order_value: number | null;
    radius_km: number | null;
  };
  average_preparation_minutes: number | null;
  customer_support_phone_number: string | null;
}

interface SelectedItem {
  item_uid: string;
  item_name: string;
  description: string | null;
  base_price: number;
  modifier_groups: ModifierGroup[];
}

// --- Helper Function for Status Display ---
const get_status_display = (status: 'online' | 'offline' | 'paused'): { text: string; color: string } => {
  switch (status) {
    case 'online':
      return { text: 'Open - Accepting Orders', color: 'bg-green-500' };
    case 'paused':
      return { text: 'Temporarily Not Accepting New Orders', color: 'bg-yellow-500' };
    case 'offline':
      return { text: 'Closed', color: 'bg-red-500' };
    default:
      return { text: 'Status Unknown', color: 'bg-gray-500' };
  }
};

// --- Helper Function to format price ---
const format_price = (price: number): string => {
    return price.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// --- Helper Function to format operating hours ---
const format_operating_hours = (hours: Record<string, string> | null): string => {
    if (!hours) return 'Not specified';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => `${day}: ${hours[day] || 'Closed'}`).join(', ');
};

// --- React Component ---

const UV_CustomerTruckProfileMenu: React.FC = () => {
  const { truck_uid } = useParams<{ truck_uid: string }>();

  const [truckDetails, setTruckDetails] = useState<TruckDetails | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCustomizationViewOpen, setIsCustomizationViewOpen] = useState<boolean>(false);
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState<SelectedItem | null>(null);

  // Action: fetchTruckAndMenu
  useEffect(() => {
    const fetchTruckAndMenu = async () => {
      if (!truck_uid) {
        setErrorMessage('Truck identifier is missing.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Note: include_unavailable=true might be needed if operator menu structure is different
        // Adjust query param if necessary based on how GET /food_trucks/{uid} handles menu for customers vs operators
        const response = await api_client.get(`/food_trucks/${truck_uid}?include_unavailable=false`); // Fetch only available for customer view by default
        const data = response.data;

        // Validate and set state - assuming backend response matches TruckDetails & MenuData structure
        setTruckDetails({
          uid: data.uid,
          name: data.name,
          description: data.description,
          cuisine_type: data.cuisine_type,
          logo_url: data.logo_url,
          standard_operating_hours: data.standard_operating_hours,
          current_status: data.current_status,
          current_location_address: data.current_location_address,
          delivery_settings: data.delivery_settings,
          average_preparation_minutes: data.average_preparation_minutes,
          customer_support_phone_number: data.customer_support_phone_number,
        });
        setMenuData(data.menu);

      } catch (error: any) {
        console.error('Error fetching truck details:', error);
        if (error.response?.status === 404) {
          setErrorMessage('Food truck not found.');
        } else {
          setErrorMessage(error.response?.data?.error || 'Failed to load truck details. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTruckAndMenu();
  }, [truck_uid]);

  // Action: openItemCustomization
  const openItemCustomization = (item: MenuItem) => {
    const item_to_customize: SelectedItem = {
      item_uid: item.item_uid,
      item_name: item.item_name,
      description: item.description,
      base_price: item.base_price,
      modifier_groups: item.modifier_groups,
    };
    setSelectedItemForCustomization(item_to_customize);
    setIsCustomizationViewOpen(true);
  };

  // Action: closeItemCustomization
  const closeItemCustomization = () => {
    setIsCustomizationViewOpen(false);
    setSelectedItemForCustomization(null);
  };

  // --- Render Logic ---
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        {/* --- Loading State --- */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading truck details...</p>
          </div>
        )}

        {/* --- Error State --- */}
        {errorMessage && !isLoading && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errorMessage}</span>
            <div className="mt-4">
                <Link to="/trucks" className="text-blue-500 hover:underline">Back to Truck List</Link>
            </div>
          </div>
        )}

        {/* --- Loaded State --- */}
        {!isLoading && !errorMessage && truckDetails && (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            {/* --- Truck Header Area --- */}
            <div className="md:flex">
              <div className="md:flex-shrink-0">
                <img
                  className="h-48 w-full object-cover md:w-48"
                  src={truckDetails.logo_url || `https://picsum.photos/seed/${truckDetails.uid}/400/300`}
                  alt={`${truckDetails.name} logo`}
                />
              </div>
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">{truckDetails.cuisine_type}</div>
                        <h1 className="block mt-1 text-3xl leading-tight font-bold text-black">{truckDetails.name}</h1>
                        {truckDetails.description && <p className="mt-2 text-gray-500">{truckDetails.description}</p>}
                    </div>
                    <div className={`text-sm font-medium text-white px-3 py-1 rounded-full ${get_status_display(truckDetails.current_status).color}`}>
                        {get_status_display(truckDetails.current_status).text}
                    </div>
                </div>
              </div>
            </div>

            {/* --- Truck Information Section --- */}
            <div className="border-t border-gray-200 px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Location & Hours</h3>
                    <p className="text-gray-600">
                        <span className="font-medium">Current Location:</span> {truckDetails.current_location_address || 'Not specified'}
                    </p>
                    <p className="text-gray-600 mt-1">
                        <span className="font-medium">Standard Hours:</span> {format_operating_hours(truckDetails.standard_operating_hours)}
                    </p>
                    {truckDetails.customer_support_phone_number && (
                        <p className="text-gray-600 mt-1">
                            <span className="font-medium">Contact:</span> {truckDetails.customer_support_phone_number}
                        </p>
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Ordering Options</h3>
                     <p className="text-gray-600">
                        <span className="font-medium">Pickup Address:</span> {truckDetails.current_location_address || 'See Current Location'}
                    </p>
                    {truckDetails.delivery_settings.enabled ? (
                        <div className="mt-2 border border-blue-200 bg-blue-50 p-3 rounded">
                            <p className="text-blue-800 font-medium">Delivery Available!</p>
                            <p className="text-blue-700 text-sm">
                                Fee: {format_price(truckDetails.delivery_settings.fee || 0)} |
                                Min Order: {format_price(truckDetails.delivery_settings.minimum_order_value || 0)} |
                                Radius: {truckDetails.delivery_settings.radius_km} km
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-500 mt-2">Delivery currently unavailable.</p>
                    )}
                     <p className="text-gray-600 mt-1">
                        <span className="font-medium">Avg. Prep Time:</span> {truckDetails.average_preparation_minutes ? `${truckDetails.average_preparation_minutes} mins` : 'Not specified'}
                    </p>
                </div>
            </div>

            {/* --- Menu Section --- */}
            <div className="border-t border-gray-200 px-8 py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Menu</h2>
              {menuData && menuData.length > 0 ? (
                menuData.map((category) => (
                  <div key={category.category_uid} className="mb-8">
                    <h3 className={`text-xl font-semibold text-gray-800 mb-4 ${!category.is_available ? 'text-gray-400 line-through' : ''}`}>
                        {category.category_name} {!category.is_available && <span className="text-sm font-normal text-red-500 ml-2">(Unavailable)</span>}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {category.items.map((item) => {
                        const is_orderable = truckDetails.current_status === 'online' && category.is_available && item.is_available;
                        return (
                          <div
                            key={item.item_uid}
                            className={`border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col ${!is_orderable ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
                          >
                            {item.photo_url && (
                              <img
                                className="h-40 w-full object-cover"
                                src={item.photo_url}
                                alt={item.item_name}
                              />
                            )}
                             {!item.photo_url && (
                              <img
                                className="h-40 w-full object-cover bg-gray-100"
                                src={`https://picsum.photos/seed/${item.item_uid}/300/200`}
                                alt={item.item_name}
                              />
                            )}
                            <div className="p-4 flex flex-col flex-grow">
                              <h4 className={`text-lg font-semibold text-gray-900 ${!item.is_available ? 'text-gray-400 line-through' : ''}`}>
                                {item.item_name}
                              </h4>
                              {item.description && <p className="text-sm text-gray-600 mt-1 flex-grow">{item.description}</p>}
                              <div className="mt-4 flex justify-between items-center">
                                <span className={`text-lg font-bold ${!item.is_available ? 'text-gray-400' : 'text-gray-900'}`}>{format_price(item.base_price)}</span>
                                <button
                                  onClick={() => openItemCustomization(item)}
                                  disabled={!is_orderable}
                                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                    is_orderable
                                      ? 'bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
                                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {item.is_available ? 'Add' : 'Unavailable'}
                                </button>
                              </div>
                               {!item.is_available && category.is_available && <span className="text-xs font-normal text-red-500 mt-1 text-right">Item Unavailable</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">The menu is currently empty or unavailable.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- Item Customization Modal Placeholder --- */}
      {isCustomizationViewOpen && selectedItemForCustomization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Customize: {selectedItemForCustomization.item_name}</h3>
            <p className="text-gray-600 mb-2">Base Price: {format_price(selectedItemForCustomization.base_price)}</p>
            {selectedItemForCustomization.description && <p className="text-sm text-gray-500 mb-4">{selectedItemForCustomization.description}</p>}

            {/* Placeholder for actual customization options */}
            <div className="my-4 p-4 border border-dashed border-gray-300 rounded text-center text-gray-500">
              <p>Item customization options would appear here.</p>
              <p>(Requires UV_CustomerItemCustomization component)</p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeItemCustomization}
                className="px-4 py-2 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
              >
                Cancel
              </button>
              {/* The "Add to Cart" button would normally be inside the real customization component */}
               <button
                onClick={() => {
                    // In a real scenario, this button would be inside UV_CustomerItemCustomization
                    // and would dispatch add_cart_item before closing.
                    console.log("Placeholder: Add to cart logic would execute here.");
                    closeItemCustomization();
                 }}
                className="px-4 py-2 rounded text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Add to Cart (Placeholder)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CustomerTruckProfileMenu;