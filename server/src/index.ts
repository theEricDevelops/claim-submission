import express from "express";
import cors from "cors";
import path from "path";
import { claimRouter } from "./routes/claim";
import { templateRouter } from "./routes/template";
import { initDocuseal } from "./services/docuseal";
import { config } from "./config";

initDocuseal();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/claims", claimRouter);
app.use("/api/templates", templateRouter);

const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Claim submission server running on port ${config.port}`);
});
