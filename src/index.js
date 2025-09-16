import dotenv from "dotenv";
import {PORT} from "./constants.js";
import {app} from "./app.js";
import connectDB from "./db/dbConnect.js";

dotenv.config({
    path: "./.env"
});

// Connecting the database and then app listens
connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    })
}) 
.catch((err) =>{
    console.log("MongoDB connection failed", err);
})