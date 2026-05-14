<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UtilsController extends Controller
{
    // GET /api/v1/resolve-gmaps?url=...
    // Follows a Google Maps short URL and extracts lat/lng + place info via Photon.
    public function resolveGmaps(Request $request): JsonResponse
    {
        $url = $request->query('url', '');

        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['error' => 'URL inválida'], 400);
        }

        // Only allow Google Maps domains
        $host = parse_url($url, PHP_URL_HOST) ?? '';
        $allowed = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com'];
        if (!in_array($host, $allowed)) {
            return response()->json(['error' => 'Solo se aceptan links de Google Maps'], 400);
        }

        // 1. Follow redirects to get the final Google Maps URL
        $resolved = $this->followRedirects($url);
        if (!$resolved) {
            return response()->json(['error' => 'No se pudo resolver el link'], 502);
        }

        // 2. Extract map-center coords from /@lat,lng,zoom
        $lat = null;
        $lng = null;
        if (preg_match('/@(-?\d+\.\d+),(-?\d+\.\d+)/', $resolved, $m)) {
            $lat = $m[1];
            $lng = $m[2];
        } elseif (preg_match('/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/', $resolved, $m)) {
            $lat = $m[1];
            $lng = $m[2];
        }

        if (!$lat || !$lng) {
            return response()->json(['error' => 'No se encontraron coordenadas en el link'], 422);
        }

        // 3. Use precise place coords from data param !3d<lat>!4d<lng> when available
        //    These are the actual pinned location, more accurate than the map center
        if (preg_match('/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/', $resolved, $pd)) {
            $lat = $pd[1];
            $lng = $pd[2];
        }

        // 4. Place name from URL path /maps/place/Name/@...
        $name = null;
        if (preg_match('|/maps/place/([^/@?]+)|', $resolved, $np)) {
            $candidate = urldecode(str_replace('+', ' ', $np[1]));
            if (!preg_match('/^-?\d/', $candidate) && strlen($candidate) > 1) {
                $name = $candidate;
            }
        }

        // 5. Reverse geocode with Photon to get the street address
        $address = $this->photonReverse((float) $lat, (float) $lng);

        // 6. Build combined location label
        $location = null;
        if ($name && $address) {
            $location = "{$name} - {$address}";
        } elseif ($name) {
            $location = $name;
        } elseif ($address) {
            $location = $address;
        }

        return response()->json(array_filter([
            'lat'      => $lat,
            'lng'      => $lng,
            'name'     => $name,
            'address'  => $address,
            'location' => $location,
        ], fn($v) => $v !== null));
    }

    // GET /api/v1/search-location?q=...
    public function searchLocation(Request $request): JsonResponse
    {
        $q = trim($request->query('q', ''));
        if (strlen($q) < 3) {
            return response()->json(['features' => []]);
        }

        $url = "https://photon.komoot.io/api/?q=" . urlencode($q) . "&limit=6&lang=en";

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'GET',
                'ignore_errors' => true,
                'timeout'       => 6,
                'header'        => 'User-Agent: kawin-app',
            ],
            'ssl' => ['verify_peer' => false],
        ]);

        $body = @file_get_contents($url, false, $ctx);
        if (!$body) return response()->json(['features' => []]);

        $data = json_decode($body, true);
        return response()->json($data);
    }

    // Photon reverse geocoding — free, no API key, OSM-based, better POI support
    private function photonReverse(float $lat, float $lng): ?string
    {
        $url = "https://photon.komoot.io/reverse?lat={$lat}&lon={$lng}&lang=en";

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'GET',
                'ignore_errors' => true,
                'timeout'       => 6,
                'header'        => 'User-Agent: kawin-app',
            ],
            'ssl' => ['verify_peer' => false],
        ]);

        $body = @file_get_contents($url, false, $ctx);
        if (!$body) return null;

        $data = json_decode($body, true);
        $features = $data['features'] ?? [];
        if (empty($features)) return null;

        $p = $features[0]['properties'] ?? [];

        $parts = [];
        if (!empty($p['street'])) {
            $parts[] = !empty($p['housenumber'])
                ? $p['street'] . ' ' . $p['housenumber']
                : $p['street'];
        }
        if (!empty($p['city']))  $parts[] = $p['city'];
        if (!empty($p['state'])) $parts[] = $p['state'];

        return $parts ? implode(', ', $parts) : null;
    }

    private function followRedirects(string $url, int $maxHops = 10): ?string
    {
        $current = $url;

        for ($i = 0; $i < $maxHops; $i++) {
            $ctx = stream_context_create([
                'http' => [
                    'method'          => 'HEAD',
                    'follow_location' => 0,
                    'ignore_errors'   => true,
                    'timeout'         => 5,
                    'header'          => 'User-Agent: Mozilla/5.0',
                ],
                'ssl' => ['verify_peer' => false],
            ]);

            $headers = @get_headers($current, true, $ctx);
            if ($headers === false) break;

            $status = is_array($headers[0]) ? end($headers[0]) : $headers[0];
            $code   = (int) substr($status, 9, 3);

            if ($code >= 300 && $code < 400) {
                $location = is_array($headers['Location'] ?? null)
                    ? end($headers['Location'])
                    : ($headers['Location'] ?? null);

                if (!$location) break;

                if (!str_starts_with($location, 'http')) {
                    $parts    = parse_url($current);
                    $location = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') . $location;
                }

                $current = $location;
                continue;
            }

            return $current;
        }

        return $current;
    }
}
