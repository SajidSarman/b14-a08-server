import express from 'express'
import { MongoClient } from 'mongodb';
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

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})