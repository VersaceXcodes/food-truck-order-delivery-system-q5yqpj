import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import axios from 'axios';
import debounce from 'lodash.debounce';

// --- Interfaces & Types ---

interface TruckMapPin {
  uid: string;
  name: string;
  cuisine_type: string;
  current_status: 'online';
  location_latitude: number;
  location_longitude: number;
  logo_url: string | null;
}
type TrucksForMap = TruckMapPin[];

interface MapCenter {
  latitude: number;
  longitude: number;
}

interface SelectedPinInfo {
  uid: string;
  name: string;
  cuisine_type: string;
  status: string;
} | null;

interface FilterLocation {
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  source: 'browser' | 'manual' | 'default' | 'url';
}

type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable';

// --- Constants ---
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:1337';
const DEFAULT_CENTER: MapCenter = { latitude: 34.0522, longitude: -118.2437 }; // Default LA
const DEFAULT_ZOOM = 12;
const DEFAULT_RADIUS_KM = 10;
const MAP_FETCH_DEBOUNCE_MS = 500;

// --- Leaflet Icon Fix ---
// @ts-ignore Correcting potential issue with default icon paths in build environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- Helper Component for Map Events ---
const MapEventsHandler = ({ onViewportChange }: { onViewportChange: (center: MapCenter, zoom: number) => void }) => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewportChange({ latitude: center.lat, longitude: center.lng }, map.getZoom());
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewportChange({ latitude: center.lat, longitude: center.lng }, map.getZoom());
    },
  });
  return null;
};

