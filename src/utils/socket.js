const { Server } = require("socket.io");

let io;
// Map to keep track of which User ID belongs to which Socket ID
const connectedUsers = new Map(); 

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "*", // Update this to your React frontend URL in production
        methods: ["GET", "POST"]
      }
    });

    io.on("connection", (socket) => {
      console.log("New Client Connected:", socket.id);

      // When a user logs in / loads the app, they send their DB User ID
      socket.on("register", (userId) => {
        connectedUsers.set(userId, socket.id);
        console.log(`User ${userId} registered to socket ${socket.id}`);
      });

      socket.on("disconnect", () => {
        // Find and remove the user from the map when they close the tab
        for (const [userId, socketId] of connectedUsers.entries()) {
          if (socketId === socket.id) {
            connectedUsers.delete(userId);
            break;
          }
        }
        console.log("Client Disconnected:", socket.id);
      });
    });

    return io;
  },
  
  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
  },

  // Helper to get a specific user's socket ID
  getUserSocket: (userId) => {
    return connectedUsers.get(userId);
  }
};