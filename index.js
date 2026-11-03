import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors'
import 'dotenv/config'

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

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

// // Call this only when your application terminates
// export async function disconnectFromMongoDB() {
//   await client.close();
// }

const mongoClient = await connectToMongoDB()
const db = mongoClient.db('StudioSpace-B14-A08');

const studioCollection = db.collection('studios');


app.post('/add-studio', async (req, res) => {
  const studioData = req.body;
  const result = await studioCollection.insertOne(studioData);
  // console.log("Api called!", studioData)
  console.log(result)
  
  res.send(result)

})

app.get('/', (req, res) => {
  res.send({message: 'Server is running fine!'})
})

app.get('/studios', async (req, res) => {
  const studios = await studioCollection.find().toArray()
  res.send(studios)
})

//homepage featured studios
app.get("/top6studios", async (req, res) => {
  try {
    const studios = await studioCollection
      .find()
      .sort({ _id: -1 }) // newest first
      .limit(6)
      .toArray();

    res.json(studios);
  } catch (error) {
    console.error("Failed to fetch featured studios:", error);
    res.status(500).json({ message: "Failed to fetch featured studios." });
  }
});

app.get('/studios/:id', async (req, res) => {
  const {id} = req.params
  const studio = await studioCollection.findOne({_id: new ObjectId(id)})
  res.send(studio)
})

app.put('/studios/:id', async (req, res) => {
  const {id} = req.params
  const updatedData = req.body
  const studio = await studioCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set: updatedData}
  )
  res.json(studio)
})

app.delete('/studios/:id', async (req, res) => {
  const {id} = req.params
  const studio = await studioCollection.deleteOne({_id: new ObjectId(id)})
  res.json(studio)
})



const bookingCollection = db.collection("bookings");

app.get("/bookings", async (req, res) => {
  const { customerEmail } = req.query;

  if (typeof customerEmail !== "string" || !customerEmail) {
    return res.status(400).json({ message: "customerEmail is required." });
  }

  const bookings = await bookingCollection
    .find({ customerEmail })
    .sort({ startAt: 1 })
    .toArray();

  res.json({ bookings });
});

app.post("/bookings", async (req, res) => {
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
    return res.status(400).json({ message: "Please provide valid booking details." });
  }

  const startAt = new Date(requestedStart);
  if (Number.isNaN(startAt.getTime()) || startAt <= new Date()) {
    return res.status(400).json({ message: "Choose a booking time in the future." });
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

app.patch("/bookings/:id", async (req, res) => {
  const { customerEmail } = req.body;

  if (!ObjectId.isValid(req.params.id) || typeof customerEmail !== "string") {
    return res.status(400).json({ message: "Invalid cancellation request." });
  }

  const result = await bookingCollection.updateOne(
    {
      _id: new ObjectId(req.params.id),
      customerEmail,
      status: "Pending",
    },
    { $set: { status: "Cancelled" } }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({
      message: "Pending booking not found; it may already be cancelled or confirmed.",
    });
  }

  res.json({ message: "Booking cancelled." });
});



app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})