// --- Main View Component ---
const UV_CustomerTruckDiscoveryMap: React.FC = () => {
    // --- State ---
    const [trucksForMap, setTrucksForMap] = useState<TrucksForMap>([]);
    const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_CENTER);
    const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
    const [selectedTruckPinInfo, setSelectedTruckPinInfo] = useState<SelectedPinInfo>(null);
    const [filterLocation, setFilterLocation] = useState<FilterLocation>({ latitude: null, longitude: null, radius_km: DEFAULT_RADIUS_KM, source: 'default' });
    const [filterCuisineType, setFilterCuisineType] = useState<string>("");
    const [filterSearchTerm, setFilterSearchTerm] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [locationPermissionStatus, setLocationPermissionStatus] = useState<LocationPermissionStatus>('prompt');

    const [searchParams, setSearchParams] = useSearchParams();
    const mapRef = useRef<L.Map | null>(null); // Ref to control map instance

    // --- Callbacks & Actions ---

    // Action: fetchTrucksForMap
    const fetchTrucksForMap = useCallback(async (currentFilterLocation: FilterLocation, currentCuisine: string, currentSearch: string) => {
        setIsLoading(true);
        setErrorMessage(null);
        setSelectedTruckPinInfo(null); // Close popup on new fetch

        const params = new URLSearchParams({
            status: 'online', // Always fetch online trucks for the map
        });

        if (currentFilterLocation.latitude !== null && currentFilterLocation.longitude !== null) {
            params.append('latitude', String(currentFilterLocation.latitude));
            params.append('longitude', String(currentFilterLocation.longitude));
            params.append('radius_km', String(currentFilterLocation.radius_km));
        }
        if (currentCuisine) {
             params.append('cuisine_type', currentCuisine);
        }
        if (currentSearch) {
            params.append('search_term', currentSearch);
        }

        try {
            console.log(`Fetching trucks with params: ${params.toString()}`);
            const response = await axios.get<TrucksForMap>(`${API_BASE_URL}/food_trucks`, { params });
            // Filter for trucks that have valid coordinates
            const validTrucks = response.data.filter(truck =>
                typeof truck.location_latitude === 'number' &&
                typeof truck.location_longitude === 'number' &&
                !isNaN(truck.location_latitude) &&
                !isNaN(truck.location_longitude)
            );
            setTrucksForMap(validTrucks);
             console.log(`Fetched ${validTrucks.length} valid trucks.`);
        } catch (error) {
            console.error("Error fetching trucks:", error);
            let errorMsg = "Could not load food trucks. Please try again later.";
            if (axios.isAxiosError(error) && error.response) {
                errorMsg = `Error ${error.response.status}: ${error.response.data?.error || error.message}`;
            } else if (error instanceof Error) {
                errorMsg = error.message;
            }
            setErrorMessage(errorMsg);
            setTrucksForMap([]); // Clear trucks on error
        } finally {
            setIsLoading(false);
        }
    }, []); // No dependencies, uses passed-in args

    // Debounced version for map movement
    const debouncedFetchTrucks = useCallback(debounce(fetchTrucksForMap, MAP_FETCH_DEBOUNCE_MS), [fetchTrucksForMap]);

    // Action: requestBrowserLocation
    const requestBrowserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationPermissionStatus('unavailable');
            setErrorMessage("Geolocation is not supported by your browser.");
            // Fetch based on default/URL params if geo is unavailable
            fetchTrucksForMap(filterLocation, filterCuisineType, filterSearchTerm);
            return;
        }

        setLocationPermissionStatus('prompt');
        setErrorMessage(null);
        setIsLoading(true); // Show loading while getting location

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                console.log(`Browser location obtained: ${latitude}, ${longitude}`);
                setLocationPermissionStatus('granted');
                const newFilterLoc: FilterLocation = { latitude, longitude, radius_km: filterLocation.radius_km, source: 'browser' };
                setFilterLocation(newFilterLoc);
                setMapCenter({ latitude, longitude });
                setMapZoom(14); // Zoom in when using browser location

                // Update URL params
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.set('latitude', String(latitude));
                newSearchParams.set('longitude', String(longitude));
                newSearchParams.set('radius_km', String(newFilterLoc.radius_km));
                setSearchParams(newSearchParams, { replace: true });

                // Fetch trucks for the new location
                fetchTrucksForMap(newFilterLoc, filterCuisineType, filterSearchTerm);

                // Fly map to new location
                if (mapRef.current) {
                    mapRef.current.flyTo([latitude, longitude], 14);
                }
                setIsLoading(false); // Loading false after location obtained and fetch started
            },
            (error) => {
                console.error(`Geolocation error: ${error.message}`);
                setLocationPermissionStatus('denied');
                setErrorMessage(`Could not get location: ${error.message}. Showing default area or using URL location.`);
                // Fetch trucks for default/URL area if permission denied
                fetchTrucksForMap(filterLocation, filterCuisineType, filterSearchTerm);
                setIsLoading(false);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    }, [filterLocation, filterCuisineType, filterSearchTerm, setSearchParams, fetchTrucksForMap, searchParams]);

    // Action: initializeMapView (runs once on mount)
    useEffect(() => {
        console.log("Initializing Map View...");
        const urlLat = searchParams.get('latitude');
        const urlLon = searchParams.get('longitude');
        const urlRadius = searchParams.get('radius_km');
        const urlCuisine = searchParams.get('cuisine_type') || '';
        const urlSearch = searchParams.get('search_term') || '';

        const initialLat = urlLat ? parseFloat(urlLat) : NaN;
        const initialLon = urlLon ? parseFloat(urlLon) : NaN;
        const initialRadius = urlRadius ? parseFloat(urlRadius) : DEFAULT_RADIUS_KM;

        let source: FilterLocation['source'] = 'default';
        let centerLat = DEFAULT_CENTER.latitude;
        let centerLon = DEFAULT_CENTER.longitude;
        let zoom = DEFAULT_ZOOM;

        if (!isNaN(initialLat) && !isNaN(initialLon)) {
            console.log("Using location from URL params.");
            source = 'url';
            centerLat = initialLat;
            centerLon = initialLon;
            zoom = 14; // Zoom in if location is from URL
        }

        const initialFilterLoc: FilterLocation = {
            latitude: !isNaN(initialLat) ? initialLat : null,
            longitude: !isNaN(initialLon) ? initialLon : null,
            radius_km: !isNaN(initialRadius) && initialRadius > 0 ? initialRadius : DEFAULT_RADIUS_KM,
            source: source,
        };

        setFilterLocation(initialFilterLoc);
        setFilterCuisineType(urlCuisine);
        setFilterSearchTerm(urlSearch);
        setMapCenter({ latitude: centerLat, longitude: centerLon });
        setMapZoom(zoom);

        // Initial fetch or location request
        if (initialFilterLoc.latitude !== null && initialFilterLoc.longitude !== null) {
            fetchTrucksForMap(initialFilterLoc, urlCuisine, urlSearch);
        } else {
            console.log("No location in URL, attempting browser location...");
            requestBrowserLocation();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount, dependencies are stable (searchParams is technically not, but we only read it once)

    // Action: updateMapViewport (handler for map events)
    const handleViewportChange = useCallback((newCenter: MapCenter, newZoom: number) => {
        setMapCenter(newCenter);
        setMapZoom(newZoom);

        // Update URL params on move end
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('latitude', newCenter.latitude.toFixed(6));
        newSearchParams.set('longitude', newCenter.longitude.toFixed(6));
        // Keep radius, cuisine, search from existing params
        setSearchParams(newSearchParams, { replace: true });

        // Fetch based on new center/bounds (debounced)
        // Use the current filter radius for the fetch
        const fetchRadius = filterLocation.radius_km;
        const newFetchLocation: FilterLocation = {
             latitude: newCenter.latitude,
             longitude: newCenter.longitude,
             radius_km: fetchRadius,
             source: 'manual' // Indicate map interaction triggered this fetch
         };
         // Update filterLocation state ONLY if you want subsequent filter changes to use the map's current center
         // setFilterLocation(newFetchLocation);
         debouncedFetchTrucks(newFetchLocation, filterCuisineType, filterSearchTerm);

    }, [searchParams, setSearchParams, filterLocation.radius_km, filterCuisineType, filterSearchTerm, debouncedFetchTrucks]);

    // Action: selectTruckPin
    const selectTruckPin = useCallback((truck: TruckMapPin) => {
        setSelectedTruckPinInfo({
            uid: truck.uid,
            name: truck.name,
            cuisine_type: truck.cuisine_type,
            status: truck.current_status,
        });
        // Fly map to the pin for better focus
        if (mapRef.current) {
            mapRef.current.flyTo([truck.location_latitude, truck.location_longitude], Math.max(mapZoom, 15)); // Zoom in if needed
        }
    }, [mapZoom]); // Depends on mapZoom to decide target zoom

    // --- Event Handlers for Filters ---
     const handleCuisineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         const newValue = e.target.value;
         setFilterCuisineType(newValue);
         const newSearchParams = new URLSearchParams(searchParams);
         newValue ? newSearchParams.set('cuisine_type', newValue) : newSearchParams.delete('cuisine_type');
         setSearchParams(newSearchParams, { replace: true });
         // Trigger immediate fetch with new filter
         fetchTrucksForMap(filterLocation, newValue, filterSearchTerm);
     };

     const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         const newValue = e.target.value;
         setFilterSearchTerm(newValue);
         const newSearchParams = new URLSearchParams(searchParams);
         newValue ? newSearchParams.set('search_term', newValue) : newSearchParams.delete('search_term');
         setSearchParams(newSearchParams, { replace: true });
         // Trigger immediate fetch with new filter
         fetchTrucksForMap(filterLocation, filterCuisineType, newValue);
     };

      const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         const newRadius = parseFloat(e.target.value);
         if (!isNaN(newRadius) && newRadius > 0) {
             const newFilterLoc = { ...filterLocation, radius_km: newRadius };
             setFilterLocation(newFilterLoc);
             const newSearchParams = new URLSearchParams(searchParams);
             newSearchParams.set('radius_km', String(newRadius));
             setSearchParams(newSearchParams, { replace: true });
              // Trigger immediate fetch with new radius
             fetchTrucksForMap(newFilterLoc, filterCuisineType, filterSearchTerm);
         }
      };

    // --- Render ---
    const mapKey = `${mapCenter.latitude}-${mapCenter.longitude}-${mapZoom}`; // Force re-render if center/zoom changes programmatically

    return (
        <>
            <div className="container mx-auto px-4 py-6">
                {/* --- Header & Controls --- */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800">Find Food Trucks (Map)</h1>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                        {/* Location Button */}
                         <button
                            onClick={requestBrowserLocation}
                            disabled={locationPermissionStatus === 'prompt' && isLoading} // Disable while prompting/loading initial
                            className={`px-3 py-1 border rounded transition duration-150 ${
                                locationPermissionStatus === 'granted'
                                ? 'bg-blue-100 text-blue-700 border-blue-300 cursor-default'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-wait'
                            }`}
                        >
                            {isLoading && locationPermissionStatus === 'prompt' ? 'Locating...' :
                             locationPermissionStatus === 'granted' ? 'Using Your Location' :
                             'Use My Location'}
                        </button>
                         {(locationPermissionStatus === 'denied' || locationPermissionStatus === 'unavailable') && (
                            <span className="text-sm text-red-500 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                Location access needed
                            </span>
                         )}

                        {/* View Toggle */}
                        <Link
                            to={`/trucks?${searchParams.toString()}`} // Pass current filters back
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition duration-150"
                        >
                            List View
                        </Link>
                    </div>
                </div>

                 {/* --- Filter Inputs --- */}
                 <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-100 rounded shadow-sm">
                     <input
                         type="text"
                         placeholder="Search name or cuisine..."
                         value={filterSearchTerm}
                         onChange={handleSearchChange}
                         className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                     />
                     <input
                         type="text"
                         placeholder="Filter by cuisine (e.g., Tacos)"
                         value={filterCuisineType}
                         onChange={handleCuisineChange}
                         className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                     />
                     <div className="flex items-center gap-2">
                         <label htmlFor="radius" className="text-sm font-medium text-gray-700 whitespace-nowrap">Radius (km):</label>
                         <input
                             id="radius"
                             type="number"
                             min="1"
                             max="50"
                             step="1"
                             value={filterLocation.radius_km}
                             onChange={handleRadiusChange}
                             className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                         />
                     </div>
                 </div>

                {/* --- Error Message --- */}
                {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{errorMessage}</span>
                        <button onClick={() => setErrorMessage(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                             <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </button>
                    </div>
                )}

                {/* --- Loading Indicator & Map Container --- */}
                <div className="h-[60vh] md:h-[70vh] w-full rounded shadow-lg overflow-hidden relative bg-gray-200 z-0">
                    {isLoading && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-400 bg-opacity-50 z-10">
                            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-lg text-gray-700 mt-2">Loading trucks...</p>
                        </div>
                    )}
                    <MapContainer
                        key={mapKey} // Use key to help React re-render map correctly if center/zoom changes programmatically
                        center={[mapCenter.latitude, mapCenter.longitude] as LatLngExpression}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                        whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
                        className={isLoading ? 'opacity-50' : ''} // Dim map while loading overlay is shown
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />

                        <MapEventsHandler onViewportChange={handleViewportChange} />

                        {/* Render Markers */}
                        {trucksForMap.map((truck) => (
                            <Marker
                                key={truck.uid}
                                position={[truck.location_latitude, truck.location_longitude] as LatLngExpression}
                                eventHandlers={{
                                    click: () => {
                                        selectTruckPin(truck);
                                    },
                                }}
                                // Optional: Custom Icon
                                // icon={L.icon({ iconUrl: truck.logo_url || default_icon_path, ... })}
                            >
                                <Popup>
                                    <div className="text-center p-1">
                                        {truck.logo_url && (
                                            <img src={truck.logo_url} alt={`${truck.name} logo`} className="w-16 h-16 object-cover rounded-full mx-auto mb-2 border border-gray-300"/>
                                        )}
                                         {!truck.logo_url && (
                                            <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center text-gray-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                        <h3 className="text-base font-semibold mb-1">{truck.name}</h3>
                                        <p className="text-xs text-gray-600 mb-1">{truck.cuisine_type}</p>
                                        <p className={`text-xs font-medium ${truck.current_status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                                            {truck.current_status === 'online' ? 'Open for Orders' : 'Offline'}
                                        </p>
                                        <Link
                                            to={`/trucks/${truck.uid}`}
                                            className="mt-2 inline-block px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition duration-150 shadow-sm"
                                            onClick={(e) => e.stopPropagation()} // Prevent marker click handler firing again
                                        >
                                            View Menu
                                        </Link>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
                {/* --- Results Count --- */}
                 {!isLoading && !errorMessage && (
                    <p className="text-center text-gray-600 mt-4 text-sm">
                        Showing {trucksForMap.length} online food truck(s) in the current map area.
                    </p>
                 )}
                 {!isLoading && trucksForMap.length === 0 && !errorMessage && (
                      <p className="text-center text-gray-500 mt-4">
                        No online food trucks found matching your criteria in this area. Try expanding the map or changing filters.
                    </p>
                 )}
            </div>
        </>
    );
};

export default UV_CustomerTruckDiscoveryMap;
