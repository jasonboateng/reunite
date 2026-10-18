# Live deployment

The frontend is a Next.js app in `apps/web`. The API is a separate Fastify service in `apps/api`; deploying the frontend alone does not make the API reachable from Vercel.

## Vercel frontend

1. Push this repository to a Git provider, then import it as a Vercel project.
2. Set the Vercel project Root Directory to `apps/web` and use the Next.js framework preset.
3. Add `NEXT_PUBLIC_API_BASE_URL` and `API_PROXY_ORIGIN` as environment variables. Set both to the public HTTPS URL of the deployed API, with no trailing slash.
4. Deploy. `NEXT_PUBLIC_API_BASE_URL` is included in the frontend at build time, so redeploy after changing it.

Browser API requests use the Next.js `/api` rewrite to keep session cookies first-party. Server-rendered pages use `NEXT_PUBLIC_API_BASE_URL` to fetch public data directly.

## API service

Deploy `apps/api` to a public Node.js host and configure:

- `MONGODB_URI` and `MONGODB_DATABASE`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
- `FRONTEND_ORIGIN` as the exact Vercel site origin, such as `https://reunite-example.vercel.app`
- `API_PORT` if required by the host

Keep the Cloudinary API secret and MongoDB credentials only in the API host's environment settings. Do not add them to Vercel frontend variables.
