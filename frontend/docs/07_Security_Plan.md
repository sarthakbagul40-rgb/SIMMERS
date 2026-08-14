# Security & Privacy Plan

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  

---

## 1. Client-Side API Key Safety
* **The Vulnerability:** Hardcoding keys in front-end client bundles allows extraction by simple APK decompilation.
* **The Protection:** Kitchen Hero **does not ship** with a default API key. 
  1. The user must manually input their personal Google AI Studio API key in settings.
  2. The key is stored purely inside the browser's local sandbox (`localStorage.pantry_rpg_settings`).
  3. No network calls transmit this key outside of the direct HTTPS channel to `generativelanguage.googleapis.com`.

---

## 2. Backup File Security & Sanitization
* **The Threat:** Malicious file uploads containing JavaScript code (XSS injections) inside imported backups.
* **The Protection:** 
  1. The import service uses a standard `FileReader` restricting content reads to UTF-8 text only.
  2. The JSON parser validates input formats strictly.
  3. Every imported field is filtered and sanitised before local storage storage:
     * User level range is locked between `1` and `50`.
     * Mascot health is clamped between `0` and `100`.
     * Arrays are checked using `Array.isArray()`.
     * String fields are sanitized to escape HTML tags.

---

## 3. Data Privacy & GDPR Compliance
Because the app uses zero servers, the user's privacy is protected by design:
* **Zero Data Transmission:** Inventory list, mascot level, and usage stats never leave the user's local device.
* **Right to be Forgotten:** Settings tab contains a "Delete All Data" option which immediately wipes the browser's `localStorage` namespace, deleting all app-related information instantly.
* **Data Portability:** Users can download a JSON backup containing their full profile history at any time.

---

## 4. In-App Purchase Integrity (Pro Pass)
* **The Sim:** To keep the codebase lightweight and 100% free of costly native payment SDKs, the Pro Pass purchase is simulated in Settings.
* **Production Path:** If migrating to Google Play In-App Purchases, the status flag should be verified using cryptographically signed digital receipts validated via Google Play Billing API.
