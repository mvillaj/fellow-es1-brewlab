import cors from 'cors';
import express from 'express';
import './lib/db';
import { authRouter } from './routes/auth';
import { coffeeRouter } from './routes/coffees';
import { fellowRouter } from './routes/fellow';
import { grinderRouter } from './routes/grinders';
import { machineRouter } from './routes/machines';
import { aiRouter } from './routes/ai';
import { profileRouter } from './routes/profiles';
import { shotRouter } from './routes/shots';
import { getFellowClient } from './fellow/index';

const PORT = Number(process.env.PORT ?? 4000);
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, fellowMode: getFellowClient().mode, node: process.version });
});

app.use('/api/auth', authRouter);
app.use('/api/grinders', grinderRouter);
app.use('/api/machines', machineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/coffees', coffeeRouter);
app.use('/api/shots', shotRouter);
app.use('/api/profiles', profileRouter);
app.use('/api/fellow', fellowRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`  API      http://localhost:${PORT}`);
  console.log(`  Fellow   ${getFellowClient().mode} mode`);
});
