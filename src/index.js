import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.send("Personal Assistant server läuft.");
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
