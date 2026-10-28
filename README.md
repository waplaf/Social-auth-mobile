# Belora mobile

Expo Router companion app for Belora. Login and personal account details use the Salaox website. Services, professionals, business profiles, categories, booking creation, and reservation lists/details use native mobile screens backed by the same website APIs and database. “Products” refers to services provided by businesses, not physical inventory. Checkout/payment and existing service editing remain on the website.

## Configure the web URL

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SALAOX_WEB_URL` to the deployed Salaox/Belora origin. For local device development, use a LAN address reachable from the phone instead of `localhost`.

Restart Expo after changing environment values:

```bash
npm start
```

The discovery screen is public and searchable by service, professional, category, and city, following the catalog used by `salaox/app/page.tsx`. Results are paginated from the same public business data used by the website. Selecting a service or professional opens a native business profile, from which customers can book. The agenda, customer reservations and business catalog use the website sign-in handoff. Business category listing and creation are native.

## Website sign-in

All mobile sign-in buttons use `src/services/mobile-auth.ts`: the app opens the Salaox `/mobile/authorize` page in an authentication browser session. The website uses its existing Firebase Google login and session cookie, then returns to `oil-radar://mobile-auth?token=...`. Set `NEXT_PUBLIC_MOBILE_SCHEME="oil-radar"` in the website environment to match `expo.scheme` in the app. The callback token is a short-lived (90 seconds), single-use authorization code protected by PKCE. The app exchanges it at `/api/mobile-auth/exchange`; the backend obtains the Firebase JWT and refresh token and returns `{ idToken, refreshToken, expiresIn }`. The app stores the refresh token in SecureStore and keeps the JWT in memory. Renewal also goes through the website at `/api/mobile-auth/refresh`. Mobile API requests send the JWT as `Authorization: Bearer ...`, validated by Firebase Admin on the backend. The app makes no direct Firebase authentication requests. Deploy the updated website before distributing the updated app.

The “A minha conta” button uses this same handoff and opens `/perfil` on the website to view personal details. If the account browser has no session cookie, the website signs in and returns to `/perfil`. The callback route returns to the screen that opened the login browser. Cancelling login leaves the app signed out. Use an Android/iOS development or production build to verify the complete browser-to-app flow. For a deployed website, configure an HTTPS origin; for local development, start `salaox` and use its LAN URL reachable from the phone.

## Backend requirements

The `salaox` web app needs the `MobileAuthCode` Prisma migration applied before mobile sign-in, agenda, and business-catalog requests will work. From `salaox`, apply it in the target environment with the project's normal Prisma migration workflow. The app does not create or modify the production database automatically.

Run authentication contract tests from `salaox` with `node --test scripts/mobile-session.test.mjs`. These tests mock Firebase, browser callbacks and SecureStore; a device login is still required to verify the deployed Google/browser/deep-link integration.
