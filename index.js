import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

// Call this only when your application terminates
// export async function disconnectFromMongoDB() {
//   await client.close();
// }

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("StudioSpace-B14-A08");

const studioCollection = db.collection("studios");
const bookingCollection = db.collection("bookings");

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    // console.log("Decoded JWT payload:", payload);
    next();
  } catch (error) {
    return res.status(500).send({ msg: "Server Error" });
  }
};

// Add Studio form -> Next.js POST /api/studios -> POST /add-studio
app.post("/add-studio", verifyToken, async (req, res) => {
  const studioData = req.body;
  const result = await studioCollection.insertOne(studioData);

  console.log(result);
  res.send(result);
});

app.get("/", (req, res) => {
  res.send({ message: "Server is running fine!" });
});

// Public: studio browsing page -> GET /studios
app.get("/studios", async (req, res) => {
  const studios = await studioCollection.find().toArray();
  res.send(studios);
});

// Public: homepage Featured Studios -> GET /top6studios
app.get("/top6studios", async (req, res) => {
  try {
    const studios = await studioCollection
      .find()
      .sort({ _id: -1 })
      .limit(6)
      .toArray();

    res.json(studios);
  } catch (error) {
    console.error("Failed to fetch featured studios:", error);
    res.status(500).json({ message: "Failed to fetch featured studios." });
  }
});

// Public: Studio Details page -> GET /studios/:id
app.get("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const studio = await studioCollection.findOne({ _id: new ObjectId(id) });
  res.send(studio);
});

// Edit Studio form -> Next.js PUT /api/studios/:id -> PUT /studios/:id
app.put("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const studio = await studioCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );

  res.json(studio);
});

// My Listings manager -> Next.js DELETE /api/studios/:id -> DELETE /studios/:id
app.delete("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const studio = await studioCollection.deleteOne({ _id: new ObjectId(id) });

  res.json(studio);
});

// My Bookings and Host Bookings pages -> GET /bookings
app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const { customerEmail, hostEmail } = req.query;

    const email = hostEmail || customerEmail;
    const field = hostEmail ? "hostEmail" : "customerEmail";

    if (typeof email !== "string" || !email) {
      return res.status(400).json({
        message: "Provide customerEmail or hostEmail.",
      });
    }

    const bookings = await bookingCollection
      .find({ [field]: email })
      .sort({ startAt: 1 })
      .toArray();

    res.json({ bookings });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    res.status(500).json({ message: "Could not load bookings." });
  }
});

// Studio Details booking form -> Next.js POST /api/bookings -> POST /bookings
app.post("/bookings", verifyToken, async (req, res) => {
  const {
    studioId,
    customerEmail,
    customerName,
    date,
    startTime,
    startAt: requestedStart,
    duration,
    guests,
  } = req.body;

  if (
    typeof studioId !== "string" ||
    typeof customerEmail !== "string" ||
    !customerEmail ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 24 ||
    !Number.isInteger(guests) ||
    guests < 1
  ) {
    return res.status(400).json({
      message: "Please provide valid booking details.",
    });
  }

  const startAt = new Date(requestedStart);

  if (Number.isNaN(startAt.getTime()) || startAt <= new Date()) {
    return res.status(400).json({
      message: "Choose a booking time in the future.",
    });
  }

  const studio = await studioCollection.findOne({
    _id: new ObjectId(studioId),
  });

  if (!studio) {
    return res.status(404).json({ message: "Studio not found." });
  }

  if (studio.maxCapacity && guests > studio.maxCapacity) {
    return res.status(400).json({
      message: `This studio allows up to ${studio.maxCapacity} guests.`,
    });
  }

  const endAt = new Date(startAt.getTime() + duration * 60 * 60 * 1000);

  const conflict = await bookingCollection.findOne({
    studioId,
    status: "Confirmed",
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });

  if (conflict) {
    return res.status(409).json({
      message: "That time slot overlaps with a confirmed booking.",
    });
  }

  const booking = {
    studioId,
    studioTitle: studio.title,
    studioImage: studio.imageUrl ?? studio.images?.[0],
    hostEmail: studio.ownerEmail ?? studio.hostEmail,
    customerName,
    customerEmail,
    date,
    startTime,
    startAt,
    endAt,
    duration,
    guests,
    hourlyRate: studio.hourlyRate,
    total: studio.hourlyRate * duration,
    status: "Pending",
  };

  const result = await bookingCollection.insertOne(booking);
  res.status(201).json({ ...booking, _id: result.insertedId });
});

// My Bookings cancel action and Host Bookings status actions
// -> Next.js PATCH API routes -> PATCH /bookings/:id
app.patch("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { customerEmail, hostEmail, status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking ID." });
    }

    const booking = await bookingCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Customer can cancel only their own pending booking.
    if (status === "Cancelled") {
      if (customerEmail !== booking.customerEmail) {
        return res.status(403).json({
          message: "Not allowed to cancel this booking.",
        });
      }

      if (booking.status !== "Pending") {
        return res.status(409).json({
          message: "Only pending bookings can be cancelled.",
        });
      }
    } else if (status === "Confirmed" || status === "Completed") {
      // Verify the host owns the studio.
      const studioId = ObjectId.isValid(booking.studioId)
        ? new ObjectId(booking.studioId)
        : null;

      if (!studioId) {
        return res.status(400).json({
          message: "Invalid studio ID on booking.",
        });
      }

      const studio = await studioCollection.findOne({ _id: studioId });
      const ownerEmail = studio?.ownerEmail ?? studio?.hostEmail;

      if (!studio || hostEmail !== ownerEmail) {
        return res.status(403).json({
          message: "You are not allowed to update this booking.",
        });
      }

      if (status === "Confirmed" && booking.status !== "Pending") {
        return res.status(409).json({
          message: "Only pending bookings can be confirmed.",
        });
      }

      if (status === "Completed" && booking.status !== "Confirmed") {
        return res.status(409).json({
          message: "Only confirmed bookings can be marked completed.",
        });
      }

      if (status === "Confirmed") {
        const conflict = await bookingCollection.findOne({
          _id: { $ne: booking._id },
          studioId: booking.studioId,
          status: "Confirmed",
          startAt: { $lt: booking.endAt },
          endAt: { $gt: booking.startAt },
        });

        if (conflict) {
          return res.status(409).json({
            message: "This booking overlaps with another confirmed booking.",
          });
        }
      }
    } else {
      return res.status(400).json({
        message: "Status must be Cancelled, Confirmed, or Completed.",
      });
    }

    const result = await bookingCollection.updateOne(
      { _id: booking._id, status: booking.status },
      { $set: { status } }
    );

    if (result.matchedCount === 0) {
      return res.status(409).json({
        message: "The booking status changed. Refresh and try again.",
      });
    }

    res.json({ message: `Booking marked ${status}.` });
  } catch (error) {
    console.error("Failed to update booking:", error);
    res.status(500).json({ message: "Could not update booking." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});