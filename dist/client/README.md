# bjb-webapp - Client

## Running with Vite Preview
```bash
vite preview --outDir . --port 8081
```

This will serve the static files on http://localhost:8081 using Vite preview server.

## API Proxy Configuration
The vite.config.js file is included and configured with proxy settings:
- `/api` requests are proxied to `http://localhost:9090/api/`
- `/socket.io` requests are proxied to `ws://localhost:9090`

Make sure your backend server is running on port 9090 for API calls to work.

Run from root directory to access node_modules.
