# StudioSpace - B14-A08 - Backend

This is the Express.js backend for StudioSpace, a platform for discovering, booking, and managing creative studio spaces. It serves studio listings and booking data from MongoDB and validates protected requests using JWT-based authentication.

## Frontend Repository

- https://github.com/SajidSarman/b14-a08

## Tech Stack

- Backend: Express.js, Node.js, JavaScript
- Database: MongoDB
- Authentication: JWT verification via JWKS from the frontend auth service

## Features

- Browse studio listings and featured studios
- View individual studio details
- Create, update, and delete studio listings
- Create bookings for customers
- Fetch customer and host bookings
- Update booking status (pending, confirmed, completed, cancelled)
- Store studio metadata and booking records in MongoDB
- Store ImgBB image URLs with studio listings

## API Routes

### Studios

- `GET /` — Health check endpoint
- `GET /studios` — Retrieve all studio listings
- `GET /studios/:id` — Retrieve a single studio by ID
- `GET /top6studios` — Retrieve featured studios
- `POST /add-studio` — Create a studio listing (protected)
- `PUT /studios/:id` — Update a studio listing (protected)
- `DELETE /studios/:id` — Delete a studio listing (protected)

### Bookings

- `GET /bookings?customerEmail=:email` — Retrieve a customer's bookings (protected)
- `GET /bookings?hostEmail=:email` — Retrieve a host's bookings (protected)
- `POST /bookings` — Create a booking (protected)
- `PATCH /bookings/:id` — Update booking status or cancel a booking (protected)

Protected routes validate the user's JWT token and verify the caller is authorized to perform the requested action.

## Studio Images

The frontend uploads studio images to ImgBB and sends the resulting `imageUrl` with the studio listing. This backend stores that URL in MongoDB; it does not upload or store the image file itself.

## Environment Variables

Create a `.env` file in the project root with values similar to the following:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=https://your-frontend-domain
```

Notes:
- `CLIENT_URL` is used to fetch the JWKS endpoint for JWT verification.
- The backend expects the frontend application to expose the auth JWKS route at `${CLIENT_URL}/api/auth/jwks`.

## Notes

- The server uses MongoDB collections named `studios` and `bookings`.
- You will need a valid MongoDB connection string and a frontend app that exposes the JWKS endpoint for authenticated requests to work correctly.
