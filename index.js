const express = require('express');
const Stripe = require("stripe");
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


// MongoDB URI
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


// Global collections
let jobsCollection;
let applicationsCollection;
let jobSeekersCollection;
let employersCollection;
let freelancers;
let servicesCollection;
let pricingCollection


// Connect and run
async function run() {
  try {
    // await client.connect();
    // console.log("Connected to MongoDB Atlas!");

    const db = client.db("nexthire");

    jobsCollection = db.collection("jobs");
    applicationsCollection = db.collection("applications");
    jobSeekersCollection = db.collection("jobseekers");
    employersCollection = db.collection("employers");
    freelancers = db.collection("freelancers");
    servicesCollection = db.collection("services");
    pricingCollection = db.collection("pricing");
    
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("Databases:", dbs.databases);
  } catch (err) {
    console.error(" MongoDB connection error:", err);
  }
}

run();

// <----------Middleware to verify JWT token for authentication--------->
const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization"); 

  if (!authHeader) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Invalid token:", err);
    res.status(400).json({ message: "Invalid token" });
  }
};


// <-------Login route with JWT creation-------->


app.post("/login", async (req, res) => {
  const { identifier } = req.body;

  try {
    // check email fild
    const isEmail = identifier.includes("@");

    const candidate = await jobSeekersCollection.findOne(
      isEmail ? { email: identifier } : { username: identifier }
    );
    const employer = await employersCollection.findOne(
      isEmail ? { email: identifier } : { username: identifier }
    );

    const user = candidate || employer;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role, userInfo: user },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      userInfo: user,
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// <--------Role-based access control ----------->
app.get('/dashboard', verifyToken, (req, res) => {
  console.log("User role in dashboard:", req.user.role); // Log the role of the logged-in user

  if (req.user.role === "Employer") {
    res.send("Welcome Employer!");
  } else if (req.user.role === "Candidate") {
    res.send("Welcome Candidate!");
  } else {
    console.log("Access forbidden due to insufficient permissions for role:", req.user.role);
    res.status(403).send("Access forbidden: insufficient permissions.");
  }
});


// ------------- jobseekers Registration -----------------

app.post('/jobseekers/register', async (req, res) => {
  const { firstName, lastName, username, email, role, uid } = req.body;

  if (!username || !email || !firstName || !lastName || !role || !uid) {
    return res.status(400).send({ message: "All fields are required" });
  }

  try {
    // 🔍 Check if email already exists
    const existingUser = await jobSeekersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).send({ message: "Email already in use" });
    }

    // ✅ Insert into MongoDB
    const result = await jobSeekersCollection.insertOne({
      firstName,
      lastName,
      username,
      email,
      role,
      uid, // Save UID from Firebase
      createdAt: new Date()
    });

    res.status(201).send({ message: "Job Seeker registered successfully", id: result.insertedId });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send({ message: "Registration failed" });
  }
});


// ------------- Employer Registration -----------------


app.post('/employers/register', async (req, res) => {
  try {
    const employer = req.body;

    // ✅ Only check for firstName and email (password বাদ দেওয়া হলো)
    if (!employer.firstName || !employer.email) {
      return res.status(400).send({ error: "Missing required fields" });
    }

    // 🔍 Check if email already exists
    const existingEmployer = await employersCollection.findOne({ email: employer.email });
    if (existingEmployer) {
      return res.status(409).send({ error: "Email already in use" });
    }

    // ✅ Insert employer data into DB
    const result = await employersCollection.insertOne(employer);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error registering employer:", error);
    res.status(500).send({ error: "Employer registration failed" });
  }
});

// <----------Route to create a payment intent for processing payments--------->
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount } = req.body; 

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true, 
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error("PaymentIntent Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// <----------Route to get pricing information--------->
app.get("/pricing", async (req, res) => {
  try {
    const pricingData = await pricingCollection.find({}).toArray();
    res.status(200).json(pricingData);
  } catch (error) {
    console.error("Failed to fetch pricing data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// <----------Route to get all freelancers--------->
app.get("/freelancers", async (req, res) => {
  try {
    const result = await freelancers.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch freelancers:", error);
    res.status(500).send({ error: "Failed to fetch freelancers" });
  }
});

// <----------Route to get all available services--------->
app.get("/services", async (req, res) => {
  try {
    const result = await servicesCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    res.status(500).send({ error: "Failed to fetch services" });
  }
});


// <----------Route to create a new job application--------->
app.post('/applications', async (req, res) => {
  try {
    const application = req.body;

    // Validate request body
    if (!application.jobId || !application.applicantEmail || !application.applicantName) {
      return res.status(400).json({ error: "jobId, applicantEmail, applicantName প্রয়োজন" });
    }

    // jobId 
    const job = await jobsCollection.findOne({ _id: new ObjectId(application.jobId) });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // email collectiting
    application.posterEmail = job.createdBy || null;

    // add data
    application.date = new Date().toISOString();

    // save in mongodb
    const result = await applicationsCollection.insertOne(application);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ error: "Failed to apply" });
  }
});


// <----------Route to get all job applications--------->
app.get('/applications', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ error: "Query parameter email প্রয়োজন" });
    }

    // applicantEmail filter
    const apps = await applicationsCollection
      .find({ applicantEmail: email })
      .sort({ date: -1 }) 
      .toArray();

    res.json(apps);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});



