<?php
class JWT {
    public static function generate(array $payload): string {
        $header  = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['exp'] = time() + JWT_EXPIRY;
        $payload['iat'] = time();
        $body    = base64_encode(json_encode($payload));
        $sig     = base64_encode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
        return "$header.$body.$sig";
    }

    public static function verify(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $body, $sig] = $parts;
        $validSig = base64_encode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));

        if (!hash_equals($validSig, $sig)) return null;

        $payload = json_decode(base64_decode($body), true);
        if (!$payload || $payload['exp'] < time()) return null;

        return $payload;
    }

    public static function fromRequest(): ?array {
        $headers = getallheaders();
        $auth    = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (!str_starts_with($auth, 'Bearer ')) return null;
        return self::verify(substr($auth, 7));
    }
}