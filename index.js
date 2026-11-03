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

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})