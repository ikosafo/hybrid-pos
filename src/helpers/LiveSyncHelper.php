<?php
/**
 * LiveSyncHelper — Triggers sync FROM live TO local
 * Called whenever data changes on live server (bestcobb.shop)
 */
class LiveSyncHelper {
    
    /**
     * Push changed records to local server asynchronously
     */
    public static function pushToLocal(string $entityType, array $uuids): void {
        // Only run on live server
        if (!IS_LIVE_SERVER) return;
        
        // Don't block the response — finish request first
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        
        self::sendAsync($entityType, $uuids);
    }
    
    /**
     * Send data to local server via cURL (non-blocking)
     */
    private static function sendAsync(string $entityType, array $uuids): void {
        $url = LOCAL_SERVER_URL . '/sync/receive';
        
        $payload = json_encode([
            'entity_type' => $entityType,
            'uuids'       => $uuids,
        ]);
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'X-Sync-Key: ' . SYNC_API_KEY,
            ],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        error_log("[LiveSync] Pushed {$entityType} to local — HTTP {$httpCode}");
    }
}