# Kiapat Mobile (Android)

This Android project mirrors the Kiapat backend endpoints and web flows using Kotlin, Jetpack Compose, MVVM, Retrofit, DataStore, and Navigation Compose.

## Getting started

1. Ensure you have Android Studio Iguana or newer with JDK 17.
2. Regenerate the Gradle wrapper (the wrapper JAR cannot be downloaded in this environment):

```bash
gradle wrapper --gradle-version 8.7
```

3. Open the `android` folder in Android Studio and let it sync dependencies.
4. Update `DEFAULT_BASE_URL` in `MainActivity` if you run the backend on a different host.

## Feature map

- **Authentication:** Uses `/api/auth/login` and stores the bearer token and role in DataStore.
- **Navigation:** Drivers are routed to the driver invoice screen; admins land on the dashboard.
- **API coverage:** Retrofit interfaces mirror endpoints in `server/app/routers/*` and models in `server/app/schemas.py`.
- **UI:** Compose screens for login, admin dashboard, and driver delivery slips with Kiapat color palette from Tailwind config.
