'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

// Map component with drone markers

interface MapProps {
  address: string;
  numDrones?: number;
  feetApart?: number;
  speed?: number; // mph
  isMoving?: boolean;
  direction?: string; // N, NE, E, SE, S, SW, W, NW
}

export default function Map({ address, numDrones = 8, feetApart = 100, speed = 5, isMoving = false, direction = 'N' }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const dronePositionsRef = useRef<[number, number][]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation effect - move drones in specified direction at specified speed
  useEffect(() => {
    if (!isMoving || !map.current || markersRef.current.length === 0) {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Convert mph to degrees per millisecond
    // 1 mph = 0.44704 meters per second
    // 1 degree latitude = 111,320 meters
    const metersPerSecond = speed * 0.44704;
    const degreesPerSecond = metersPerSecond / 111320;
    const degreesPerMs = degreesPerSecond / 1000;

    // Direction vectors (lat change, lon change multipliers)
    const directionVectors: { [key: string]: [number, number] } = {
      'N':  [1, 0],
      'NE': [0.707, 0.707],
      'E':  [0, 1],
      'SE': [-0.707, 0.707],
      'S':  [-1, 0],
      'SW': [-0.707, -0.707],
      'W':  [0, -1],
      'NW': [0.707, -0.707]
    };

    const vector = directionVectors[direction] || [1, 0];

    const animate = (currentTime: number) => {
      if (!isMoving) return;
      
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      // Calculate movement based on direction
      const movement = degreesPerMs * deltaTime;
      const latChange = movement * vector[0];
      const lonChange = movement * vector[1];
      
      markersRef.current.forEach((marker, index) => {
        if (dronePositionsRef.current[index]) {
          // Update position based on direction
          dronePositionsRef.current[index][1] += latChange; // latitude
          dronePositionsRef.current[index][0] += lonChange; // longitude
          marker.setLngLat(dronePositionsRef.current[index]);
        }
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isMoving, speed, direction]);

  // Calculate drone positions: configurable number of drones, configurable feet apart
  const calculateDronePositions = (centerLat: number, centerLon: number): [number, number][] => {
    const drones: [number, number][] = [];
    const spacingFeet = feetApart; // Feet between adjacent drones
    
    // Convert feet to degrees
    // 1 degree latitude ≈ 111,320 meters
    // 1 degree longitude varies by latitude
    const metersPerDegreeLat = 111320; // meters per degree latitude
    const metersPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180); // meters per degree longitude at this latitude
    const feetPerMeter = 3.28084;
    
    // Calculate the radius needed for drones to be 100 feet apart
    // For 8 evenly spaced points in a circle:
    // Chord length = 2 * R * sin(θ/2)
    // Where θ = 360°/8 = 45° = π/4 radians
    // spacingFeet = 2 * R * sin(45°/2)
    // R = spacingFeet / (2 * sin(22.5°))
    const angleBetweenDrones = (2 * Math.PI) / numDrones; // 45 degrees in radians
    const radiusFeet = spacingFeet / (2 * Math.sin(angleBetweenDrones / 2));
    
    // Convert radius from feet to degrees
    const radiusMeters = radiusFeet / feetPerMeter;
    const radiusLat = radiusMeters / metersPerDegreeLat;
    const radiusLon = radiusMeters / metersPerDegreeLon;
    
    console.log('Drone calculation:', {
      centerLat,
      centerLon,
      spacingFeet,
      radiusFeet: radiusFeet.toFixed(2),
      radiusMeters: radiusMeters.toFixed(2),
      radiusLat,
      radiusLon,
      angleBetweenDronesDegrees: (angleBetweenDrones * 180 / Math.PI).toFixed(1)
    });
    
    // Calculate angle step for even distribution (8 drones = 45 degrees apart)
    const angleStep = (2 * Math.PI) / numDrones;
    
    for (let i = 0; i < numDrones; i++) {
      // Calculate angle for this drone
      const angle = i * angleStep;
      
      // Calculate position using trigonometry
      // Using sin/cos to create a circle
      // Note: sin for lat (north/south), cos for lon (east/west)
      const lat = centerLat + radiusLat * Math.sin(angle);
      const lon = centerLon + radiusLon * Math.cos(angle);
      
      // Verify the position is reasonable
      if (Math.abs(lat - centerLat) < 0.01 && Math.abs(lon - centerLon) < 0.01) {
        console.log(`Drone ${i + 1} position is valid: [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
        drones.push([lon, lat]);
      } else {
        console.warn(`Drone ${i + 1} position seems far from center: [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
        drones.push([lon, lat]); // Still add it, but log a warning
      }
      
      console.log(`Drone ${i + 1} angle: ${(angle * 180 / Math.PI).toFixed(1)}°, position: [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
    }
    
    return drones;
  };

  useEffect(() => {
    // Geocode the address using Nominatim (OpenStreetMap)
    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          {
            headers: {
              'User-Agent': 'SimulationApp/1.0'
            }
          }
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          console.log('Geocoded coordinates:', [lon, lat]);
          setCoordinates([lon, lat]);
        } else {
          // Default to Kansas City coordinates if geocoding fails
          console.log('Geocoding returned no results, using default coordinates');
          setCoordinates([-94.5786, 39.0997]);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setError('Geocoding failed');
        // Default to Kansas City coordinates
        setCoordinates([-94.5786, 39.0997]);
      } finally {
        setIsLoading(false);
      }
    };

    geocodeAddress();
  }, [address]);

  // Recalculate markers when numDrones or feetApart changes
  useEffect(() => {
    if (map.current && coordinates && markersRef.current.length > 0) {
      // Remove old markers
      markersRef.current.forEach(marker => {
        try {
          marker.remove();
        } catch (e) {
          // Ignore errors
        }
      });
      markersRef.current = [];
      dronePositionsRef.current = [];
      
      // Add new markers with updated configuration
      const addMarkers = () => {
        if (!map.current || !coordinates) return;
        
        const dronePositions = calculateDronePositions(coordinates[1], coordinates[0]);
        
        dronePositions.forEach((position, index) => {
          try {
            if (!position || !Array.isArray(position) || position.length !== 2) return;
            if (isNaN(position[0]) || isNaN(position[1])) return;
            
            const markerEl = document.createElement('div');
            markerEl.style.width = '24px';
            markerEl.style.height = '24px';
            markerEl.style.borderRadius = '50%';
            markerEl.style.backgroundColor = '#3b82f6';
            markerEl.style.border = '2px solid #ffffff';
            markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
            markerEl.style.display = 'flex';
            markerEl.style.alignItems = 'center';
            markerEl.style.justifyContent = 'center';
            markerEl.style.color = '#ffffff';
            markerEl.style.fontSize = '12px';
            markerEl.style.fontWeight = 'bold';
            markerEl.style.cursor = 'pointer';
            markerEl.textContent = `${index + 1}`;
            markerEl.title = `Drone ${index + 1}`;
            
            const droneMarker = new maplibregl.Marker({ 
              element: markerEl,
              anchor: 'center'
            })
              .setLngLat([position[0], position[1]])
              .addTo(map.current!);
            
            markersRef.current.push(droneMarker);
            dronePositionsRef.current.push([position[0], position[1]]);
          } catch (error) {
            console.error(`Error adding drone ${index + 1}:`, error);
          }
        });
        
        // Fit bounds to show all markers
        if (dronePositions.length > 0 && map.current) {
          setTimeout(() => {
            if (map.current) {
              try {
                const bounds = new maplibregl.LngLatBounds();
                bounds.extend(coordinates);
                dronePositions.forEach(pos => bounds.extend(pos));
                map.current.fitBounds(bounds, {
                  padding: { top: 200, bottom: 200, left: 200, right: 200 },
                  maxZoom: 17,
                  duration: 1000
                });
              } catch (error) {
                console.error('Error fitting bounds:', error);
              }
            }
          }, 300);
        }
      };
      
      addMarkers();
    }
  }, [numDrones, feetApart, coordinates]);

  useEffect(() => {
    if (!mapContainer.current || !coordinates || map.current) return;

    console.log('Initializing map with coordinates:', coordinates);
    console.log('Container dimensions:', {
      width: mapContainer.current.offsetWidth,
      height: mapContainer.current.offsetHeight
    });
    
    // Wait a tick to ensure container is fully rendered
    const timer = setTimeout(() => {
      if (!mapContainer.current || map.current) return;
      
      try {
        // Use a CORS-friendly tile provider
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              'osm-tiles': {
                type: 'raster',
                tiles: [
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors'
              }
            },
            layers: [
              {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 22
              }
            ]
          },
          center: coordinates,
          zoom: 15
        });

        // Add markers IMMEDIATELY after map creation - don't wait for load event
        console.log('🔵 Creating addMarkers function...');
        
        // Function to add markers - simplified and more direct
        const addMarkers = () => {
          console.log('🔵 addMarkers() FUNCTION CALLED!');
          
          if (!map.current) {
            console.error('❌ Cannot add markers: map.current is null');
            return;
          }
          
          console.log('=== Adding markers ===');
          console.log('Map loaded:', map.current.loaded());
          console.log('Map container exists:', !!map.current.getContainer());
          console.log('Coordinates:', coordinates);
          
          // Don't wait - just add markers if map exists
          if (!map.current.loaded()) {
            console.log('⚠️ Map not fully loaded, but trying anyway...');
          }
          
          try {
            // Clear any existing markers first
            markersRef.current.forEach(marker => {
              try {
                marker.remove();
              } catch (e) {
                // Ignore errors
              }
            });
            markersRef.current = [];
            
            // Add a marker at the address location (red) - use simple approach
            console.log('Adding red address marker...');
            const addressMarker = new maplibregl.Marker({ 
              color: '#ef4444',
              draggable: false
            })
              .setLngLat(coordinates)
              .addTo(map.current);
            console.log('✓ Red address marker added');
            
            // Calculate and add drone positions using current props
            const dronePositions = calculateDronePositions(coordinates[1], coordinates[0]);
            console.log('Drone positions calculated:', dronePositions);
            console.log('Number of drones:', dronePositions.length, '(requested:', numDrones, ')');
            console.log('Feet apart:', feetApart);
            
            // DEBUG: Log first position relative to center
            if (dronePositions.length > 0) {
              const firstPos = dronePositions[0];
              const latDiff = (firstPos[1] - coordinates[1]) * 111320; // meters
              const lonDiff = (firstPos[0] - coordinates[0]) * 111320 * Math.cos(coordinates[1] * Math.PI / 180); // meters
              const distanceMeters = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
              const distanceFeet = distanceMeters * 3.28084;
              console.log(`First drone distance from center: ${distanceFeet.toFixed(1)} feet (${distanceMeters.toFixed(1)} meters)`);
              console.log(`This should be approximately ${(100 / Math.sin(Math.PI / 8)).toFixed(1)} feet based on 100ft spacing`);
            }
            
            if (dronePositions.length === 0) {
              console.error('No drone positions calculated!');
              return;
            }
            
            
            // Add markers for each drone (blue) - use simple default markers first
            console.log('Adding drone markers...');
            console.log('Address coordinates:', coordinates);
            console.log('First drone position:', dronePositions[0]);
            console.log('Distance check - first drone should be visible near address');
            
            dronePositions.forEach((position, index) => {
              try {
                // Validate position
                if (!position || !Array.isArray(position) || position.length !== 2) {
                  console.error(`Invalid position for drone ${index + 1}:`, position);
                  return;
                }
                
                if (isNaN(position[0]) || isNaN(position[1])) {
                  console.error(`NaN position for drone ${index + 1}:`, position);
                  return;
                }
                
                // Log the position relative to address
                const latDiff = position[1] - coordinates[1];
                const lonDiff = position[0] - coordinates[0];
                console.log(`Drone ${index + 1}: lat diff=${latDiff.toFixed(6)}, lon diff=${lonDiff.toFixed(6)}`);
                
                // Create custom circular marker - the circle IS the drone
                const markerEl = document.createElement('div');
                markerEl.style.width = '24px';
                markerEl.style.height = '24px';
                markerEl.style.borderRadius = '50%';
                markerEl.style.backgroundColor = '#3b82f6';
                markerEl.style.border = '2px solid #ffffff';
                markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
                markerEl.style.display = 'flex';
                markerEl.style.alignItems = 'center';
                markerEl.style.justifyContent = 'center';
                markerEl.style.color = '#ffffff';
                markerEl.style.fontSize = '12px';
                markerEl.style.fontWeight = 'bold';
                markerEl.style.cursor = 'pointer';
                markerEl.textContent = `${index + 1}`;
                markerEl.title = `Drone ${index + 1}`;
                
                const droneMarker = new maplibregl.Marker({ 
                  element: markerEl,
                  anchor: 'center'
                })
                  .setLngLat([position[0], position[1]])
                  .addTo(map.current!);
                
                console.log(`✓ Drone ${index + 1} marker added at [${position[0].toFixed(6)}, ${position[1].toFixed(6)}]`);
                
                // Verify marker is actually in the DOM
                const markerElement = droneMarker.getElement();
                if (markerElement) {
                  const isInDOM = document.body.contains(markerElement) || map.current?.getContainer().contains(markerElement);
                  console.log(`  Marker ${index + 1} element in DOM:`, isInDOM);
                  console.log(`  Marker ${index + 1} element style.display:`, markerElement.style.display);
                  console.log(`  Marker ${index + 1} element style.visibility:`, markerElement.style.visibility);
                  console.log(`  Marker ${index + 1} element offsetWidth:`, markerElement.offsetWidth);
                  console.log(`  Marker ${index + 1} element offsetHeight:`, markerElement.offsetHeight);
                } else {
                  console.error(`  Marker ${index + 1} element is NULL!`);
                }
                
                markersRef.current.push(droneMarker);
                dronePositionsRef.current.push([position[0], position[1]]);
              } catch (error) {
                console.error(`Error adding drone ${index + 1}:`, error);
              }
            });
            
            console.log('=== Total markers added:', markersRef.current.length, '===');
            console.log('=== Checking marker visibility ===');
            
            // Final check - count markers in DOM
            setTimeout(() => {
              const mapContainer = map.current?.getContainer();
              if (mapContainer) {
                const allMarkers = mapContainer.querySelectorAll('.maplibregl-marker');
                console.log(`Found ${allMarkers.length} marker elements in map container`);
                allMarkers.forEach((marker, idx) => {
                  const el = marker as HTMLElement;
                  console.log(`  Marker ${idx + 1}: display=${el.style.display}, visibility=${el.style.visibility}, width=${el.offsetWidth}, height=${el.offsetHeight}`);
                });
              }
            }, 500);

            // Fit map bounds to show all drones and the address
            if (dronePositions.length > 0 && map.current && markersRef.current.length > 0) {
              setTimeout(() => {
                if (map.current) {
                  try {
                    const bounds = new maplibregl.LngLatBounds();
                    bounds.extend(coordinates);
                    console.log('Fitting bounds - address:', coordinates);
                    dronePositions.forEach((pos, idx) => {
                      console.log(`  Adding drone ${idx + 1} to bounds:`, pos);
                      bounds.extend(pos);
                    });
                    
                    // Log bounds info
                    const sw = bounds.getSouthWest();
                    const ne = bounds.getNorthEast();
                    console.log('Calculated bounds:', {
                      southwest: [sw.lng.toFixed(6), sw.lat.toFixed(6)],
                      northeast: [ne.lng.toFixed(6), ne.lat.toFixed(6)],
                      center: [coordinates[0].toFixed(6), coordinates[1].toFixed(6)]
                    });
                    
                    map.current.fitBounds(bounds, {
                      padding: { top: 200, bottom: 200, left: 200, right: 200 },
                      maxZoom: 17,
                      duration: 2000
                    });
                    console.log('✓ Map bounds fitted to show all markers');
                    
                    // Log current map state after fitting
                    setTimeout(() => {
                      if (map.current) {
                        const center = map.current.getCenter();
                        console.log('Map center after fit:', [center.lng.toFixed(6), center.lat.toFixed(6)]);
                        console.log('Map zoom after fit:', map.current.getZoom().toFixed(2));
                        console.log('Total markers on map:', markersRef.current.length);
                      }
                    }, 2100);
                  } catch (error) {
                    console.error('Error fitting bounds:', error);
                  }
                }
              }, 1500);
            } else {
              console.warn('Cannot fit bounds - missing data. Markers:', markersRef.current.length, 'Positions:', dronePositions.length);
            }
          } catch (error) {
            console.error('Error in addMarkers:', error);
          }
        };

        // Add markers using multiple strategies to ensure they're added
        console.log('🔵 Setting up marker addition strategies...');
        
        // Strategy 1: Add immediately if map is already loaded
        if (map.current.loaded()) {
          console.log('🔵 Map already loaded, adding markers NOW');
          setTimeout(() => addMarkers(), 100);
        }
        
        // Strategy 2: Add when load event fires
        map.current.once('load', () => {
          console.log('🔵✓✓✓ MAP LOAD EVENT - Adding markers!');
          setTimeout(() => {
            addMarkers();
            // Add navigation controls (will skip if already added)
            if (map.current) {
              try {
                map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
              } catch (e) {
                // Control might already be added, ignore error
              }
            }
          }, 300);
        });
        
        // Strategy 3: Force add after delays
        setTimeout(() => {
          console.log('🔵 Timeout 1.5s - Force adding markers...');
          if (map.current) {
            addMarkers();
            // Add navigation controls (will skip if already added)
            try {
              map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
            } catch (e) {
              // Control might already be added, ignore error
            }
          }
        }, 1500);
        
        setTimeout(() => {
          console.log('🔵 Timeout 3s - Force adding markers again...');
          if (map.current && markersRef.current.length === 0) {
            addMarkers();
          }
        }, 3000);
        
        setTimeout(() => {
          console.log('🔵 Timeout 5s - Final attempt to add markers...');
          if (map.current && markersRef.current.length === 0) {
            addMarkers();
            console.log('Final marker count:', markersRef.current.length);
          }
        }, 5000);

        map.current.on('error', (e: any) => {
          console.error('Map error:', e);
          // Don't show tile fetch errors as they're often recoverable
          if (e.error?.message && e.error.message.includes('Failed to fetch')) {
            console.warn('Tile fetch error (may be recoverable):', e.error.message);
          } else {
            setError(`Map error: ${e.error?.message || 'Unknown error'}`);
          }
        });

        map.current.on('data', (e: any) => {
          if (e.dataType === 'source' && e.isSourceLoaded) {
            console.log('Source loaded:', e.sourceId);
          }
        });

        map.current.on('styledata', () => {
          console.log('Style data loaded');
        });
        
        // DIRECT: Add markers when map loads - this is the most reliable way
        map.current.once('load', () => {
          console.log('✓✓✓ MAP LOAD EVENT FIRED - Adding markers now!');
          setTimeout(() => {
            if (map.current) {
              console.log('Calling addMarkers() from load event...');
              addMarkers();
              // Add navigation controls (will skip if already added)
              try {
                map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
              } catch (e) {
                // Control might already be added, ignore error
              }
            }
          }, 200);
        });

      } catch (error: any) {
        console.error('Map initialization error:', error);
        setError(`Failed to initialize map: ${error.message || 'Unknown error'}`);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      // Remove all drone markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [coordinates]);

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '1px solid #d1d5db' }}>
        <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>Loading map...</p>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Geocoding address...</p>
      </div>
    );
  }

  if (error && !coordinates) {
    return (
      <div style={{ width: '100%', height: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '1px solid #d1d5db' }}>
        <p style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Error: {error}</p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Using default location</p>
      </div>
    );
  }

  if (!coordinates) {
    return (
      <div style={{ width: '100%', height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '1px solid #d1d5db' }}>
        <p style={{ color: '#6b7280' }}>Unable to load map coordinates</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #d1d5db', backgroundColor: '#e5e7eb', position: 'relative' }}>
      {error && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.875rem', color: '#dc2626' }}>
          Warning: {error}
        </div>
      )}
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '600px',
          position: 'relative',
          display: 'block'
        }} 
      />
      {coordinates && (
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#6b7280' }}>
          Coordinates: {coordinates[1].toFixed(4)}, {coordinates[0].toFixed(4)}
        </div>
      )}
    </div>
  );
}