// <----------Route to get all applications submitted for jobs posted by the authenticated user--------->
app.get('/applications/by-poster', async (req, res) => {
  try {
    const posterEmail = req.query.email;
    if (!posterEmail) {
      return res.status(400).json({ error: "email query parameter প্রয়োজন" });
    }

    const apps = await applicationsCollection
      .find({ posterEmail })
      .sort({ date: -1 })
      .toArray();

    res.json(apps);
  } catch (error) {
    console.error("Error fetching applications by poster:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

//--------------------------
// PATCH: Update status of an application
app.patch('/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status field প্রয়োজন" });
    }

    const result = await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Application not found or unchanged" });
    }

    res.json({ message: "Status updated successfully" });
  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// <----------Route to delete a specific job application by its ID--------->

app.delete("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;

  try {
    const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });

    if (!application) {
      return res.status(404).send({ message: "Application not found" });
    }

    if (application.email !== userEmail) {
      return res.status(403).send({ message: "You can only withdraw your own applications" });
    }

    const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Application not found" });
    }

    res.send({ message: "Application withdrawn successfully" });
  } catch (err) {
    console.error("Error withdrawing application:", err);
    res.status(500).send({ message: "Failed to withdraw application" });
  }
});


// <----------Route to get all jobs--------->
app.get('/jobs', async (req, res) => {
  try {
    const { email } = req.query;

    let query = {};
    if (email) {
      query.createdBy = email;
    }

    const jobs = await jobsCollection.find(query).toArray();
    res.send(jobs);
  } catch (error) {
    console.error("❌ Error fetching jobs:", error);
    res.status(500).send({ error: "Failed to fetch jobs" });
  }
});


// <----------Route to get a specific job by its ID--------->
app.get('/jobs/:id', async (req, res) => {
  const id = req.params.id;
  const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
  res.send(job);
});


// <----------Route to create a new job--------->
app.post("/jobs", async (req, res) => {
  const job = req.body;

  try {
    if (!jobsCollection) {
      return res.status(500).send({ message: "Database not initialized" });
    }

    // without jwt email 
    const result = await jobsCollection.insertOne(job);
    res.status(200).send(result);
  } catch (err) {
    console.error("Error posting job:", err);
    res.status(500).send({ message: "Failed to post job" });
  }
});


// <----------Route to delete a specific job by its ID--------->
app.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Job not found" });
    }

    res.send({ message: "Job deleted successfully" });
  } catch (err) {
    console.error(" Error deleting job:", err);
    res.status(500).send({ message: "Failed to delete job" });
  }
});


// <----------Route to update the status of a specific job--------->
app.patch("/jobs/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).send({ message: "Status is required" });
  }

  try {
    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: "Job not found or status not changed" });
    }

    res.send({ message: "Status updated successfully" });
  } catch (err) {
    console.error(" Error updating job status:", err);
    res.status(500).send({ message: "Failed to update status" });
  }
});



// <----------Route to increment views for a specific job--------->

app.post('/views/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Find the job and increment the view count
    const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

    if (!job) {
      return res.status(404).send({ error: "Job not found" });
    }

    // Increment view count
    const updatedJob = await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      { $inc: { views: 1 } }  // Assuming there is a `views` field in the job schema
    );

    if (updatedJob.modifiedCount > 0) {
      return res.status(200).send({ message: "View count updated" });
    } else {
      return res.status(500).send({ error: "Failed to update view count" });
    }
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).send({ error: "Failed to update view count" });
  }
});

// <----------Route to update a specific job by its ID--------->
app.patch("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  const { title, category, location, status } = req.body;

  try {
    // sarce job
    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          category,
          location,
          status, // update stutas
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: "Job not found or no changes made" });
    }

    res.send({ message: "Job updated successfully" });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).send({ message: "Failed to update job" });
  }
});


// <----------delate job by ID--------->
app.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Job not found" });
    }

    res.send({ message: "Job deleted successfully" });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).send({ message: "Failed to delete job" });
  }
});

// <----------Route to get a specific job by its ID--------->
app.get("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    if (!job) {
      return res.status(404).send({ message: "Job not found" });
    }
    res.send(job);
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).send({ message: "Failed to fetch job details" });
  }
});


// <------------- Job Posts ----------------->

app.post("/jobs", async (req, res) => {
  const job = req.body;

  try {
    if (!jobsCollection) {
      return res.status(500).send({ message: "Database not initialized" });
    }

    // user email 
    const result = await jobsCollection.insertOne(job);
    res.status(200).send(result);
  } catch (err) {
    console.error(" Error posting job:", err);
    res.status(500).send({ message: "Failed to post job" });
  }
});



// <----------start next hire runing here--------->
app.get('/', (req, res) => {
  res.send('NextHire backend is running and connected to MongoDB!');
});






// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server is running on http://localhost:${PORT}`);
});
