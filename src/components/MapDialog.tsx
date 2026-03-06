import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface MapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  address: string;
  storeName: string;
}

const MapDialog: React.FC<MapDialogProps> = ({ 
  isOpen, 
  onClose, 
  latitude, 
  longitude, 
  address, 
  storeName 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    // Check if user has provided their own Mapbox token
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
    mapboxgl.accessToken = mapboxToken;
    
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 15,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add fullscreen control
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-left');
    }

    // Add or update marker
    if (marker.current) {
      marker.current.remove();
    }

    marker.current = new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat([longitude, latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 4px 0; font-weight: bold;">${storeName}</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">${address}</p>
            </div>
          `)
      )
      .addTo(map.current);

    return () => {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isOpen, latitude, longitude, address, storeName]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg font-semibold">
            Местоположение: {storeName}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Интерактивная карта с местоположением торговой точки
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 px-6 pb-6">
          <div 
            ref={mapContainer} 
            className="w-full h-full rounded-lg border border-border"
            style={{ minHeight: '500px' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapDialog;