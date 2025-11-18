import dotenv from "dotenv";
import { PORT } from "./constants.js";
import { app } from "./app.js";
import connectDB from "./db/dbConnect.js";
import { Chat } from "./models/chat.model.js";

dotenv.config({
    path: "./.env",
});

// Connecting the database and then app listens
connectDB()
    .then(() => {
        // Create a real HTTP server
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Create Socket.io server
        import("socket.io").then(({ Server }) => {
            const io = new Server(server, {
                cors: {
                    origin:
                        process.env.CORS_ORIGIN ||
                        "https://workbridg-test.vercel.app",
                    credentials: true,
                },
            });

            // Make io accessible in controllers
            app.set("io", io);

            io.on("connection", (socket) => {
                console.log("🔥 Backend: Client connected:", socket.id);

                socket.on("join", (room) => {
                    console.log("🔥 Backend: Client joined room:", room);
                    socket.join(room);
                });

                socket.on("leave", (room) => {
                    console.log("🔥 Backend: Client left room:", room);
                    socket.leave(room);
                });
            });
        });
    })
    .catch((err) => {
        console.log("MongoDB connection failed", err);
    });
