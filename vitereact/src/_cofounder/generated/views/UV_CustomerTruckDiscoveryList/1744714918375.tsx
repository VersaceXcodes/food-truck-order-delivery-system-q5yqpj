import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api_client } from '@/store/main'; // Use the configured Axios instance
import debounce from 'lodash.debounce';

// --- Types ---

interface TruckSummary {
  uid: string;
  name: string;
  cuisine_type: string;
  current_status: 'online' | 'offline' | 'paused';
  location_latitude: number | null;
  location_longitude: number | null;
  logo_url: string | null;
  distance_km?: number | null; // Optional, calculated if location provided
}

type TrucksList = TruckSummary[];

interface FilterLocation {
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  display_name: string | null;
  source: 'browser' | 'manual' | 'default' | 'url';
}

type SortByType = 'distance' | 'name';

type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable';

// --- Component ---

const UV_CustomerTruckDiscoveryList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- State Variables ---
  const [trucksList, setTrucksList] = useState<TrucksList>([]);
  const [filterLocation, setFilterLocation] = useState<FilterLocation>(() => {
    const lat = searchParams.get('latitude');
    const lon = searchParams.get('longitude');
    const rad = searchParams.get('radius_km') ?? '10'; // Default radius 10km
    if (lat && lon) {
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        radius_km: parseFloat(rad),
        display_name: `Near specified coordinates`, // Potentially improve later
        source: 'url',
      };
    }
    return {
      latitude: null,
      longitude: null,
      radius_km: parseFloat(rad),
      display_name: null,
      source: 'default',
    };
  });
  const [filterCuisineType, setFilterCuisineType] = useState<string>(searchParams.get('cuisine_type') ?? '');
  const [filterSearchTerm, setFilterSearchTerm] = useState<string>(searchParams.get('search_term') ?? '');
  const [sortBy, setSortBy] = useState<SortByType>(filterLocation.latitude ? 'distance' : 'name'); // Default sort based on initial location
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<LocationPermissionStatus>('prompt');

  // --- Actions ---

  // Helper to update state and URL search params
  const updateFiltersAndUrl = useCallback((updates: {
    location?: Partial<FilterLocation>;
    cuisine?: string;
    search?: string;
    sort?: SortByType;
  }) => {
    const newParams = new URLSearchParams(searchParams);
    let needsFetch = false;
    let newLocation = filterLocation;

    if (updates.location !== undefined) {
        newLocation = { ...filterLocation, ...updates.location };
        setFilterLocation(newLocation);
        if (newLocation.latitude !== null && newLocation.longitude !== null) {
            newParams.set('latitude', newLocation.latitude.toString());
            newParams.set('longitude', newLocation.longitude.toString());
            newParams.set('radius_km', newLocation.radius_km.toString());
        } else {
            newParams.delete('latitude');
            newParams.delete('longitude');
            // Keep radius? Or remove? Let's keep it for potential manual re-enable
        }
        needsFetch = true;
    }
    if (updates.cuisine !== undefined) {
        setFilterCuisineType(updates.cuisine);
        if (updates.cuisine) {
            newParams.set('cuisine_type', updates.cuisine);
        } else {
            newParams.delete('cuisine_type');
        }
         needsFetch = true;
    }
    if (updates.search !== undefined) {
        setFilterSearchTerm(updates.search);
        if (updates.search) {
            newParams.set('search_term', updates.search);
        } else {
            newParams.delete('search_term');
        }
         needsFetch = true;
    }
     if (updates.sort !== undefined) {
        setSortBy(updates.sort);
        // Sorting is client-side based on backend example, no refetch needed just for sort change
    }

    setSearchParams(newParams, { replace: true });

    // Trigger fetch if relevant filters changed
    // Debounced search handles its own fetch trigger
    if (needsFetch && updates.search === undefined) { // Avoid double fetch with debounced search
        fetchTrucks(newLocation, updates.cuisine ?? filterCuisineType, filterSearchTerm);
    }

  }, [searchParams, setSearchParams, filterLocation, filterCuisineType, filterSearchTerm, sortBy]);


  // Fetch Trucks Function
  const fetchTrucks = useCallback(async (
      location: FilterLocation,
      cuisine: string,
      search: string
    ) => {
        setIsLoading(true);
        setErrorMessage(null);
        console.log('Fetching trucks with:', { location, cuisine, search });

        const params: Record<string, string> = { status: 'online' };
        if (location.latitude !== null && location.longitude !== null) {
            params.latitude = location.latitude.toString();
            params.longitude = location.longitude.toString();
            params.radius_km = location.radius_km.toString();
        }
        if (cuisine) {
            params.cuisine_type = cuisine;
        }
        if (search) {
            params.search_term = search;
        }

        try {
            const response = await api_client.get<TrucksList>('/food_trucks', { params });
            setTrucksList(response.data);
        } catch (error: any) {
            console.error('Error fetching food trucks:', error);
            setErrorMessage(error.response?.data?.error || error.message || 'Failed to load food trucks.');
            setTrucksList([]); // Clear list on error
        } finally {
            setIsLoading(false);
        }
    }, [api_client]); // api_client should be stable


  // Request Browser Location
  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationPermissionStatus('unavailable');
      setErrorMessage('Geolocation is not supported by your browser.');
      // Fetch without location if default/URL didn't provide one
      if(filterLocation.source === 'default') {
         fetchTrucks(filterLocation, filterCuisineType, filterSearchTerm);
      }
      return;
    }

    setIsLoading(true); // Show loading while prompting/getting location
    setErrorMessage(null);
    setLocationPermissionStatus('prompt');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('Geolocation success:', { latitude, longitude });
        setLocationPermissionStatus('granted');
        const newLocation = {
            latitude,
            longitude,
            radius_km: filterLocation.radius_km, // Keep existing radius
            display_name: 'Near Your Location',
            source: 'browser' as const,
        };
        // Update state and URL, then fetch
        updateFiltersAndUrl({ location: newLocation });
        // Fetch is triggered by updateFiltersAndUrl
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLoading(false); // Stop loading indicator
        let permStatus: LocationPermissionStatus = 'unavailable';
        let errMsg = 'Could not determine your location.';
        if (error.code === error.PERMISSION_DENIED) {
          permStatus = 'denied';
          errMsg = 'Location access denied. Please enable location services or search manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errMsg = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errMsg = 'Location request timed out.';
        }
        setLocationPermissionStatus(permStatus);
        setErrorMessage(errMsg);
         // Fetch without location if default/URL didn't provide one
         if(filterLocation.source === 'default' || filterLocation.source === 'url') {
             // Attempt fetch without browser location if we had initial coords or none at all
             const locationToUse = (filterLocation.source === 'url' && filterLocation.latitude !== null) ? filterLocation : { ...filterLocation, latitude: null, longitude: null, display_name: 'Everywhere', source: 'default' as const };
             fetchTrucks(locationToUse, filterCuisineType, filterSearchTerm);
         }
      },
      { timeout: 10000 } // 10 second timeout
    );
  }, [filterLocation, filterCuisineType, filterSearchTerm, fetchTrucks, updateFiltersAndUrl]);


  // Debounced Search Handler
  const debouncedFetchTrucks = useMemo(() =>
      debounce((location: FilterLocation, cuisine: string, search: string) => {
          fetchTrucks(location, cuisine, search);
      }, 500), // 500ms debounce
  [fetchTrucks]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSearchTerm = event.target.value;
      setFilterSearchTerm(newSearchTerm); // Update state immediately for input responsiveness

      // Update URL params via debounced function call
      const newParams = new URLSearchParams(searchParams);
      if (newSearchTerm) {
          newParams.set('search_term', newSearchTerm);
      } else {
          newParams.delete('search_term');
      }
      setSearchParams(newParams, { replace: true });

      // Trigger debounced fetch
      debouncedFetchTrucks(filterLocation, filterCuisineType, newSearchTerm);
  };


  // --- Event Handlers ---

  const handleCuisineChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      updateFiltersAndUrl({ cuisine: event.target.value });
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      updateFiltersAndUrl({ sort: event.target.value as SortByType });
  };

  const handleUseMyLocationClick = () => {
      requestBrowserLocation();
  };

  const navigateToMapView = () => {
      navigate(`/trucks/map?${searchParams.toString()}`);
  };

  // --- Effects ---

  // Initialize on mount
  useEffect(() => {
      // If URL has location, fetch immediately, otherwise request browser location
      if (filterLocation.source === 'url' && filterLocation.latitude !== null) {
          fetchTrucks(filterLocation, filterCuisineType, filterSearchTerm);
           setLocationPermissionStatus('granted'); // Assume granted if URL provided location
      } else {
          requestBrowserLocation();
      }
      // Cleanup debounce on unmount
      return () => {
          debouncedFetchTrucks.cancel();
      };
  }, []); // Run only once on mount


  // Update sortBy default if location becomes available/unavailable after initial load
  useEffect(() => {
      if (filterLocation.latitude !== null && sortBy === 'name') {
          setSortBy('distance');
      } else if (filterLocation.latitude === null && sortBy === 'distance') {
          setSortBy('name');
      }
  }, [filterLocation.latitude, sortBy]);


  // --- Client-side Sorting ---
  const sortedTrucksList = useMemo(() => {
    const listToSort = [...trucksList];
    if (sortBy === 'distance' && filterLocation.latitude !== null) {
      listToSort.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    } else { // Default to name sort or if distance sort is chosen but no location
      listToSort.sort((a, b) => a.name.localeCompare(b.name));
    }
    return listToSort;
  }, [trucksList, sortBy, filterLocation.latitude]);


  // --- Render ---
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Find Food Trucks</h1>

        {/* --- Controls Row --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 items-end">
          {/* Location Display/Action */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            {filterLocation.display_name && locationPermissionStatus === 'granted' ? (
              <div className="flex items-center justify-between p-2 border border-gray-300 rounded-md bg-white">
                 <span className="text-sm text-gray-600 truncate">{filterLocation.display_name}</span>
                 <button
                     onClick={handleUseMyLocationClick}
                     className="ml-2 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                     title="Re-detect location"
                 >
                     Update
                 </button>
              </div>
            ) : locationPermissionStatus === 'prompt' || isLoading ? (
              <div className="p-2 border border-gray-300 rounded-md bg-white text-sm text-gray-500">Detecting location...</div>
            ) : (
              <button
                onClick={handleUseMyLocationClick}
                disabled={isLoading}
                className="w-full p-2 border border-blue-500 text-blue-600 rounded-md bg-white hover:bg-blue-50 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Use My Current Location
              </button>
            )}
            {locationPermissionStatus === 'denied' && (
                <p className="text-xs text-red-600 mt-1">Location access denied.</p>
            )}
             {locationPermissionStatus === 'unavailable' && (
                <p className="text-xs text-red-600 mt-1">Location unavailable.</p>
            )}
          </div>

          {/* Search */}
          <div className="md:col-span-1 lg:col-span-1">
            <label htmlFor="search_term" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              id="search_term"
              value={filterSearchTerm}
              onChange={handleSearchChange}
              placeholder="Truck name or cuisine..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Cuisine Filter */}
          <div className="md:col-span-1 lg:col-span-1">
            <label htmlFor="cuisine_type" className="block text-sm font-medium text-gray-700 mb-1">Cuisine Filter</label>
            <input
              type="text"
              id="cuisine_type"
              value={filterCuisineType}
              onChange={handleCuisineChange}
              placeholder="e.g., Tacos, Pizza, Burgers"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
             <p className="text-xs text-gray-500 mt-1">Separate multiple cuisines with commas.</p>
          </div>

          {/* Sort & View Toggle */}
          <div className="flex gap-2 md:col-span-3 lg:col-span-1">
             <div className="flex-1">
                <label htmlFor="sort_by" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  id="sort_by"
                  value={sortBy}
                  onChange={handleSortChange}
                  disabled={isLoading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:opacity-50"
                >
                  <option value="distance" disabled={filterLocation.latitude === null}>Distance</option>
                  <option value="name">Name (A-Z)</option>
                </select>
             </div>
              <div className="flex-shrink-0 self-end">
                 <button
                    onClick={navigateToMapView}
                    className="p-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    title="Switch to Map View"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 1.586l-4 4v2.828l-4 4V14.5a.5.5 0 00.5.5h1.086l.914.914a.5.5 0 00.707 0l.914-.914H10.5a.5.5 0 00.5-.5v-2.086l4-4V6.414l4-4V3.5a.5.5 0 00-.5-.5h-1.086l-.914-.914a.5.5 0 00-.707 0L14.586 2H13.5a.5.5 0 00-.5.5v1.086l-1-1zM10 6a2 2 0 100-4 2 2 0 000 4zm-7 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                 </button>
              </div>
          </div>
        </div>

        {/* --- Loading State --- */}
        {isLoading && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Finding food trucks...</p>
          </div>
        )}

        {/* --- Error Message --- */}
        {errorMessage && !isLoading && (
          <div className="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700 font-medium">Oops! Something went wrong.</p>
            <p className="text-red-600 text-sm mt-1">{errorMessage}</p>
             {locationPermissionStatus === 'denied' && (
                 <button onClick={handleUseMyLocationClick} className="mt-3 px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                     Retry Location Access
                 </button>
             )}
          </div>
        )}

        {/* --- Truck List --- */}
        {!isLoading && !errorMessage && sortedTrucksList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedTrucksList.map((truck) => (
              <Link
                key={truck.uid}
                to={`/trucks/${truck.uid}`}
                className="block group bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                <div className="relative h-32 bg-gray-200">
                   <img
                     src={truck.logo_url || `https://picsum.photos/seed/${truck.uid}/300/200`}
                     alt={`${truck.name} logo`}
                     className="w-full h-full object-cover"
                     loading="lazy"
                   />
                   {truck.current_status === 'online' ? (
                       <span className="absolute top-2 right-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           Open
                       </span>
                   ) : (
                        <span className="absolute top-2 right-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                           {truck.current_status === 'paused' ? 'Paused' : 'Closed'}
                       </span>
                   )}

                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 truncate group-hover:text-indigo-600">{truck.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{truck.cuisine_type}</p>
                   {truck.distance_km !== null && truck.distance_km !== undefined && (
                       <p className="text-sm text-gray-500 mt-1">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1 -mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                           </svg>
                           {truck.distance_km.toFixed(1)} km away
                       </p>
                   )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* --- Empty State --- */}
        {!isLoading && !errorMessage && sortedTrucksList.length === 0 && (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Food Trucks Found</h3>
            <p className="mt-1 text-sm text-gray-500">
                No open food trucks match your current criteria. Try adjusting your search or location.
            </p>
            {/* Optional: Add button to clear filters */}
            {(filterCuisineType || filterSearchTerm) && (
                 <button
                     onClick={() => updateFiltersAndUrl({ cuisine: '', search: '' })}
                     className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                 >
                     Clear Filters
                 </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UV_CustomerTruckDiscoveryList;