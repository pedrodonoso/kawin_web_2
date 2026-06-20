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

        // Decode once so coords inside an encoded `continue=` param (consent
        // redirects) are also matchable.
        $decoded = urldecode($resolved);

        // 2. Extract coordinates from any known Google Maps pattern. Order
        //    matters: the pinned place coords in the data param !3d<lat>!4d<lng>
        //    are the most accurate and are often the ONLY coords present in links
        //    shared from the mobile app (which usually omit /@lat,lng,zoom). The
        //    /@ segment is what desktop browser address-bar URLs carry. The query
        //    params cover the Maps URL API, dir/search links and dropped pins.
        $lat = null;
        $lng = null;
        $coordPatterns = [
            '/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/',                                               // pinned place (mobile + desktop place)
            '/@(-?\d+\.\d+),(-?\d+\.\d+)/',                                                   // map center (desktop address bar)
            '/[?&](?:q|ll|sll|daddr|destination|center|query)=(?:loc:)?(-?\d+\.\d+),(-?\d+\.\d+)/', // query / dir / API coords
        ];
        foreach ($coordPatterns as $re) {
            if (preg_match($re, $decoded, $m)) {
                $lat = $m[1];
                $lng = $m[2];
                break;
            }
        }

        // 3. Place name / textual query from the URL — used as the address label
        //    and, when no coords are present, as a forward-geocoding fallback.
        $name = $this->extractPlaceQuery($resolved, $decoded);

        // 4. Fallback: links without coordinates in the URL (plus codes,
        //    name-only short links, ?query=Some+Place) — geocode the name.
        $address = null;
        if ((!$lat || !$lng) && $name) {
            [$lat, $lng, $address] = $this->photonForward($name);
        }

        if (!$lat || !$lng) {
            return response()->json(['error' => 'No se encontraron coordenadas en el link'], 422);
        }

        // 5. Reverse geocode with Photon to get the street address (unless the
        //    forward-geocode fallback already produced one).
        if ($address === null) {
            $address = $this->photonReverse((float) $lat, (float) $lng);
        }

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

        $base = rtrim(env('PHOTON_BASE_URL', 'https://photon.komoot.io'), '/');
        $lang = env('PHOTON_LANG', 'en');
        $url = "{$base}/api/?q=" . urlencode($q) . "&limit=6&lang={$lang}";

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

    // Pull a human place name / textual query out of a Google Maps URL. Used as
    // the address label and as the forward-geocoding fallback when a link has no
    // coordinates (plus codes, name-only short links, ?query=Some+Place).
    private function extractPlaceQuery(string $resolved, string $decoded): ?string
    {
        // /maps/place/<Name> or /maps/search/<Name>
        if (preg_match('#/maps/(?:place|search)/([^/@?]+)#', $resolved, $np)) {
            $raw = rawurldecode($np[1]); // decodes %xx but keeps '+' (plus codes)
            // Ignore segments that are really coordinates or Google Plus Codes
            $isCoord    = (bool) preg_match('/^-?\d+\.\d+/', $raw);
            $isPlusCode = (bool) preg_match('/^[A-Z0-9]{4,}\+[A-Z0-9]+/i', $raw);
            if (!$isCoord && !$isPlusCode) {
                $candidate = trim(str_replace('+', ' ', $raw));
                if (strlen($candidate) > 1) {
                    return $candidate;
                }
            }
        }

        // ?query=<text> / ?q=<text> that is not a coordinate pair
        if (preg_match('/[?&](?:query|q)=([^&]+)/', $decoded, $qp)) {
            $candidate = trim(str_replace('+', ' ', $qp[1]));
            if ($candidate !== '' && !preg_match('/^-?\d+\.\d+,/', $candidate)
                && !str_starts_with($candidate, 'loc:')) {
                return $candidate;
            }
        }

        return null;
    }

    // Photon reverse geocoding — free, no API key, OSM-based, better POI support
    private function photonReverse(float $lat, float $lng): ?string
    {
        $base = rtrim(env('PHOTON_BASE_URL', 'https://photon.komoot.io'), '/');
        $lang = env('PHOTON_LANG', 'en');
        $url = "{$base}/reverse?lat={$lat}&lon={$lng}&lang={$lang}";

        $body = $this->httpGet($url);
        if (!$body) return null;

        $data = json_decode($body, true);
        $features = $data['features'] ?? [];
        if (empty($features)) return null;

        return $this->formatPhotonProps($features[0]['properties'] ?? []);
    }

    // Photon forward geocoding — turn a place name / address into coordinates.
    // Returns [lat, lng, address] or [null, null, null] when nothing is found.
    private function photonForward(string $query): array
    {
        $base = rtrim(env('PHOTON_BASE_URL', 'https://photon.komoot.io'), '/');
        $lang = env('PHOTON_LANG', 'en');
        $url = "{$base}/api/?q=" . urlencode($query) . "&limit=1&lang={$lang}";

        $body = $this->httpGet($url);
        if (!$body) return [null, null, null];

        $data = json_decode($body, true);
        $feature = $data['features'][0] ?? null;
        $coords  = $feature['geometry']['coordinates'] ?? null; // [lng, lat]
        if (!$coords || count($coords) < 2) return [null, null, null];

        return [
            (string) $coords[1],
            (string) $coords[0],
            $this->formatPhotonProps($feature['properties'] ?? []),
        ];
    }

    // Build a short "street number, city, state" label from Photon properties.
    private function formatPhotonProps(array $p): ?string
    {
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

    // Shared GET helper for Photon calls.
    private function httpGet(string $url): ?string
    {
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
        return $body !== false ? $body : null;
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
