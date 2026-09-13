import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { geocodeAndCacheToDB, getCachedCoords } from "@/lib/geocoding";

// Haversine distance in km between two lat/lng points
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type MapPoint = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  date?: string;
  value?: number;
  count: number;
  revenue: number;
  // For clustering — raw children if this is a cluster
  children?: MapPoint[];
  isCluster?: boolean;
};

export default function MarketMap({ isActive = true }: { isActive?: boolean }) {
  const queryClient = useQueryClient();
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [geocodeNonce, setGeocodeNonce] = useState(0);
  const [geocodeResults, setGeocodeResults] = useState<{
    success: number;
    failed: number;
    failedLocations: string[];
  } | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(7);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const { data: weddings = [], isLoading: loadingWeddings } = useQuery({
    queryKey: ["market-map-weddings"],
    queryFn: api.getWeddings,
  });

  const { data: venueGeocodes = [] } = useQuery({
    queryKey: ["venue-geocodes"],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("venue_geocodes")
        .select("location, lat, lng");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const bookedWeddings = useMemo(() => {
    return weddings.filter(
      (w: any) =>
        w.location &&
        w.location !== "TBD" &&
        !w.notes?.includes("[UNPAID_DRAFT]") &&
        w.status !== "cancelled" &&
        w.status !== "draft",
    );
  }, [weddings]);

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, { location: string; entries: any[] }>();
    bookedWeddings.forEach((w: any) => {
      if (!map.has(w.location))
        map.set(w.location, { location: w.location, entries: [] });
      map.get(w.location)!.entries.push(w);
    });
    return Array.from(map.values());
  }, [bookedWeddings]);
  const geocodeAll = async (forceRegeocode = false) => {
    setGeocoding(true);
    setGeocodeResults(null);

    // If force re-geocode, clear all cached coords in DB for these locations
    if (forceRegeocode) {
      const { supabase } = await import("@/lib/supabase");
      const locations = groupedByLocation.map((g) => g.location);
      // Clear venue_geocodes
      await supabase.from("venue_geocodes").delete().in("location", locations);
      // Clear wedding venue_lat/lng
      await supabase
        .from("weddings")
        .update({ venue_lat: null, venue_lng: null })
        .in("location", locations);
      // Clear local cache
      try {
        localStorage.removeItem("veydra_geocode_cache_v3");
      } catch {}
      // Refetch geocodes
      await queryClient.invalidateQueries({ queryKey: ["venue-geocodes"] });
      await queryClient.invalidateQueries({
        queryKey: ["market-map-weddings"],
      });
    }

    const weddingsWithCoords = new Set(
      weddings
        .filter((w: any) => w.venue_lat != null && w.venue_lng != null)
        .map((w: any) => w.location),
    );

    const toGeocode = groupedByLocation.filter((g) => {
      if (forceRegeocode) return true;
      if (weddingsWithCoords.has(g.location)) return false;
      const dbHas = venueGeocodes.some(
        (g2: any) => g2.location === g.location && g2.lat != null,
      );
      if (dbHas) return false;
      return true;
    });

    if (toGeocode.length === 0) {
      toast.info("All venues are already geocoded.");
      setGeocoding(false);
      return;
    }

    setGeocodeProgress({ done: 0, total: toGeocode.length });
    let done = 0;
    let successCount = 0;
    let failCount = 0;
    const failedLocations: string[] = [];

    for (const group of toGeocode) {
      const weddingEntry = weddings.find(
        (w: any) => w.location === group.location,
      );
      const coords = await geocodeAndCacheToDB(
        group.location,
        weddingEntry?.id,
        forceRegeocode,
      );
      if (coords) {
        successCount++;
      } else {
        failCount++;
        failedLocations.push(group.location);
      }
      done++;
      setGeocodeProgress({ done, total: toGeocode.length });
    }

    await queryClient.invalidateQueries({ queryKey: ["market-map-weddings"] });
    await queryClient.invalidateQueries({ queryKey: ["venue-geocodes"] });
    setGeocodeNonce((n) => n + 1);
    setGeocoding(false);
    setGeocodeResults({
      success: successCount,
      failed: failCount,
      failedLocations,
    });
  };

  // Build ALL raw points (one per unique venue location)
  const rawPoints: MapPoint[] = useMemo(() => {
    const coordCache = new Map<string, [number, number]>();

    venueGeocodes.forEach((g: any) => {
      if (g.lat != null && g.lng != null && g.location) {
        coordCache.set(g.location, [g.lat, g.lng]);
      }
    });

    weddings.forEach((w: any) => {
      if (w.venue_lat != null && w.venue_lng != null && w.location) {
        if (!coordCache.has(w.location)) {
          coordCache.set(w.location, [w.venue_lat, w.venue_lng]);
        }
      }
    });

    const points: MapPoint[] = [];
    groupedByLocation.forEach((group) => {
      const coords =
        coordCache.get(group.location) || getCachedCoords(group.location);
      if (!coords) return;

      points.push({
        id: group.location,
        name:
          group.location.length > 40
            ? group.location.substring(0, 37) + "..."
            : group.location,
        location: group.location,
        lat: coords[0],
        lng: coords[1],
        count: group.entries.length,
        revenue: group.entries.reduce(
          (sum, w) => sum + (w.total_amount || 0),
          0,
        ),
      });
    });

    console.log(
      `[MarketMap] Built ${points.length} raw points from ${groupedByLocation.length} locations`,
    );
    return points;
  }, [groupedByLocation, weddings, venueGeocodes, geocodeNonce]);

  // Zoom-dependent clustering:
  // - Zoom <= 8: Cluster everything into single bubbles (big radius, combined count)
  // - Zoom 9-11: Semi-clustered (10km threshold)
  // - Zoom >= 12: Show every venue individually
  const visiblePoints: MapPoint[] = useMemo(() => {
    if (rawPoints.length === 0) return [];

    // High zoom: show everything individually
    if (currentZoom >= 12) {
      return rawPoints.map((p) => ({ ...p, isCluster: false }));
    }

    // Medium zoom: 10km clusters
    const thresholdKm = currentZoom >= 9 ? 10 : 25;

    const clusters: MapPoint[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < rawPoints.length; i++) {
      if (assigned.has(i)) continue;

      const clusterChildren = [rawPoints[i]];
      assigned.add(i);

      for (let j = i + 1; j < rawPoints.length; j++) {
        if (assigned.has(j)) continue;
        const dist = haversineKm(
          rawPoints[i].lat,
          rawPoints[i].lng,
          rawPoints[j].lat,
          rawPoints[j].lng,
        );
        if (dist <= thresholdKm) {
          clusterChildren.push(rawPoints[j]);
          assigned.add(j);
        }
      }

      const totalCount = clusterChildren.reduce((s, p) => s + p.count, 0);
      const totalRev = clusterChildren.reduce((s, p) => s + p.revenue, 0);
      const cLat =
        clusterChildren.reduce((s, p) => s + p.lat * p.count, 0) / totalCount;
      const cLng =
        clusterChildren.reduce((s, p) => s + p.lng * p.count, 0) / totalCount;

      if (clusterChildren.length === 1) {
        // Single point, not really a cluster
        clusters.push({ ...clusterChildren[0], isCluster: false });
      } else {
        clusters.push({
          id: `cluster-${i}`,
          name: `${clusterChildren.length} venues`,
          location: clusterChildren.map((c) => c.name).join(", "),
          lat: cLat,
          lng: cLng,
          count: totalCount,
          revenue: totalRev,
          children: clusterChildren,
          isCluster: true,
        });
      }
    }

    console.log(
      `[MarketMap] Zoom ${currentZoom}: ${clusters.length} visible (${clusters.filter((c) => c.isCluster).length} clusters) from ${rawPoints.length} raw`,
    );
    return clusters;
  }, [rawPoints, currentZoom]);

  const totalRevenue = rawPoints.reduce((sum, p) => sum + p.revenue, 0);
  const totalBookings = rawPoints.reduce((sum, p) => sum + p.count, 0);
  const uniqueVenues = rawPoints.length;
  const needsGeocoding = groupedByLocation.length - rawPoints.length;

  const getRadius = useCallback(
    (count: number) => Math.min(Math.max(14 + count * 4, 14), 48),
    [],
  );

  // Absolute concentration thresholds
  const getColor = useCallback((count: number): string => {
    if (count >= 4) return "#dc2626"; // red — high concentration
    if (count >= 2) return "#f59e0b"; // amber — medium
    return "#0d9488"; // teal — low
  }, []);

  // Initialize map ONLY when this tab is active and container has real dimensions
  useEffect(() => {
    if (!isActive) return;
    if (mapInstanceRef.current) return;

    let retryCount = 0;
    const maxRetries = 20;

    const tryInit = () => {
      const el = mapRef.current;
      if (!el || mapInstanceRef.current) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) {
        retryCount++;
        if (retryCount < maxRetries) setTimeout(tryInit, 250);
        return;
      }

      try {
        const map = L.map(el, {
          center: [36.0, -86.5], // Center on Tennessee area
          zoom: 7,
          scrollWheelZoom: true,
          attributionControl: true,
          zoomControl: true,
        });

        // Light grayscale tiles so colored markers pop
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            maxZoom: 19,
          },
        ).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapInitialized(true);

        // Track zoom level changes
        map.on("zoomend", () => {
          const z = map.getZoom();
          setCurrentZoom(z);
          console.log(`[MarketMap] Zoom changed to ${z}`);
        });

        // Set initial zoom
        setCurrentZoom(map.getZoom());

        const fixSize = () => {
          if (mapInstanceRef.current)
            mapInstanceRef.current.invalidateSize({ animate: false });
        };
        [100, 300, 600, 1000].forEach((d) => setTimeout(fixSize, d));

        const resizeObserver = new ResizeObserver(() => fixSize());
        resizeObserver.observe(el);

        const onWindowResize = () => fixSize();
        window.addEventListener("resize", onWindowResize);

        (map as any)._cleanup = () => {
          resizeObserver.disconnect();
          window.removeEventListener("resize", onWindowResize);
        };
      } catch (err) {
        console.error("Map init failed:", err);
      }
    };

    const timer = setTimeout(tryInit, 150);
    return () => clearTimeout(timer);
  }, [isActive]);

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as any)._cleanup?.();
        if (mapInstanceRef.current) mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        setMapInitialized(false);
      }
    };
  }, []);

  // Track whether we've done the initial fitBounds (only once)
  const hasInitialFitRef = useRef(false);

  // Update markers when visiblePoints or zoom changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer || !mapInitialized) return;

    layer.clearLayers();
    if (visiblePoints.length === 0) return;

    visiblePoints.forEach((point) => {
      const color = getColor(point.count);
      const radius = getRadius(point.count);
      const circle = L.circleMarker([point.lat, point.lng], {
        radius,
        color: "#ffffff",
        weight: point.isCluster ? 4 : 2.5,
        fillColor: color,
        fillOpacity: 0.75,
      });

      let tooltipContent: string;
      if (point.isCluster && point.children) {
        const venueNames = point.children
          .slice(0, 5)
          .map((c) => c.name)
          .join("<br/>");
        const more =
          point.children.length > 5
            ? `<br/><em style="color:#888">+${point.children.length - 5} more</em>`
            : "";
        tooltipContent = `<div style="font-size: 12px;"><strong>${point.name}</strong><br/>${venueNames}${more}<br/><br/><strong>${point.count} bookings</strong> • $${point.revenue.toLocaleString()}</div>`;
      } else {
        tooltipContent = `<div style="font-size: 12px;"><strong>${point.name}</strong><br/><br/><strong>${point.count} booking${point.count === 1 ? "" : "s"}</strong> • $${point.revenue.toLocaleString()}</div>`;
      }

      circle.bindTooltip(tooltipContent);
      circle.bindPopup(tooltipContent);
      layer.addLayer(circle);

      const label = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "venue-count-label",
          html: `<div style="font-size: ${Math.max(11, Math.min(18, radius * 0.55))}px; font-weight: 800; color: #fff; text-align: center; line-height: 1; text-shadow: 0 1px 3px rgba(0,0,0,0.5); pointer-events: none;">${point.count}</div>`,
          iconSize: [30, 22],
          iconAnchor: [15, 11],
        }),
        interactive: false,
      });
      layer.addLayer(label);
    });

    // Only fit bounds on initial load — NOT on every zoom change
    if (!hasInitialFitRef.current && visiblePoints.length > 0) {
      const bounds = L.latLngBounds(
        visiblePoints.map((p) => [p.lat, p.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasInitialFitRef.current = true;
    }
  }, [visiblePoints, mapInitialized, getColor, getRadius]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Booking Concentration Map
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize where your booked weddings are concentrated to plan
            marketing spend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => geocodeAll(false)}
            disabled={geocoding || needsGeocoding === 0}
            className="rounded-full text-xs h-8"
          >
            {geocoding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Geocoding {geocodeProgress.done}/{geocodeProgress.total}
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {needsGeocoding > 0
                  ? `Geocode ${needsGeocoding} venues`
                  : "Refresh Map"}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => geocodeAll(true)}
            disabled={geocoding}
            className="rounded-full text-xs h-8 text-amber-600 hover:text-amber-700"
            title="Clear all cached coords and re-geocode every venue from scratch"
          >
            {geocoding ? null : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-geocode All
              </>
            )}
          </Button>
        </div>
      </div>

      {geocoding && geocodeProgress.total > 0 && (
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Geocoding venues... {geocodeProgress.done} of{" "}
              {geocodeProgress.total}
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {Math.round((geocodeProgress.done / geocodeProgress.total) * 100)}
              %
            </span>
          </div>
          <div className="h-2 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{
                width: `${(geocodeProgress.done / geocodeProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {geocodeResults && !geocoding && (
        <div
          className={`flex items-start gap-3 p-4 rounded-2xl border ${
            geocodeResults.failed === 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          {geocodeResults.failed === 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0 text-sm font-semibold">
            Geocoding complete: {geocodeResults.success} succeeded,{" "}
            {geocodeResults.failed} failed
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setGeocodeResults(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Unique Venues
            </span>
            <div className="text-2xl font-bold tracking-tight mt-1">
              {uniqueVenues}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Total Bookings
            </span>
            <div className="text-2xl font-bold tracking-tight mt-1">
              {totalBookings}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Mapped Revenue
            </span>
            <div className="text-2xl font-bold tracking-tight mt-1 text-emerald-600">
              ${totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Needs Geocoding
            </span>
            <div className="text-2xl font-bold tracking-tight mt-1 text-amber-600">
              {needsGeocoding}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 rounded-3xl border-border/40 bg-card overflow-hidden shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  Booked Wedding Map
                </CardTitle>
                <CardDescription className="text-xs">
                  Bubble size = booking count • Color = concentration level
                </CardDescription>
              </div>
              {/* Color legend */}
              <div className="flex items-center gap-3 text-[10px] font-medium">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: "#0d9488" }}
                  />
                  <span className="text-muted-foreground">1 booking</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: "#f59e0b" }}
                  />
                  <span className="text-muted-foreground">2-3 bookings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: "#dc2626" }}
                  />
                  <span className="text-muted-foreground">4+ bookings</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <div
                ref={mapRef}
                style={{
                  height: "480px",
                  width: "100%",
                  backgroundColor: "#e8eaed",
                }}
              />
              {rawPoints.length === 0 && !geocoding && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-white/80 backdrop-blur-sm">
                  <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground max-w-xs">
                    {needsGeocoding > 0
                      ? `${needsGeocoding} venues need geocoding.`
                      : "No booked weddings with locations found."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 rounded-3xl border-border/40 bg-card overflow-hidden shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">
              Top Venues by Bookings
            </CardTitle>
            <CardDescription className="text-xs">
              Highest-concentration venues for marketing focus
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 max-h-[480px] overflow-y-auto">
            <div className="space-y-3">
              {[...visiblePoints]
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map((point, idx) => {
                  const dotColor =
                    point.count >= 4
                      ? "#dc2626"
                      : point.count >= 2
                        ? "#f59e0b"
                        : "#0d9488";
                  return (
                    <div
                      key={point.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-muted/20"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: dotColor }}
                      >
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {point.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div
                            className="flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: dotColor }}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                            {point.count} booking{point.count !== 1 ? "s" : ""}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            •
                          </div>
                          <div className="text-[10px] text-muted-foreground font-medium">
                            ${point.revenue.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
