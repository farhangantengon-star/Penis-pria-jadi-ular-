import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GameEngine } from "./src/gameEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Room Management
  const rooms = new Map<string, { engine: GameEngine, inputs: Record<string, { angle: number, isShooting: boolean }> }>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-room", ({ roomId, name, skinId, accessoryId }) => {
      socket.join(roomId);
      console.log(`User ${name} units room ${roomId}`);

      let room = rooms.get(roomId);
      if (!room) {
        const engine = new GameEngine();
        engine.init();
        room = { engine, inputs: {} };
        rooms.set(roomId, room);

        // Start Room Game Loop
        const intervalId = setInterval(() => {
          if (rooms.get(roomId)) {
            engine.update(room!.inputs);
            io.to(roomId).emit("game-state", engine.state);
          } else {
            clearInterval(intervalId);
          }
        }, 1000 / 60);
      }

      room.engine.addPlayer(socket.id, name, skinId, accessoryId);
      
      socket.on("player-input", (input) => {
        if (room) {
          room.inputs[socket.id] = input;
        }
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        if (room) {
          room.engine.removePlayer(socket.id);
          delete room.inputs[socket.id];
          
          // Cleanup if room is empty
          const humanPlayers = room.engine.state.players.filter(p => p.type === 'player');
          if (humanPlayers.length === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
